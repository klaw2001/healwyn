-- Phase 2: who can see and do what in the CRM.
--
-- Model: staff READ through row level security (policies below). Staff WRITE
-- only through the functions below: each is SECURITY DEFINER, checks the
-- caller's role and the lead's visibility explicitly, and records what it did
-- in lead_events. `authenticated` holds SELECT on the CRM tables and nothing
-- else, so there is no way to change data except through these audited paths.
--
-- Lead visibility (mirrors LEAD_VISIBILITY in packages/core/src/permissions.ts):
--   manager, care_coordinator  every lead
--   specialist_doctor          leads assigned to them
--   billing_desk               leads assigned to them, flagged for billing, or with an active package

create schema if not exists app_private;
revoke all on schema app_private from public;
comment on schema app_private is 'Internal helpers. Not exposed through the API.';

-- ---------------------------------------------------------------------------
-- Who is calling
-- ---------------------------------------------------------------------------

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.staff where auth_user_id = auth.uid() and active
$$;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff where auth_user_id = auth.uid() and active
$$;

create or replace function public.staff_can_see_lead(p_assigned_staff_id uuid, p_billing_flag boolean, p_stage text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_staff_role()
    when 'manager' then true
    when 'care_coordinator' then true
    when 'specialist_doctor' then p_assigned_staff_id is not null and p_assigned_staff_id = public.current_staff_id()
    when 'billing_desk' then
      (p_assigned_staff_id is not null and p_assigned_staff_id = public.current_staff_id())
      or p_billing_flag
      or p_stage = 'package_active'
    else false
  end
$$;

-- The acting staff member, optionally restricted to some roles.
create or replace function app_private.acting_staff(p_roles text[] default null)
returns public.staff
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff public.staff;
begin
  select * into v_staff from public.staff where auth_user_id = auth.uid() and active;
  if not found then
    raise exception 'not signed in as active staff' using errcode = 'insufficient_privilege';
  end if;
  if p_roles is not null and not (v_staff.role = any (p_roles)) then
    raise exception 'the % role may not do this', v_staff.role using errcode = 'insufficient_privilege';
  end if;
  return v_staff;
end;
$$;

-- A lead the caller can see, locked for update. Hidden and missing leads raise
-- the same error, so the response never reveals that a lead exists.
create or replace function app_private.visible_lead(p_lead_id uuid)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or not public.staff_can_see_lead(v_lead.assigned_staff_id, v_lead.billing_flag, v_lead.stage) then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  return v_lead;
end;
$$;

create or replace function app_private.assert_code(p_value text, p_name text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^[a-z0-9_.:-]{1,64}$' then
    raise exception '% must be a short code, not free text', p_name using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nurture plans (shared by submit_lead, change_lead_stage and manual enrolment)
-- p_plan = {"enroll": [{"sequenceId", "steps": [{"stepIndex", "channel", "templateId", "dueAt"}]}],
--           "cancel": [{"sequenceId", "reason"}]}
-- ---------------------------------------------------------------------------

create or replace function app_private.stop_enrollments(
  p_lead_id uuid,
  p_reason text,
  p_sequence_ids text[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_sequences text[];
  v_sequence text;
begin
  with stopped as (
    update public.sequence_enrollments
       set status = 'stopped', stop_reason = p_reason, ended_at = now()
     where lead_id = p_lead_id
       and status = 'active'
       and (p_sequence_ids is null or sequence_id = any (p_sequence_ids))
    returning id, sequence_id
  )
  select array_agg(id), array_agg(sequence_id) into v_ids, v_sequences from stopped;

  if v_ids is null then
    return 0;
  end if;

  update public.scheduled_messages
     set status = 'cancelled', skip_reason = p_reason, processed_at = now()
   where enrollment_id = any (v_ids) and status = 'pending';

  foreach v_sequence in array v_sequences
  loop
    insert into public.lead_events (lead_id, type, actor_type, payload)
    values (p_lead_id, 'sequence.stopped', 'system', jsonb_build_object('sequence_id', v_sequence, 'reason', p_reason));
  end loop;

  return array_length(v_ids, 1);
end;
$$;

create or replace function app_private.apply_sequence_plan(
  p_lead_id uuid,
  p_plan jsonb,
  p_industry text,
  p_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cancel text[];
  v_enroll jsonb;
  v_enrollment_id uuid;
  v_enrolled integer := 0;
  v_cancelled integer := 0;
begin
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    return jsonb_build_object('enrolled', 0, 'cancelled', 0);
  end if;

  select array_agg(c ->> 'sequenceId') into v_cancel
    from jsonb_array_elements(coalesce(p_plan -> 'cancel', '[]'::jsonb)) as c;
  if v_cancel is not null then
    v_cancelled := app_private.stop_enrollments(p_lead_id, 'stage_changed', v_cancel);
  end if;

  for v_enroll in select * from jsonb_array_elements(coalesce(p_plan -> 'enroll', '[]'::jsonb))
  loop
    insert into public.sequence_enrollments (lead_id, industry, sequence_id, enrolled_by_staff_id)
    values (p_lead_id, p_industry, v_enroll ->> 'sequenceId', p_staff_id)
    on conflict (lead_id, sequence_id) where status = 'active' do nothing
    returning id into v_enrollment_id;

    if v_enrollment_id is not null then
      insert into public.scheduled_messages (enrollment_id, lead_id, sequence_id, step_index, channel, template_id, due_at)
      select v_enrollment_id, p_lead_id, v_enroll ->> 'sequenceId', (s ->> 'stepIndex')::integer,
             s ->> 'channel', s ->> 'templateId', (s ->> 'dueAt')::timestamptz
        from jsonb_array_elements(v_enroll -> 'steps') as s;

      insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
      values (p_lead_id, 'sequence.enrolled', case when p_staff_id is null then 'system' else 'staff' end, p_staff_id,
              jsonb_build_object('sequence_id', v_enroll ->> 'sequenceId',
                                 'steps', jsonb_array_length(v_enroll -> 'steps')));
      v_enrolled := v_enrolled + 1;
    end if;
  end loop;

  return jsonb_build_object('enrolled', v_enrolled, 'cancelled', v_cancelled);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff actions
-- ---------------------------------------------------------------------------

-- Moves a lead to another stage and applies the nurture plan for that stage
-- (computed from the industry pack in TypeScript). Any role, visible leads only.
create or replace function public.change_lead_stage(
  p_lead_id uuid,
  p_to_stage text,
  p_plan jsonb default null,
  p_reason text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff();
  v_lead public.leads := app_private.visible_lead(p_lead_id);
  v_result jsonb;
begin
  perform app_private.assert_code(p_reason, 'reason');
  if p_to_stage !~ '^[a-z]+(_[a-z]+)*$' then
    raise exception 'invalid stage' using errcode = 'invalid_parameter_value';
  end if;
  if v_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_lead.stage = p_to_stage then
    return jsonb_build_object('from', v_lead.stage, 'to', p_to_stage, 'changed', false);
  end if;

  update public.leads
     set stage = p_to_stage,
         first_response_at = coalesce(first_response_at, now())
   where id = p_lead_id;

  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead_id, 'stage.changed', 'staff', v_staff.id,
          jsonb_build_object('from', v_lead.stage, 'to', p_to_stage, 'reason', p_reason));

  v_result := app_private.apply_sequence_plan(p_lead_id, p_plan, v_lead.industry, v_staff.id);
  return jsonb_build_object('from', v_lead.stage, 'to', p_to_stage, 'changed', true) || v_result;
end;
$$;

-- Assigns (or unassigns, with null) a lead. Managers and care coordinators only.
create or replace function public.assign_lead(
  p_lead_id uuid,
  p_staff_id uuid,
  p_reason text default 'manual',
  p_routing jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager', 'care_coordinator']);
  v_lead public.leads := app_private.visible_lead(p_lead_id);
begin
  perform app_private.assert_code(p_reason, 'reason');
  if p_staff_id is not null and not exists (select 1 from public.staff where id = p_staff_id and active) then
    raise exception 'that staff member is not active' using errcode = 'invalid_parameter_value';
  end if;
  if v_lead.assigned_staff_id is not distinct from p_staff_id then
    return;
  end if;

  update public.leads set assigned_staff_id = p_staff_id where id = p_lead_id;

  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead_id, 'lead.assigned', 'staff', v_staff.id,
          jsonb_build_object('from_staff_id', v_lead.assigned_staff_id, 'to_staff_id', p_staff_id,
                             'reason', p_reason, 'method', 'manual')
          || case when p_routing is null then '{}'::jsonb else jsonb_build_object('routing', p_routing) end);
end;
$$;

create or replace function public.add_note(p_lead_id uuid, p_body text, p_template_id text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff();
  v_lead public.leads := app_private.visible_lead(p_lead_id);
  v_note_id uuid;
begin
  if v_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;
  insert into public.notes (lead_id, author_staff_id, template_id, body)
  values (p_lead_id, v_staff.id, p_template_id, btrim(p_body))
  returning id into v_note_id;

  update public.leads set first_response_at = coalesce(first_response_at, now()) where id = p_lead_id;

  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead_id, 'note.added', 'staff', v_staff.id,
          jsonb_build_object('note_id', v_note_id, 'template_id', p_template_id));
  return v_note_id;
end;
$$;

create or replace function public.create_task(
  p_lead_id uuid,
  p_title text,
  p_due_at timestamptz,
  p_assignee_staff_id uuid default null,
  p_remind_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff();
  v_lead public.leads := app_private.visible_lead(p_lead_id);
  v_task_id uuid;
begin
  if p_assignee_staff_id is not null and not exists (select 1 from public.staff where id = p_assignee_staff_id and active) then
    raise exception 'that staff member is not active' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.tasks (lead_id, assignee_staff_id, created_by_staff_id, title, due_at, remind_at)
  values (p_lead_id, coalesce(p_assignee_staff_id, v_staff.id), v_staff.id, btrim(p_title), p_due_at, p_remind_at)
  returning id into v_task_id;

  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead_id, 'task.created', 'staff', v_staff.id,
          jsonb_build_object('task_id', v_task_id, 'due_at', p_due_at,
                             'assignee_staff_id', coalesce(p_assignee_staff_id, v_staff.id)));
  return v_task_id;
end;
$$;

create or replace function public.complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff();
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'task not found' using errcode = 'no_data_found';
  end if;
  perform app_private.visible_lead(v_task.lead_id);
  if v_task.completed_at is not null then
    return;
  end if;
  update public.tasks set completed_at = now(), completed_by_staff_id = v_staff.id where id = p_task_id;
  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (v_task.lead_id, 'task.completed', 'staff', v_staff.id, jsonb_build_object('task_id', p_task_id));
end;
$$;

-- The lead got back in touch (by phone, in person, or a reply staff saw).
-- Stops every active nurture sequence at once.
create or replace function public.mark_replied(p_lead_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff();
  v_lead public.leads := app_private.visible_lead(p_lead_id);
  v_stopped integer;
begin
  update public.leads
     set last_inbound_at = now(),
         first_response_at = coalesce(first_response_at, now())
   where id = v_lead.id;
  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead_id, 'lead.replied', 'staff', v_staff.id, jsonb_build_object('source', 'staff'));
  v_stopped := app_private.stop_enrollments(p_lead_id, 'replied');
  return v_stopped;
end;
$$;

-- Records a consent withdrawal reported to staff. p_erase comes from the pack
-- (erasesDataOnWithdrawal). Managers and care coordinators only.
create or replace function public.record_consent_withdrawal(p_lead_id uuid, p_purpose text, p_erase boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager', 'care_coordinator']);
  v_lead public.leads := app_private.visible_lead(p_lead_id);
begin
  perform app_private.assert_code(p_purpose, 'purpose');
  -- When p_erase is true, erase_lead also stops every active sequence.
  perform public.withdraw_consent(v_lead.id, p_purpose, 'staff', p_erase);
  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead_id, 'consent.withdrawal_recorded', 'staff', v_staff.id, jsonb_build_object('purpose', p_purpose));
end;
$$;

-- Enrols a lead in a sequence by hand (e.g. no-show recovery). Front desk only.
create or replace function public.enroll_lead(p_lead_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager', 'care_coordinator']);
  v_lead public.leads := app_private.visible_lead(p_lead_id);
begin
  if v_lead.erased_at is not null or v_lead.opted_out_at is not null then
    raise exception 'this lead cannot receive messages' using errcode = 'object_not_in_prerequisite_state';
  end if;
  return app_private.apply_sequence_plan(p_lead_id, p_plan, v_lead.industry, v_staff.id);
end;
$$;

create or replace function public.stop_enrollment(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager', 'care_coordinator']);
  v_enrollment public.sequence_enrollments;
begin
  select * into v_enrollment from public.sequence_enrollments where id = p_enrollment_id;
  if not found then
    raise exception 'enrolment not found' using errcode = 'no_data_found';
  end if;
  perform app_private.visible_lead(v_enrollment.lead_id);
  perform app_private.stop_enrollments(v_enrollment.lead_id, 'manual', array[v_enrollment.sequence_id]);
  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (v_enrollment.lead_id, 'sequence.stopped_by_staff', 'staff', v_staff.id,
          jsonb_build_object('sequence_id', v_enrollment.sequence_id));
end;
$$;

-- Pauses or resumes a whole sequence. Managers only.
create or replace function public.set_sequence_paused(p_industry text, p_sequence_id text, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager']);
begin
  perform app_private.assert_code(p_sequence_id, 'sequence');
  insert into public.sequence_settings (industry, sequence_id, paused, updated_by_staff_id, updated_at)
  values (p_industry, p_sequence_id, p_paused, v_staff.id, now())
  on conflict (industry, sequence_id) do update
    set paused = excluded.paused, updated_by_staff_id = excluded.updated_by_staff_id, updated_at = now();
end;
$$;

-- Stores the rule-based score computed in TypeScript (packages/core scoreLead).
create or replace function public.save_lead_score(p_lead_id uuid, p_score integer, p_band text, p_factors jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.acting_staff();
  perform app_private.visible_lead(p_lead_id);
  insert into public.lead_scores (lead_id, score, band, factors, computed_at)
  values (p_lead_id, p_score, p_band, p_factors, now())
  on conflict (lead_id) do update
    set score = excluded.score, band = excluded.band, factors = excluded.factors, computed_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Read policies
-- ---------------------------------------------------------------------------

create policy leads_staff_read on public.leads
  for select to authenticated
  using (public.staff_can_see_lead(assigned_staff_id, billing_flag, stage));

-- Child rows are visible when their lead is: the subquery runs under the
-- leads policy above.
create policy lead_events_staff_read on public.lead_events
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy consent_records_staff_read on public.consent_records
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy notes_staff_read on public.notes
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy tasks_staff_read on public.tasks
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy messages_staff_read on public.messages
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy sequence_enrollments_staff_read on public.sequence_enrollments
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy scheduled_messages_staff_read on public.scheduled_messages
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy lead_scores_staff_read on public.lead_scores
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));

-- Directory data every signed-in staff member needs (assignee lists, labels).
create policy staff_staff_read on public.staff for select to authenticated using (public.current_staff_id() is not null);
create policy specialties_staff_read on public.specialties for select to authenticated using (true);
create policy sequence_settings_staff_read on public.sequence_settings for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.lead_scores enable row level security;
alter table public.sequence_settings enable row level security;

revoke all on table
  public.notes, public.tasks, public.messages, public.sequence_enrollments,
  public.scheduled_messages, public.lead_scores, public.sequence_settings
from anon, authenticated;

grant select on table
  public.leads, public.lead_events, public.consent_records, public.current_consents,
  public.notes, public.tasks, public.messages, public.sequence_enrollments,
  public.scheduled_messages, public.lead_scores, public.sequence_settings,
  public.staff, public.specialties
to authenticated;

grant select, insert, update, delete on table
  public.notes, public.tasks, public.messages, public.sequence_enrollments,
  public.scheduled_messages, public.lead_scores, public.sequence_settings
to service_role;

-- Supabase's default privileges hand new tables ALL to the API roles; keep
-- TRUNCATE, TRIGGER and REFERENCES away from them everywhere.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated, service_role;

revoke execute on all functions in schema app_private from public, anon, authenticated, service_role;

revoke execute on function
  public.current_staff_id(),
  public.current_staff_role(),
  public.staff_can_see_lead(uuid, boolean, text),
  public.change_lead_stage(uuid, text, jsonb, text),
  public.assign_lead(uuid, uuid, text, jsonb),
  public.add_note(uuid, text, text),
  public.create_task(uuid, text, timestamptz, uuid, timestamptz),
  public.complete_task(uuid),
  public.mark_replied(uuid),
  public.record_consent_withdrawal(uuid, text, boolean),
  public.enroll_lead(uuid, jsonb),
  public.stop_enrollment(uuid),
  public.set_sequence_paused(text, text, boolean),
  public.save_lead_score(uuid, integer, text, jsonb)
from public, anon;

grant execute on function
  public.current_staff_id(),
  public.current_staff_role(),
  public.staff_can_see_lead(uuid, boolean, text),
  public.change_lead_stage(uuid, text, jsonb, text),
  public.assign_lead(uuid, uuid, text, jsonb),
  public.add_note(uuid, text, text),
  public.create_task(uuid, text, timestamptz, uuid, timestamptz),
  public.complete_task(uuid),
  public.mark_replied(uuid),
  public.record_consent_withdrawal(uuid, text, boolean),
  public.enroll_lead(uuid, jsonb),
  public.stop_enrollment(uuid),
  public.set_sequence_paused(text, text, boolean),
  public.save_lead_score(uuid, integer, text, jsonb)
to authenticated, service_role;
