-- Phase 4: booking.
--
-- Bookable staff (the pack's `booking.bookableRoles`) publish a weekly template
-- (one range per weekday) plus exceptions (a day or hours off, or extra hours).
-- Appointments are booked from the website (the lead's signed booking link) or
-- by staff in the CRM. The database refuses double booking itself: an exclusion
-- constraint on (staff, time range) over every appointment that is not
-- cancelled. Booking, rescheduling, cancelling and marking attended or no-show
-- each move the lead's stage and apply the stage's nurture plan in the same
-- transaction. Rules come from `booking_policies`, written by the seed from the
-- pack, like `call_policies`. Times are India time (every pack's brand uses it).

create extension if not exists btree_gist with schema extensions;

create table public.booking_policies (
  industry text primary key check (industry ~ '^[a-z][a-z0-9_]{0,39}$'),
  slot_minutes integer not null check (slot_minutes between 10 and 240),
  horizon_days integer not null check (horizon_days between 1 and 60),
  min_notice_minutes integer not null default 60 check (min_notice_minutes between 0 and 2880),
  bookable_roles text[] not null,
  booked_stage text not null,
  attended_stage text not null,
  no_show_stage text not null,
  time_zone text not null default 'Asia/Kolkata'
);
comment on table public.booking_policies is 'Each industry pack''s booking rules. Written by the seed from the pack.';

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time time not null,
  end_time time not null,
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (staff_id, weekday)
);
comment on table public.availability_rules is 'Weekly template: the hours a bookable staff member takes appointments, in India time.';

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  on_date date not null,
  kind text not null check (kind in ('off', 'extra')),
  start_time time,
  end_time time,
  reason text not null default 'other' check (reason ~ '^[a-z_]{1,32}$'),
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  check (
    (start_time is null and end_time is null and kind = 'off')
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);
create index availability_exceptions_staff_date on public.availability_exceptions (staff_id, on_date);
comment on table public.availability_exceptions is 'Dates that differ from the weekly template: time off (a whole day or some hours) or extra hours.';

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  staff_id uuid not null references public.staff (id),
  industry text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked', 'attended', 'no_show', 'cancelled')),
  booked_via text not null check (booked_via in ('website', 'staff', 'seed')),
  -- The lead's stage before booking: a cancellation moves the lead back to it.
  previous_stage text,
  replaces_appointment_id uuid references public.appointments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint appointments_no_double_booking
    exclude using gist (staff_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'cancelled')
);
-- One upcoming appointment per lead at a time (rescheduling replaces it).
create unique index appointments_one_open_per_lead on public.appointments (lead_id) where status = 'booked';
create index appointments_staff_time on public.appointments (staff_id, starts_at);
create index appointments_due on public.appointments (ends_at) where status = 'booked';
comment on table public.appointments is 'Booked times. No two non-cancelled appointments of one staff member overlap (exclusion constraint).';

-- ---------------------------------------------------------------------------
-- Row level security: staff read their own industry's calendars and the
-- appointments of leads they can see. Writes only through the functions below.
-- ---------------------------------------------------------------------------

alter table public.booking_policies enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.appointments enable row level security;

create policy booking_policies_staff_read on public.booking_policies
  for select to authenticated using (industry = public.current_staff_industry());
-- The staff subquery runs under the staff policy (same industry only).
create policy availability_rules_staff_read on public.availability_rules
  for select to authenticated using (exists (select 1 from public.staff s where s.id = staff_id));
create policy availability_exceptions_staff_read on public.availability_exceptions
  for select to authenticated using (exists (select 1 from public.staff s where s.id = staff_id));
create policy appointments_staff_read on public.appointments
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));

revoke all on table public.booking_policies, public.availability_rules, public.availability_exceptions,
  public.appointments from anon, authenticated;
grant select on table public.booking_policies, public.availability_rules, public.availability_exceptions,
  public.appointments to authenticated;
grant select, insert, update, delete on table public.booking_policies, public.availability_rules,
  public.availability_exceptions, public.appointments to service_role;
revoke truncate, trigger, references on public.booking_policies, public.availability_rules,
  public.availability_exceptions, public.appointments from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function app_private.booking_policy(p_industry text)
returns public.booking_policies
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_policy public.booking_policies;
begin
  select * into v_policy from public.booking_policies where industry = p_industry;
  if not found then
    raise exception 'booking is not set up for this industry' using errcode = 'object_not_in_prerequisite_state';
  end if;
  return v_policy;
end;
$$;

