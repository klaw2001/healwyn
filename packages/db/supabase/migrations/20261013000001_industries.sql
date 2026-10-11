-- Phase 4: several industry packs in one database.
--
-- Leads, staff, specialties and sequence settings already carry an `industry`.
-- This makes it a boundary:
-- 1. Staff see only leads (and colleagues) of their own industry. RLS and
--    `staff_can_see_lead` add the check; `canSeeLead` in packages/core mirrors it.
-- 2. industry_stages: each pack's stage ids and kinds, written by the seed from
--    the pack. Stage changes must name a stage of the lead's industry, and the
--    billing desk sees leads in its industry's won stage (the clinic's
--    "Package active", a real estate token, …) instead of a hardcoded id.
-- 3. The routing roster and the "returning person" lookup stay inside the
--    lead's industry.
-- 4. staff_for_auth_user also returns the industry, which the CRM puts in the
--    session and uses to pick the pack.

create table public.industry_stages (
  industry text not null check (industry ~ '^[a-z][a-z0-9_]{0,39}$'),
  stage_id text not null check (stage_id ~ '^[a-z]+(_[a-z]+)*$'),
  kind text not null check (kind in ('open', 'won', 'lost')),
  sort_order integer not null default 0,
  primary key (industry, stage_id)
);

comment on table public.industry_stages is 'Each industry pack''s pipeline stages. Written by the seed from the pack.';

alter table public.industry_stages enable row level security;
create policy industry_stages_staff_read on public.industry_stages
  for select to authenticated using (true);
revoke all on table public.industry_stages from anon, authenticated;
grant select on table public.industry_stages to authenticated;
grant select, insert, update, delete on table public.industry_stages to service_role;
revoke truncate, trigger, references on public.industry_stages from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The acting staff member's industry, and visibility by industry
-- ---------------------------------------------------------------------------

create or replace function public.current_staff_industry()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select industry from public.staff where auth_user_id = auth.uid() and active
$$;

drop policy leads_staff_read on public.leads;
drop function public.staff_can_see_lead(uuid, boolean, text);

create function public.staff_can_see_lead(
  p_industry text,
  p_assigned_staff_id uuid,
  p_billing_flag boolean,
  p_stage text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_industry = public.current_staff_industry(), false) and case public.current_staff_role()
    when 'manager' then true
    when 'care_coordinator' then true
    when 'specialist_doctor' then p_assigned_staff_id is not null and p_assigned_staff_id = public.current_staff_id()
    when 'billing_desk' then
      (p_assigned_staff_id is not null and p_assigned_staff_id = public.current_staff_id())
      or p_billing_flag
      or exists (
        select 1 from public.industry_stages s
        where s.industry = p_industry and s.stage_id = p_stage and s.kind = 'won'
      )
    else false
  end
$$;

create policy leads_staff_read on public.leads
  for select to authenticated
  using (public.staff_can_see_lead(industry, assigned_staff_id, billing_flag, stage));

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
  if not found
     or not public.staff_can_see_lead(v_lead.industry, v_lead.assigned_staff_id, v_lead.billing_flag, v_lead.stage) then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  return v_lead;
end;
$$;

-- Colleagues: only your own industry's staff.
drop policy staff_staff_read on public.staff;
create policy staff_staff_read on public.staff
  for select to authenticated using (industry = public.current_staff_industry());

-- ---------------------------------------------------------------------------
-- Signing in: the staff member's industry picks the CRM's pack
-- ---------------------------------------------------------------------------

