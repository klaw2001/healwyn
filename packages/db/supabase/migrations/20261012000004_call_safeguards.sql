-- Phase 3 security review fixes.
--
-- 1. Call rules live in SQL (call_policies, written from the industry pack by the
--    seed). Callers no longer pass them, so a staff member calling the RPC
--    directly cannot name another consent, skip the call window or raise the cap.
-- 2. Separate daily caps per group (website, phone, simulated) and a per-phone
--    cap for website calls, so one visitor cannot use up the dialer's calls.
-- 3. A browser call may fall back to typed chat once (use_text_fallback); a late
--    result from the voice agent for that call is then ignored ("superseded").
-- 4. Calls the CRM cannot accept are marked failed instead of staying started.
-- 5. The audit trail keeps codes only: red-flag categories and routing
--    explanation text move out of lead_events (to call_sessions and
--    assignment_explanations, both scrubbed by erasure).
-- 6. "no_consent": the caller never clearly agreed; nothing is withdrawn.

-- ---------------------------------------------------------------------------
-- Call outcomes and statuses
-- ---------------------------------------------------------------------------

alter table public.call_sessions drop constraint call_sessions_outcome_check;
alter table public.call_sessions add constraint call_sessions_outcome_check check (
  outcome in ('completed', 'consent_declined', 'no_consent', 'emergency', 'caller_ended', 'limit_reached', 'error')
);
alter table public.call_sessions drop constraint call_sessions_status_check;
alter table public.call_sessions add constraint call_sessions_status_check check (
  status in ('started', 'completed', 'failed')
);
alter table public.call_sessions add column fallback_at timestamptz;

-- ---------------------------------------------------------------------------
-- Call policies (one row per industry and channel)
-- ---------------------------------------------------------------------------

create table public.call_policies (
  industry text not null check (industry ~ '^[a-z][a-z0-9_]{0,39}$'),
  channel text not null check (channel in ('browser', 'phone', 'simulated', 'text')),
  -- Calls in the same group share one daily cap (across industries: one provider account).
  cap_group text not null check (cap_group in ('website', 'phone', 'simulated')),
  consent_purpose text not null check (consent_purpose ~ '^[a-z][a-z0-9_]{0,39}$'),
  max_per_day integer not null check (max_per_day between 0 and 10000),
  max_per_phone_per_day integer check (max_per_phone_per_day between 1 and 100),
  outbound boolean not null,
  window_start integer check (window_start between 0 and 23),
  window_end integer check (window_end between 1 and 24),
  time_zone text not null default 'Asia/Kolkata' check (char_length(time_zone) <= 64),
  require_verified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (industry, channel),
  check ((window_start is null) = (window_end is null) and (window_start is null or window_start < window_end))
);

comment on table public.call_policies is 'Who the assistant may call and how often, per industry pack and channel. Written by the seed from the pack.';

alter table public.call_policies enable row level security;
revoke all on table public.call_policies from anon, authenticated;
grant select, insert, update, delete on table public.call_policies to service_role;
revoke truncate, trigger, references on public.call_policies from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Starting a call
-- Returns {"allowed": true, "call_id": …} or {"allowed": false, "reason": "<code>"}.
-- ---------------------------------------------------------------------------

drop function public.start_web_call(uuid, text, jsonb);
drop function public.place_assistant_call(uuid, text, jsonb);
drop function app_private.start_call(uuid, text, jsonb, text, uuid);