-- True when [p_starts, p_ends) lies inside the staff member's published hours
-- (weekly template or extra hours that day), outside any time off, on one day.
create or replace function app_private.slot_is_open(
  p_staff_id uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_time_zone text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with local as (
    select (p_starts at time zone p_time_zone) as s, (p_ends at time zone p_time_zone) as e
  )
  select (select s::date = (e - interval '1 microsecond')::date from local)
    and (
      exists (
        select 1 from public.availability_rules r, local
        where r.staff_id = p_staff_id
          and r.weekday = extract(isodow from local.s)
          and local.s::time >= r.start_time
          and (local.e - interval '1 microsecond')::time < r.end_time
      )
      or exists (
        select 1 from public.availability_exceptions x, local
        where x.staff_id = p_staff_id and x.kind = 'extra' and x.on_date = local.s::date
          and local.s::time >= x.start_time
          and (local.e - interval '1 microsecond')::time < x.end_time
      )
    )
    and not exists (
      select 1 from public.availability_exceptions x, local
      where x.staff_id = p_staff_id and x.kind = 'off' and x.on_date = local.s::date
        and (x.start_time is null or (local.s::time < x.end_time and (local.e - interval '1 microsecond')::time >= x.start_time))
    )
$$;

-- The one place an appointment is made. Checks the slot against the policy and
-- the calendar, replaces the lead's current appointment when rescheduling,
-- assigns the lead to the staff member if nobody has it yet, and moves the lead
-- to the booked stage (applying p_plan, from planStageEntry in TypeScript).
-- Double booking surfaces as exclusion_violation (23P01).
create or replace function app_private.place_appointment(
  p_lead public.leads,
  p_staff_id uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_via text,
  p_plan jsonb,
  p_replaces uuid,
  p_actor_type text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.booking_policies := app_private.booking_policy(p_lead.industry);
  v_staff public.staff;
  v_old public.appointments;
  v_previous_stage text := p_lead.stage;
  v_id uuid;
begin
  if p_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;
  select * into v_staff from public.staff
   where id = p_staff_id and active and industry = p_lead.industry and role = any (v_policy.bookable_roles);
  if not found then
    raise exception 'this person does not take bookings' using errcode = 'invalid_parameter_value';
  end if;
  if p_ends - p_starts <> make_interval(mins => v_policy.slot_minutes)
     or p_starts < now() + make_interval(mins => v_policy.min_notice_minutes)
     or p_starts > now() + make_interval(days => v_policy.horizon_days + 1)
     or not app_private.slot_is_open(p_staff_id, p_starts, p_ends, v_policy.time_zone) then
    raise exception 'that time is not available' using errcode = 'invalid_parameter_value';
  end if;

  if p_replaces is not null then
    select * into v_old from public.appointments
     where id = p_replaces and lead_id = p_lead.id and status = 'booked' for update;
    if not found then
      raise exception 'appointment not found' using errcode = 'no_data_found';
    end if;
    update public.appointments set status = 'cancelled', updated_at = now() where id = v_old.id;
    v_previous_stage := coalesce(v_old.previous_stage, p_lead.stage);
  end if;

  insert into public.appointments (lead_id, staff_id, industry, starts_at, ends_at, booked_via, previous_stage,
                                   replaces_appointment_id)
  values (p_lead.id, p_staff_id, p_lead.industry, p_starts, p_ends, p_via, v_previous_stage, p_replaces)
  returning id into v_id;

  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead.id, case when p_replaces is null then 'appointment.booked' else 'appointment.rescheduled' end,
          p_actor_type, p_actor_id,
          jsonb_build_object('appointment_id', v_id, 'staff_id', p_staff_id, 'starts_at', p_starts, 'via', p_via));

  if p_lead.assigned_staff_id is null then
    update public.leads set assigned_staff_id = p_staff_id where id = p_lead.id;
    insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
    values (p_lead.id, 'lead.assigned', p_actor_type, p_actor_id,
            jsonb_build_object('from_staff_id', null, 'to_staff_id', p_staff_id, 'method', 'booking'));
  end if;

  return jsonb_build_object('appointment_id', v_id, 'starts_at', p_starts, 'staff_id', p_staff_id)
    || app_private.apply_stage_change(p_lead, v_policy.booked_stage, p_plan, 'appointment_booked',
                                      p_actor_type, p_actor_id, p_actor_type = 'staff');
end;
$$;

-- Cancels an upcoming appointment. A lead still in the booked stage goes back
-- to the stage it was in before booking (p_plan is that stage's plan).
create or replace function app_private.cancel_appointment(
  p_lead public.leads,
  p_appointment_id uuid,
  p_plan jsonb,
  p_actor_type text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.booking_policies := app_private.booking_policy(p_lead.industry);
  v_appointment public.appointments;
begin
  select * into v_appointment from public.appointments
   where id = p_appointment_id and lead_id = p_lead.id and status = 'booked' for update;
  if not found then
    raise exception 'appointment not found' using errcode = 'no_data_found';
  end if;
  update public.appointments set status = 'cancelled', updated_at = now() where id = v_appointment.id;
  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead.id, 'appointment.cancelled', p_actor_type, p_actor_id,
          jsonb_build_object('appointment_id', v_appointment.id, 'staff_id', v_appointment.staff_id));
  if p_lead.stage = v_policy.booked_stage and v_appointment.previous_stage is not null
     and exists (select 1 from public.industry_stages s
                 where s.industry = p_lead.industry and s.stage_id = v_appointment.previous_stage) then
    return jsonb_build_object('appointment_id', v_appointment.id)
      || app_private.apply_stage_change(p_lead, v_appointment.previous_stage, p_plan, 'appointment_cancelled',
                                        p_actor_type, p_actor_id, false);
  end if;
  return jsonb_build_object('appointment_id', v_appointment.id, 'changed', false);
end;
$$;

-- Marks a past appointment attended or missed and moves the lead to the
-- pack's attended or no-show stage (which enrols the no-show recovery sequence).
create or replace function app_private.close_appointment(
  p_appointment public.appointments,
  p_status text,
  p_plan jsonb,
  p_actor_type text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_policy public.booking_policies := app_private.booking_policy(p_appointment.industry);
begin
  if p_status not in ('attended', 'no_show') then
    raise exception 'invalid status' using errcode = 'invalid_parameter_value';
  end if;
  if p_appointment.status <> 'booked' then
    raise exception 'this appointment is already closed' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_appointment.starts_at > now() then
    raise exception 'this appointment has not started yet' using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.appointments set status = p_status, updated_at = now() where id = p_appointment.id;
  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_appointment.lead_id, 'appointment.' || p_status, p_actor_type, p_actor_id,
          jsonb_build_object('appointment_id', p_appointment.id, 'staff_id', p_appointment.staff_id));
  select * into v_lead from public.leads where id = p_appointment.lead_id for update;
  return jsonb_build_object('appointment_id', p_appointment.id, 'status', p_status)
    || app_private.apply_stage_change(v_lead,
         case p_status when 'attended' then v_policy.attended_stage else v_policy.no_show_stage end,
         p_plan, 'appointment_' || p_status, p_actor_type, p_actor_id, false);
end;
$$;

-- Bookable staff of an industry with their calendars between two dates: the
-- weekly template, exceptions and busy times (no lead data at all).
create or replace function app_private.calendar(p_industry text, p_staff_ids uuid[], p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'staff_id', s.id,
    'full_name', s.full_name,
    'title', s.title,
    'specialties', to_jsonb(s.specialties),
    'languages', to_jsonb(s.languages),
    'locations', to_jsonb(s.locations),
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', r.weekday, 'start', to_char(r.start_time, 'HH24:MI'),
                                          'end', to_char(r.end_time, 'HH24:MI')) order by r.weekday)
      from public.availability_rules r where r.staff_id = s.id), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'date', x.on_date, 'kind', x.kind, 'reason', x.reason,
                                          'start', to_char(x.start_time, 'HH24:MI'), 'end', to_char(x.end_time, 'HH24:MI'))
                       order by x.on_date, x.start_time)
      from public.availability_exceptions x
      where x.staff_id = s.id and x.on_date between p_from and p_to), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('start', a.starts_at, 'end', a.ends_at) order by a.starts_at)
      from public.appointments a
      where a.staff_id = s.id and a.status <> 'cancelled'
        and a.ends_at >= p_from::timestamptz - interval '1 day' and a.starts_at <= p_to::timestamptz + interval '2 days'),
      '[]'::jsonb)
  ) order by s.full_name), '[]'::jsonb)
  from public.staff s
  join public.booking_policies p on p.industry = s.industry
  where s.industry = p_industry and s.active and s.role = any (p.bookable_roles)
    and (p_staff_ids is null or s.id = any (p_staff_ids))
    and p_to >= p_from and p_to - p_from <= 62