drop function public.staff_for_auth_user(uuid);
create function public.staff_for_auth_user(p_auth_user_id uuid)
returns table (staff_id uuid, full_name text, role text, title text, email text, industry text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.role, s.title, s.email, s.industry
  from public.staff s where s.auth_user_id = p_auth_user_id and s.active
$$;

-- ---------------------------------------------------------------------------
-- Stage changes name a stage of the lead's own industry
-- ---------------------------------------------------------------------------

create or replace function app_private.apply_stage_change(
  p_lead public.leads,
  p_to_stage text,
  p_plan jsonb,
  p_reason text,
  p_actor_type text,
  p_actor_id uuid,
  p_is_response boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform app_private.assert_code(p_reason, 'reason');
  if p_to_stage !~ '^[a-z]+(_[a-z]+)*$'
     or not exists (select 1 from public.industry_stages s where s.industry = p_lead.industry and s.stage_id = p_to_stage) then
    raise exception 'invalid stage' using errcode = 'invalid_parameter_value';
  end if;
  if p_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_lead.stage = p_to_stage then
    return jsonb_build_object('from', p_lead.stage, 'to', p_to_stage, 'changed', false);
  end if;

  update public.leads
     set stage = p_to_stage,
         first_response_at = case when p_is_response then coalesce(first_response_at, now()) else first_response_at end
   where id = p_lead.id;

  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead.id, 'stage.changed', p_actor_type, p_actor_id,
          jsonb_build_object('from', p_lead.stage, 'to', p_to_stage, 'reason', p_reason));

  v_result := app_private.apply_sequence_plan(p_lead.id, p_plan, p_lead.industry,
                                               case when p_actor_type = 'staff' then p_actor_id end);
  return jsonb_build_object('from', p_lead.stage, 'to', p_to_stage, 'changed', true) || v_result;
end;
$$;

-- Managers pause their own industry's sequences only.
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
  if p_industry is distinct from v_staff.industry then
    raise exception 'you may not do this' using errcode = 'insufficient_privilege';
  end if;
  insert into public.sequence_settings (industry, sequence_id, paused, updated_by_staff_id, updated_at)
  values (p_industry, p_sequence_id, p_paused, v_staff.id, now())
  on conflict (industry, sequence_id) do update
    set paused = excluded.paused, updated_by_staff_id = excluded.updated_by_staff_id, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Routing stays inside the lead's industry
-- ---------------------------------------------------------------------------

-- p_open_stages: the stages that count towards someone's load; null means the
-- open stages of the lead's industry (from industry_stages).
create or replace function app_private.routing_context(p_lead public.leads, p_open_stages text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with open_stages as (
    select unnest(coalesce(p_open_stages, array(
      select s.stage_id from public.industry_stages s where s.industry = p_lead.industry and s.kind = 'open'
    ))) as stage_id
  )
  select jsonb_build_object(
    'lead', jsonb_build_object(
      'id', p_lead.id,
      'industry', p_lead.industry,
      'specialty_slug', p_lead.specialty_slug,
      'urgency', p_lead.urgency,
      'preferred_language', p_lead.preferred_language,
      'billing_flag', p_lead.billing_flag,
      'assigned_staff_id', p_lead.assigned_staff_id
    ),
    -- A returning person: the most recent other lead in this industry with the
    -- same phone that someone was assigned to.
    'previous_staff_id', (
      select l.assigned_staff_id
      from public.leads l
      where p_lead.phone is not null
        and l.phone = p_lead.phone
        and l.industry = p_lead.industry
        and l.id <> p_lead.id
        and l.erased_at is null
        and l.assigned_staff_id is not null
      order by l.created_at desc
      limit 1
    ),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'full_name', s.full_name,
        'role', s.role,
        'level', s.level,
        'active', s.active,
        'specialties', to_jsonb(s.specialties),
        'languages', to_jsonb(s.languages),
        'capacity', s.capacity,
        'open_leads', (
          select count(*) from public.leads l
          where l.assigned_staff_id = s.id and l.erased_at is null and l.stage in (select o.stage_id from open_stages o)
        ),
        'last_assigned_at', (
          select max(e.created_at) from public.lead_events e
          where e.type = 'lead.assigned' and e.payload ->> 'to_staff_id' = s.id::text
        )
      ) order by s.id)
      from public.staff s
      where s.active and s.industry = p_lead.industry
    ), '[]'::jsonb)
  );
$$;

-- The voice webhook validates a call's answers against the lead's own pack.
create or replace function public.call_lead_industry(p_call_id uuid, p_lead_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select l.industry from public.call_sessions c join public.leads l on l.id = c.lead_id
  where c.id = p_call_id and c.lead_id = p_lead_id
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema app_private from public, anon, authenticated, service_role;

revoke execute on function
  public.current_staff_industry(),
  public.staff_can_see_lead(text, uuid, boolean, text),
  public.staff_for_auth_user(uuid),
  public.call_lead_industry(uuid, uuid)
from public, anon;
revoke execute on function public.call_lead_industry(uuid, uuid) from authenticated;
revoke execute on function public.staff_for_auth_user(uuid) from authenticated;

grant execute on function
  public.current_staff_industry(),
  public.staff_can_see_lead(text, uuid, boolean, text)
to authenticated, service_role;
grant execute on function public.staff_for_auth_user(uuid) to service_role, crm_server;
grant execute on function public.call_lead_industry(uuid, uuid) to service_role, crm_server;