create or replace function app_private.start_call(
  p_lead_id uuid,
  p_channel text,
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
  v_policy public.call_policies;
  v_local timestamp;
  v_today_start timestamptz;
  v_calls integer := 0;
  v_reason text;
  v_call_id uuid;
begin
  if p_channel not in ('browser', 'phone', 'simulated', 'text') then
    raise exception 'unknown channel' using errcode = 'invalid_parameter_value';
  end if;
  -- Serialise starts so the daily caps hold under concurrency.
  perform pg_advisory_xact_lock(hashtext('healwyn:start_call'));

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  select * into v_policy from public.call_policies where industry = v_lead.industry and channel = p_channel;

  if found then
    v_local := now() at time zone v_policy.time_zone;
    v_today_start := date_trunc('day', v_local) at time zone v_policy.time_zone;
    select count(*) into v_calls
      from public.call_sessions s
     where s.started_at >= v_today_start
       and s.channel in (select p.channel from public.call_policies p
                          where p.cap_group = v_policy.cap_group);
  end if;

  if v_policy.channel is null then
    v_reason := 'not_configured';
  elsif v_lead.erased_at is not null then
    v_reason := 'erased';
  elsif v_lead.opted_out_at is not null then
    v_reason := 'opted_out';
  elsif not exists (
    select 1 from public.current_consents c
    where c.lead_id = p_lead_id and c.purpose = v_policy.consent_purpose and c.granted
  ) then
    v_reason := 'no_call_consent';
  elsif v_policy.window_start is not null
        and not (extract(hour from v_local) >= v_policy.window_start
                 and extract(hour from v_local) < v_policy.window_end) then
    v_reason := 'outside_call_window';
  elsif v_policy.outbound and v_lead.phone is null then
    v_reason := 'no_phone';
  elsif v_policy.require_verified
        and not exists (select 1 from public.verified_demo_numbers n where n.phone = v_lead.phone) then
    v_reason := 'number_not_verified';
  elsif v_calls >= v_policy.max_per_day then
    v_reason := 'daily_limit';
  elsif v_policy.max_per_phone_per_day is not null and v_lead.phone is not null and (
    select count(*) from public.call_sessions s join public.leads l on l.id = s.lead_id
     where l.phone = v_lead.phone and s.started_at >= v_today_start
       and s.channel in (select p.channel from public.call_policies p where p.cap_group = v_policy.cap_group)
  ) >= v_policy.max_per_phone_per_day then
    v_reason := 'phone_daily_limit';
  end if;

  if v_reason is not null then
    if v_lead.erased_at is null then
      insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
      values (p_lead_id, 'call.refused', p_actor_type, p_actor_id,
              jsonb_build_object('channel', p_channel, 'reason', v_reason));
    end if;
    return jsonb_build_object('allowed', false, 'reason', v_reason, 'calls_today', v_calls);
  end if;

  v_call_id := gen_random_uuid();
  insert into public.call_sessions (id, lead_id, channel, started_by_staff_id)
  values (v_call_id, p_lead_id, p_channel, case when p_actor_type = 'staff' then p_actor_id end);
  insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
  values (p_lead_id, 'call.started', p_actor_type, p_actor_id,
          jsonb_build_object('call_id', v_call_id, 'channel', p_channel));
  return jsonb_build_object('allowed', true, 'call_id', v_call_id, 'calls_today', v_calls + 1);
end;
$$;

-- The website's widget: the visitor starts a browser or typed call on their own lead.
create or replace function public.start_web_call(p_lead_id uuid, p_channel text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_channel not in ('browser', 'text') then
    raise exception 'the website starts browser or typed calls only' using errcode = 'invalid_parameter_value';
  end if;
  return app_private.start_call(p_lead_id, p_channel, 'lead', null);
end;
$$;

-- The CRM's dialer: front desk staff place an outbound assistant call.
create or replace function public.place_assistant_call(p_lead_id uuid, p_channel text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager', 'care_coordinator']);
  v_lead public.leads := app_private.visible_lead(p_lead_id);
begin
  if p_channel not in ('phone', 'simulated') then
    raise exception 'the dialer places phone or simulated calls only' using errcode = 'invalid_parameter_value';
  end if;
  return app_private.start_call(v_lead.id, p_channel, 'staff', v_staff.id);
end;
$$;

-- A browser call that could not connect continues as a typed chat, once, within 20 minutes.
create or replace function public.use_text_fallback(p_call_id uuid, p_lead_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.call_sessions
     set channel = 'text', fallback_at = now()
   where id = p_call_id and lead_id = p_lead_id
     and status = 'started' and channel = 'browser' and fallback_at is null
     and started_at > now() - interval '20 minutes';
  if not found then
    return false;
  end if;
  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'call.fallback', 'lead', jsonb_build_object('call_id', p_call_id, 'channel', 'text'));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recording a call (now: channel must match, superseded results ignored,
-- and the audit trail gets codes without health categories)
-- ---------------------------------------------------------------------------

create or replace function public.record_voice_call(p_call jsonb, p_update jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_call_id uuid := (p_call ->> 'callId')::uuid;
  v_lead_id uuid := (p_call ->> 'leadId')::uuid;
  v_session public.call_sessions;
  v_lead public.leads;
  v_flag jsonb;
  v_red boolean := false;
  v_rank jsonb := '{"low": 0, "normal": 1, "high": 2, "urgent": 3}';
  v_urgency text;
begin
  select * into v_session from public.call_sessions where id = v_call_id for update;
  if not found or v_session.lead_id <> v_lead_id then
    raise exception 'unknown call' using errcode = 'no_data_found';
  end if;
  if v_session.status <> 'started' then
    return jsonb_build_object('status', 'duplicate', 'lead_id', v_lead_id);
  end if;
  if v_session.channel is distinct from p_call ->> 'channel' then
    -- The browser call fell back to typed chat: the typed chat's result counts, not the agent's.
    if v_session.channel = 'text' and p_call ->> 'channel' = 'browser' then
      return jsonb_build_object('status', 'superseded', 'lead_id', v_lead_id);
    end if;
    raise exception 'channel does not match the call' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_lead from public.leads where id = v_lead_id for update;
  if v_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;

  for v_flag in select * from jsonb_array_elements(coalesce(p_call -> 'safetyFlags', '[]'::jsonb)) loop
    perform app_private.assert_code(v_flag ->> 'code', 'flag');
    v_red := v_red or v_flag ->> 'kind' = 'red_flag';
  end loop;

  update public.call_sessions
     set status = 'completed',
         started_at = (p_call ->> 'startedAt')::timestamptz,
         ended_at = (p_call ->> 'endedAt')::timestamptz,
         duration_seconds = (p_call ->> 'durationSeconds')::int,
         language = p_call ->> 'language',
         consent_to_continue = (p_call ->> 'consentToContinue')::boolean,
         outcome = p_call ->> 'outcome',
         urgency = p_call ->> 'urgency',
         answers = coalesce(p_update -> 'answers', '{}'::jsonb),
         safety_flags = coalesce(p_call -> 'safetyFlags', '[]'::jsonb),
         summary = coalesce((select array_agg(value) from jsonb_array_elements_text(p_call -> 'summary')), '{}'),
         transcript = coalesce(p_call -> 'transcript', '[]'::jsonb),
         usage = coalesce(p_call -> 'usage', '{}'::jsonb),
         agent_version = p_call ->> 'agentVersion',
         completed_at = now()
   where id = v_call_id;

  -- The higher of the lead's urgency and the call's.
  v_urgency := case when (v_rank ->> (p_update ->> 'urgency'))::int > (v_rank ->> v_lead.urgency)::int
                    then p_update ->> 'urgency' else v_lead.urgency end;

  update public.leads
     set answers = answers || coalesce(p_update -> 'answers', '{}'::jsonb),
         specialty_slug = case when p_update ? 'specialty_slug' then p_update ->> 'specialty_slug' else specialty_slug end,
         billing_flag = coalesce((p_update ->> 'billing_flag')::boolean, billing_flag),
         urgency = v_urgency,
         preferred_language = coalesce(p_update ->> 'preferred_language', preferred_language),
         message = coalesce(message, nullif(p_update ->> 'message', ''))
   where id = v_lead_id;

  -- Codes and counts only: which red flag it was stays in call_sessions (scrubbed by erasure).
  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (v_lead_id, 'call.completed', 'system', jsonb_build_object(
    'call_id', v_call_id,
    'channel', v_session.channel,
    'outcome', p_call ->> 'outcome',
    'duration_seconds', (p_call ->> 'durationSeconds')::int,
    'language', p_call ->> 'language',
    'flag_count', jsonb_array_length(coalesce(p_call -> 'safetyFlags', '[]'::jsonb))
  ));
  if v_red then
    insert into public.lead_events (lead_id, type, actor_type, payload)
    values (v_lead_id, 'safety.flagged', 'system', jsonb_build_object('call_id', v_call_id, 'kind', 'red_flag'));
  end if;

  if p_update ? 'withdraw_purpose' and exists (
    select 1 from public.current_consents c
    where c.lead_id = v_lead_id and c.purpose = p_update ->> 'withdraw_purpose' and c.granted
  ) then
    perform public.withdraw_consent(v_lead_id, p_update ->> 'withdraw_purpose', 'voice_call', false);
  end if;

  select * into v_lead from public.leads where id = v_lead_id;
  return jsonb_build_object(
    'status', 'recorded', 'lead_id', v_lead_id, 'stage', v_lead.stage,
    'assigned_staff_id', v_lead.assigned_staff_id, 'urgency', v_lead.urgency,
    'opted_out', v_lead.opted_out_at is not null,
    'active_sequences', coalesce((
      select jsonb_agg(e.sequence_id order by e.sequence_id) from public.sequence_enrollments e
      where e.lead_id = v_lead_id and e.status = 'active'
    ), '[]'::jsonb)
  );
end;
$$;

-- A result the CRM cannot accept (it does not fit the pack): the call is closed as failed.
create or replace function public.fail_voice_call(p_call_id uuid, p_lead_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.assert_code(p_code, 'failure code');
  update public.call_sessions
     set status = 'failed', outcome = 'error', ended_at = coalesce(ended_at, now()), completed_at = now()
   where id = p_call_id and lead_id = p_lead_id and status = 'started';
  if not found then
    return false;
  end if;
  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'call.failed', 'system', jsonb_build_object('call_id', p_call_id, 'code', p_code));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Routing explanations: text out of the append-only audit trail
-- ---------------------------------------------------------------------------

create table public.assignment_explanations (
  event_id bigint primary key references public.lead_events (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  lines text[] not null check (cardinality(lines) <= 40)
);

comment on table public.assignment_explanations is 'Why a lead went to someone, in words. Deleted by erasure; the lead.assigned event keeps codes and ids.';

create index assignment_explanations_lead_idx on public.assignment_explanations (lead_id);

alter table public.assignment_explanations enable row level security;
create policy assignment_explanations_staff_read on public.assignment_explanations
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
revoke all on table public.assignment_explanations from anon, authenticated;
grant select on table public.assignment_explanations to authenticated;
grant select, insert, update, delete on table public.assignment_explanations to service_role;
revoke truncate, trigger, references on public.assignment_explanations from anon, authenticated, service_role;

-- p_routing = {"method", "explanation": [text], "override_reason", "pool", "priority",
--              "copy_in": [{"staff_id", "reason"}], "candidates": [{"staff_id", "total", "excluded"}]}
-- Everything except the explanation must be a code, an id or a number.
create or replace function app_private.routing_codes(p_routing jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_item jsonb;
begin
  if p_routing is null then
    return null;
  end if;
  if jsonb_typeof(p_routing) <> 'object' or octet_length(p_routing::text) > 16000 then
    raise exception 'routing details must be a small object' using errcode = 'invalid_parameter_value';
  end if;
  for v_key in select jsonb_object_keys(p_routing) loop
    if v_key not in ('method', 'explanation', 'override_reason', 'pool', 'priority', 'copy_in', 'candidates') then
      raise exception 'unexpected routing detail %', v_key using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if p_routing ? 'override_reason' then perform app_private.assert_code(p_routing ->> 'override_reason', 'override reason'); end if;
  if coalesce(p_routing ->> 'pool', 'specialty') not in ('specialty', 'fallback')
     or coalesce(p_routing ->> 'priority', 'normal') not in ('front', 'normal') then
    raise exception 'unknown routing pool or priority' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(coalesce(p_routing -> 'explanation', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_routing -> 'explanation', '[]'::jsonb)) > 40
     or exists (select 1 from jsonb_array_elements(coalesce(p_routing -> 'explanation', '[]'::jsonb)) e
                where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') > 300) then
    raise exception 'the explanation must be up to 40 short lines' using errcode = 'invalid_parameter_value';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_routing -> 'copy_in', '[]'::jsonb)) loop
    if (select count(*) from jsonb_object_keys(v_item) k where k not in ('staff_id', 'reason')) > 0 then
      raise exception 'unexpected copy-in detail' using errcode = 'invalid_parameter_value';
    end if;
    perform (v_item ->> 'staff_id')::uuid;
    perform app_private.assert_code(v_item ->> 'reason', 'copy-in reason');
  end loop;
  if jsonb_array_length(coalesce(p_routing -> 'candidates', '[]'::jsonb)) > 100 then
    raise exception 'too many candidates' using errcode = 'invalid_parameter_value';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_routing -> 'candidates', '[]'::jsonb)) loop
    if (select count(*) from jsonb_object_keys(v_item) k where k not in ('staff_id', 'total', 'excluded')) > 0
       or jsonb_typeof(v_item -> 'total') <> 'number' then
      raise exception 'unexpected candidate detail' using errcode = 'invalid_parameter_value';
    end if;
    perform (v_item ->> 'staff_id')::uuid;
    if v_item ? 'excluded' then perform app_private.assert_code(v_item ->> 'excluded', 'exclusion'); end if;
  end loop;
  return p_routing - 'explanation';
end;
$$;

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
  v_codes jsonb := app_private.routing_codes(p_routing);
  v_copy jsonb;
  v_task_id uuid;
  v_event_id bigint;
  v_due timestamptz := now() + interval '1 day';
begin
  perform app_private.assert_code(p_reason, 'reason');
  if v_method not in ('manual', 'override', 'routing') then
    raise exception 'unknown assignment method' using errcode = 'invalid_parameter_value';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff where id = p_staff_id and active and industry = p_lead.industry
  ) then
    raise exception 'that staff member is not active' using errcode = 'invalid_parameter_value';
  end if;

  if p_lead.assigned_staff_id is distinct from p_staff_id then
    update public.leads set assigned_staff_id = p_staff_id where id = p_lead.id;
    insert into public.lead_events (lead_id, type, actor_type, actor_id, payload)
    values (p_lead.id, 'lead.assigned', p_actor_type, p_actor_id,
            jsonb_build_object('from_staff_id', p_lead.assigned_staff_id, 'to_staff_id', p_staff_id,
                               'reason', p_reason, 'method', v_method)
            || case when v_codes is null then '{}'::jsonb else jsonb_build_object('routing', v_codes) end)
    returning id into v_event_id;
    if jsonb_array_length(coalesce(p_routing -> 'explanation', '[]'::jsonb)) > 0 then
      insert into public.assignment_explanations (event_id, lead_id, lines)
      values (v_event_id, p_lead.id,
              array(select jsonb_array_elements_text(p_routing -> 'explanation')));
    end if;
  end if;

  -- Copy-ins become a task for that person, once per lead and person.
  for v_copy in select * from jsonb_array_elements(coalesce(p_routing -> 'copy_in', '[]'::jsonb)) loop
    if not exists (
      select 1 from public.staff where id = (v_copy ->> 'staff_id')::uuid and active and industry = p_lead.industry
    ) then
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

-- ---------------------------------------------------------------------------
-- Erasure: also red-flag details and routing explanations
-- ---------------------------------------------------------------------------

create or replace function public.erase_lead(p_lead_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reason !~ '^[a-z0-9_.:-]{1,64}$' then
    raise exception 'reason must be a short code, not free text' using errcode = 'invalid_parameter_value';
  end if;

  update public.leads
     set full_name = null,
         phone = null,
         email = null,
         message = null,
         answers = '{}'::jsonb,
         erased_at = now(),
         erasure_reason = p_reason
   where id = p_lead_id
     and erased_at is null;

  if not found then
    return false;
  end if;

  delete from public.notes where lead_id = p_lead_id;
  delete from public.tasks where lead_id = p_lead_id;
  delete from public.assignment_explanations where lead_id = p_lead_id;
  update public.messages set subject = null, body = null where lead_id = p_lead_id;
  update public.call_sessions
     set answers = '{}'::jsonb, summary = '{}', transcript = '[]'::jsonb, safety_flags = '[]'::jsonb
   where lead_id = p_lead_id;
  perform app_private.stop_enrollments(p_lead_id, 'lead_erased');

  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'lead.erased', 'system', jsonb_build_object('reason', p_reason));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema app_private from public, anon, authenticated, service_role;

revoke execute on function
  public.start_web_call(uuid, text),
  public.place_assistant_call(uuid, text),
  public.use_text_fallback(uuid, uuid),
  public.record_voice_call(jsonb, jsonb),
  public.fail_voice_call(uuid, uuid, text),
  public.erase_lead(uuid, text)
from public, anon, authenticated;

grant execute on function public.place_assistant_call(uuid, text) to authenticated;
grant execute on function public.start_web_call(uuid, text), public.use_text_fallback(uuid, uuid) to web_submitter;
grant execute on function public.record_voice_call(jsonb, jsonb), public.fail_voice_call(uuid, uuid, text)
  to crm_server;
grant execute on function
  public.start_web_call(uuid, text),
  public.place_assistant_call(uuid, text),
  public.use_text_fallback(uuid, uuid),
  public.record_voice_call(jsonb, jsonb),
  public.fail_voice_call(uuid, uuid, text),
  public.erase_lead(uuid, text)
to service_role;