$$;

-- ---------------------------------------------------------------------------
-- The website (web_submitter): the lead's signed booking link
-- ---------------------------------------------------------------------------

-- What the booking page needs about a lead: no personal data.
create or replace function public.booking_context(p_lead_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lead_id', l.id,
    'industry', l.industry,
    'stage', l.stage,
    'specialty_slug', l.specialty_slug,
    'preferred_language', l.preferred_language,
    'assigned_staff_id', l.assigned_staff_id,
    'active_sequences', coalesce((
      select jsonb_agg(e.sequence_id) from public.sequence_enrollments e
      where e.lead_id = l.id and e.status = 'active'), '[]'::jsonb),
    'appointment', (
      select jsonb_build_object('id', a.id, 'staff_id', a.staff_id, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
                                'previous_stage', a.previous_stage)
      from public.appointments a where a.lead_id = l.id and a.status = 'booked')
  )
  from public.leads l
  where l.id = p_lead_id and l.erased_at is null and l.lead_type = 'individual'
$$;

create or replace function public.booking_calendar(p_industry text, p_staff_ids uuid[], p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.calendar(p_industry, p_staff_ids, p_from, p_to)
$$;

create or replace function public.book_appointment_public(
  p_lead_id uuid,
  p_staff_id uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_plan jsonb,
  p_replaces uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  select * into v_lead from public.leads where id = p_lead_id and lead_type = 'individual' for update;
  if not found then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  return app_private.place_appointment(v_lead, p_staff_id, p_starts, p_ends, 'website', p_plan, p_replaces, 'lead', null);
end;
$$;

create or replace function public.cancel_appointment_public(p_lead_id uuid, p_appointment_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  select * into v_lead from public.leads where id = p_lead_id and lead_type = 'individual' for update;
  if not found then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  return app_private.cancel_appointment(v_lead, p_appointment_id, p_plan, 'lead', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff (CRM, under RLS)
-- ---------------------------------------------------------------------------

-- Who may act on a bookable staff member's calendar: the front desk and
-- managers for anyone in their industry, a bookable person for themselves.
create or replace function app_private.calendar_owner(p_staff_id uuid)
returns public.staff
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor public.staff := app_private.acting_staff();
  v_target public.staff;
  v_policy public.booking_policies := app_private.booking_policy(v_actor.industry);
begin
  select * into v_target from public.staff
   where id = p_staff_id and active and industry = v_actor.industry and role = any (v_policy.bookable_roles);
  if not found then
    raise exception 'this person does not take bookings' using errcode = 'invalid_parameter_value';
  end if;
  if v_actor.role not in ('manager', 'care_coordinator') and v_actor.id <> v_target.id then
    raise exception 'you may not do this' using errcode = 'insufficient_privilege';
  end if;
  return v_target;
end;
$$;

create or replace function public.staff_calendar(p_staff_ids uuid[], p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor public.staff := app_private.acting_staff();
begin
  return app_private.calendar(v_actor.industry, p_staff_ids, p_from, p_to);
end;
$$;

create or replace function public.book_appointment(
  p_lead_id uuid,
  p_staff_id uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_plan jsonb,
  p_replaces uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff := app_private.acting_staff(array['manager', 'care_coordinator', 'specialist_doctor']);
  v_lead public.leads := app_private.visible_lead(p_lead_id);
begin
  -- Experts book only into their own calendar; the front desk into anyone's.
  if v_actor.role = 'specialist_doctor' and v_actor.id <> p_staff_id then
    raise exception 'you may not do this' using errcode = 'insufficient_privilege';
  end if;
  return app_private.place_appointment(v_lead, p_staff_id, p_starts, p_ends, 'staff', p_plan, p_replaces, 'staff', v_actor.id);
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff := app_private.acting_staff(array['manager', 'care_coordinator', 'specialist_doctor']);
  v_appointment public.appointments;
  v_lead public.leads;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment not found' using errcode = 'no_data_found';
  end if;
  v_lead := app_private.visible_lead(v_appointment.lead_id);
  if v_actor.role = 'specialist_doctor' and v_actor.id <> v_appointment.staff_id then
    raise exception 'you may not do this' using errcode = 'insufficient_privilege';
  end if;
  return app_private.cancel_appointment(v_lead, p_appointment_id, p_plan, 'staff', v_actor.id);
end;
$$;

create or replace function public.mark_appointment(p_appointment_id uuid, p_status text, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff := app_private.acting_staff(array['manager', 'care_coordinator', 'specialist_doctor']);
  v_appointment public.appointments;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'appointment not found' using errcode = 'no_data_found';
  end if;
  perform app_private.visible_lead(v_appointment.lead_id);
  if v_actor.role = 'specialist_doctor' and v_actor.id <> v_appointment.staff_id then
    raise exception 'you may not do this' using errcode = 'insufficient_privilege';
  end if;
  return app_private.close_appointment(v_appointment, p_status, p_plan, 'staff', v_actor.id);
end;
$$;

-- Replaces a staff member's weekly template: [{"weekday": 1, "start": "09:30", "end": "17:30"}, …].
create or replace function public.set_availability(p_staff_id uuid, p_rules jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.staff := app_private.calendar_owner(p_staff_id);
  v_count integer;
begin
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 7 then
    raise exception 'invalid availability' using errcode = 'invalid_parameter_value';
  end if;
  delete from public.availability_rules where staff_id = v_target.id;
  insert into public.availability_rules (staff_id, weekday, start_time, end_time)
  select v_target.id, (r ->> 'weekday')::smallint, (r ->> 'start')::time, (r ->> 'end')::time
  from jsonb_array_elements(p_rules) r;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.add_availability_exception(
  p_staff_id uuid,
  p_date date,
  p_kind text,
  p_start time,
  p_end time,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff := app_private.acting_staff();
  v_target public.staff := app_private.calendar_owner(p_staff_id);
  v_id uuid;
begin
  perform app_private.assert_code(p_reason, 'reason');
  if p_date < current_date - 1 or p_date > current_date + 366 then
    raise exception 'choose a date within the next year' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.availability_exceptions (staff_id, on_date, kind, start_time, end_time, reason, created_by_staff_id)
  values (v_target.id, p_date, p_kind, p_start, p_end, p_reason, v_actor.id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_availability_exception(p_exception_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
begin
  select staff_id into v_staff_id from public.availability_exceptions where id = p_exception_id;
  if v_staff_id is null then
    return false;
  end if;
  perform app_private.calendar_owner(v_staff_id);
  delete from public.availability_exceptions where id = p_exception_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The worker: appointments nobody closed become no-shows after a grace period
-- ---------------------------------------------------------------------------

-- Appointments still 'booked' that ended over p_grace ago, with what the worker
-- needs to plan the no-show stage (the lead's industry and active sequences).
create or replace function public.overdue_appointments(p_grace interval, p_limit integer default 50)
returns table (appointment_id uuid, lead_id uuid, industry text, active_sequences text[])
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.lead_id, a.industry,
         coalesce(array(select e.sequence_id from public.sequence_enrollments e
                        where e.lead_id = a.lead_id and e.status = 'active'), '{}')
  from public.appointments a join public.leads l on l.id = a.lead_id
  where a.status = 'booked' and a.ends_at < now() - p_grace and l.erased_at is null
  order by a.ends_at
  limit least(greatest(p_limit, 1), 200)
$$;

create or replace function public.record_no_show(p_appointment_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id and status = 'booked' for update;
  if not found then
    return jsonb_build_object('changed', false);
  end if;
  return app_private.close_appointment(v_appointment, 'no_show', p_plan, 'system', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema app_private from public, anon, authenticated, service_role;

revoke execute on function
  public.booking_context(uuid),
  public.booking_calendar(text, uuid[], date, date),
  public.book_appointment_public(uuid, uuid, timestamptz, timestamptz, jsonb, uuid),
  public.cancel_appointment_public(uuid, uuid, jsonb),
  public.staff_calendar(uuid[], date, date),
  public.book_appointment(uuid, uuid, timestamptz, timestamptz, jsonb, uuid),
  public.cancel_appointment(uuid, jsonb),
  public.mark_appointment(uuid, text, jsonb),
  public.set_availability(uuid, jsonb),
  public.add_availability_exception(uuid, date, text, time, time, text),
  public.remove_availability_exception(uuid),
  public.overdue_appointments(interval, integer),
  public.record_no_show(uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.booking_context(uuid),
  public.booking_calendar(text, uuid[], date, date),
  public.book_appointment_public(uuid, uuid, timestamptz, timestamptz, jsonb, uuid),
  public.cancel_appointment_public(uuid, uuid, jsonb)
to web_submitter, service_role;

grant execute on function
  public.staff_calendar(uuid[], date, date),
  public.book_appointment(uuid, uuid, timestamptz, timestamptz, jsonb, uuid),
  public.cancel_appointment(uuid, jsonb),
  public.mark_appointment(uuid, text, jsonb),
  public.set_availability(uuid, jsonb),
  public.add_availability_exception(uuid, date, text, time, time, text),
  public.remove_availability_exception(uuid)
to authenticated, service_role;

grant execute on function
  public.overdue_appointments(interval, integer),
  public.record_no_show(uuid, jsonb)
to nurture_worker, service_role;
