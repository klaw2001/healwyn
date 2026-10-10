-- Phase 3: the routing engine's database side.
--
-- Routing itself is pure TypeScript (packages/core/src/routing). The database
-- supplies its inputs (the roster with live load, and a returning patient's
-- previous clinician) and records its output (assignment method, explanation,
-- billing copy-in) in the same transaction as the assignment.
-- Open stages are pack-defined, so callers pass them in.

-- ---------------------------------------------------------------------------
-- Routing context
-- ---------------------------------------------------------------------------

create or replace function app_private.routing_context(p_lead public.leads, p_open_stages text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lead', jsonb_build_object(
      'id', p_lead.id,
      'specialty_slug', p_lead.specialty_slug,
      'urgency', p_lead.urgency,
      'preferred_language', p_lead.preferred_language,
      'billing_flag', p_lead.billing_flag,
      'assigned_staff_id', p_lead.assigned_staff_id
    ),
    -- A returning patient: the most recent other lead with the same phone that
    -- someone was assigned to.
    'previous_staff_id', (
      select l.assigned_staff_id
      from public.leads l
      where p_lead.phone is not null
        and l.phone = p_lead.phone
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
          where l.assigned_staff_id = s.id and l.erased_at is null and l.stage = any (p_open_stages)
        ),
        'last_assigned_at', (
          select max(e.created_at) from public.lead_events e
          where e.type = 'lead.assigned' and e.payload ->> 'to_staff_id' = s.id::text
        )
      ) order by s.id)
      from public.staff s
      where s.active
    ), '[]'::jsonb)
  );
$$;

-- For staff who may assign (managers and care coordinators), on leads they can see.
create or replace function public.routing_context(p_lead_id uuid, p_open_stages text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager', 'care_coordinator']);
  v_lead public.leads := app_private.visible_lead(p_lead_id);
begin
  if v_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;
  return app_private.routing_context(v_lead, p_open_stages);
end;
$$;

-- For the CRM server itself (the voice webhook), with no staff session.
create or replace function public.system_routing_context(p_lead_id uuid, p_open_stages text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  select * into v_lead from public.leads where id = p_lead_id and erased_at is null;
  if not found then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  return app_private.routing_context(v_lead, p_open_stages);
end;
$$;

-- ---------------------------------------------------------------------------
-- Applying a routing decision
-- p_routing = {"method": "manual"|"override"|"routing", "explanation": [..],
--              "copy_in": [{"staff_id", "reason"}], "candidates": [..], "priority": ".."}
-- The explanation is generated from codes, offering names and staff names;
-- it never carries the lead's personal data or free text.
-- ---------------------------------------------------------------------------

create or replace function app_private.apply_assignment(
  p_lead public.leads,
  p_staff_id uuid,
  p_reason text,
  p_routing jsonb,
  p_actor_type text,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method text := coalesce(p_routing ->> 'method', 'manual');
  v_copy jsonb;
  v_task_id uuid;
  v_due timestamptz := now() + interval '1 day';
begin
  perform app_private.assert_code(p_reason, 'reason');
  if v_method not in ('manual', 'override', 'routing') then
    raise exception 'unknown assignment method' using errcode = 'invalid_parameter_value';
  end if;
  if p_routing is not null and (jsonb_typeof(p_routing) <> 'object' or octet_length(p_routing::text) > 16000) then
    raise exception 'routing details must be a small object' using errcode = 'invalid_parameter_value';
  end if;
  if p_staff_id is not null and not exists (select 1 from public.staff where id = p_staff_id and active) then
    raise exception 'that staff member is not active' using errcode = 'invalid_parameter_value';
  end if;

  if p_lead.assigned_staff_id is distinct from p_staff_id then
    update public.leads set assigned_staff_id = p_staff_id where id = p_lead.id;
    insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
    values (p_lead.id, 'lead.assigned', p_actor_type, p_actor_id,
            jsonb_build_object('from_staff_id', p_lead.assigned_staff_id, 'to_staff_id', p_staff_id,
                               'reason', p_reason, 'method', v_method)
            || case when p_routing is null then '{}'::jsonb else jsonb_build_object('routing', p_routing) end);
  end if;

  -- Copy-ins become a task for that person, once per lead and person.
  for v_copy in select * from jsonb_array_elements(coalesce(p_routing -> 'copy_in', '[]'::jsonb)) loop
    perform app_private.assert_code(v_copy ->> 'reason', 'copy-in reason');
    if not exists (select 1 from public.staff where id = (v_copy ->> 'staff_id')::uuid and active) then
      continue;
    end if;
    if exists (
      select 1 from public.tasks
      where lead_id = p_lead.id and assignee_staff_id = (v_copy ->> 'staff_id')::uuid and completed_at is null
    ) then
      continue;
    end if;
    insert into public.tasks (lead_id, assignee_staff_id, created_by_staff_id, title, due_at, remind_at)
    values (p_lead.id, (v_copy ->> 'staff_id')::uuid, case when p_actor_type = 'staff' then p_actor_id end,
            case v_copy ->> 'reason' when 'insurance_check' then 'Check insurance cover' else 'Review this lead' end,
            v_due, v_due - interval '30 minutes')
    returning id into v_task_id;
    insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
    values (p_lead.id, 'task.created', p_actor_type, p_actor_id,
            jsonb_build_object('task_id', v_task_id, 'due_at', v_due,
                               'assignee_staff_id', (v_copy ->> 'staff_id')::uuid, 'copy_in', v_copy ->> 'reason'));
  end loop;

  return p_lead.assigned_staff_id is distinct from p_staff_id;
end;
$$;

-- Staff assignment: by hand, overriding a suggestion, or accepting it.
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
  if v_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;
  perform app_private.apply_assignment(v_lead, p_staff_id, p_reason, p_routing, 'staff', v_staff.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema app_private from public, anon, authenticated, service_role;

revoke execute on function
  public.routing_context(uuid, text[]),
  public.system_routing_context(uuid, text[])
from public, anon, authenticated;

grant execute on function public.routing_context(uuid, text[]) to authenticated, service_role;
grant execute on function public.system_routing_context(uuid, text[]) to service_role, crm_server;

create index if not exists lead_events_assigned_to_idx
  on public.lead_events ((payload ->> 'to_staff_id'), created_at)
  where type = 'lead.assigned';
create index if not exists leads_phone_idx on public.leads (phone) where phone is not null;
