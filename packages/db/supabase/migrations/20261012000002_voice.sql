-- Phase 3: the voice assistant's data.
--
-- call_sessions: one row per assistant call (browser, phone, simulated dialer
-- or typed chat). The row is created when a call starts (so the daily cap
-- counts it) and completed by the signed webhook from the agent. Transcripts
-- and summaries live only here, under RLS, and are scrubbed by erasure.
--
-- Pack-specific values (the call-consent purpose, the call window, the cap,
-- the stage a call moves a lead to) are passed in by the TypeScript callers.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.call_sessions (
  id uuid primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  channel text not null check (channel in ('browser', 'phone', 'simulated', 'text')),
  status text not null default 'started' check (status in ('started', 'completed')),
  started_by_staff_id uuid references public.staff (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds between 0 and 7200),
  language text check (language ~ '^[a-z]{2}$'),
  consent_to_continue boolean,
  outcome text check (outcome in ('completed', 'consent_declined', 'emergency', 'caller_ended', 'limit_reached', 'error')),
  urgency text check (urgency in ('low', 'normal', 'high', 'urgent')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  safety_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(safety_flags) = 'array'),
  summary text[] not null default '{}' check (cardinality(summary) <= 5),
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  usage jsonb not null default '{}'::jsonb check (jsonb_typeof(usage) = 'object'),
  agent_version text check (char_length(agent_version) <= 40),
  completed_at timestamptz,
  check (status = 'started' or (outcome is not null and completed_at is not null))
);

comment on table public.call_sessions is 'Assistant calls. Transcripts and summaries live only here (RLS), never in logs.';

create index call_sessions_lead_idx on public.call_sessions (lead_id, started_at desc);
create index call_sessions_started_idx on public.call_sessions (started_at);

-- Numbers a trial telephony account may call (a Twilio trial can only call verified numbers).
create table public.verified_demo_numbers (
  phone text primary key check (phone ~ '^\+91[6-9][0-9]{9}$'),
  label text not null check (char_length(label) between 1 and 60 and label ~ '^[A-Za-z0-9 .,()''-]+$'),
  added_by_staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.call_sessions enable row level security;
alter table public.verified_demo_numbers enable row level security;

create policy call_sessions_staff_read on public.call_sessions
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy verified_demo_numbers_front_desk_read on public.verified_demo_numbers
  for select to authenticated using (public.current_staff_role() in ('manager', 'care_coordinator'));

revoke all on table public.call_sessions, public.verified_demo_numbers from anon, authenticated;
grant select on table public.call_sessions, public.verified_demo_numbers to authenticated;
grant select, insert, update, delete on table public.call_sessions, public.verified_demo_numbers to service_role;
revoke truncate, trigger, references on public.call_sessions, public.verified_demo_numbers from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Starting a call: consent, opt-out, call window, verified numbers, daily cap.
-- p_rules = {"consent_purpose": "assistant_call", "max_per_day": 50,
--            "window_start": 9, "window_end": 21, "time_zone": "Asia/Kolkata",
--            "outbound": true, "require_verified": false}
-- Returns {"allowed": true, "call_id": …} or {"allowed": false, "reason": "<code>"}.
-- Every refusal is written to the lead's audit trail with its reason.
-- ---------------------------------------------------------------------------

create or replace function app_private.start_call(
  p_lead_id uuid,
  p_channel text,
  p_rules jsonb,
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
  v_tz text := coalesce(p_rules ->> 'time_zone', 'Asia/Kolkata');
  v_local timestamp := now() at time zone coalesce(p_rules ->> 'time_zone', 'Asia/Kolkata');
  v_today_start timestamptz;
  v_calls integer;
  v_reason text;
  v_call_id uuid;
begin
  if p_channel not in ('browser', 'phone', 'simulated', 'text') then
    raise exception 'unknown channel' using errcode = 'invalid_parameter_value';
  end if;
  -- Serialise starts so the daily cap holds under concurrency.
  perform pg_advisory_xact_lock(hashtext('healwyn:start_call'));

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;

  v_today_start := date_trunc('day', v_local) at time zone v_tz;
  select count(*) into v_calls from public.call_sessions where started_at >= v_today_start;

  if v_lead.erased_at is not null then
    v_reason := 'erased';
  elsif v_lead.opted_out_at is not null then
    v_reason := 'opted_out';
  elsif not exists (
    select 1 from public.current_consents c
    where c.lead_id = p_lead_id and c.purpose = p_rules ->> 'consent_purpose' and c.granted
  ) then
    v_reason := 'no_call_consent';
  elsif coalesce((p_rules ->> 'outbound')::boolean, false)
        and not (extract(hour from v_local) >= (p_rules ->> 'window_start')::int
                 and extract(hour from v_local) < (p_rules ->> 'window_end')::int) then
    v_reason := 'outside_call_window';
  elsif coalesce((p_rules ->> 'outbound')::boolean, false) and v_lead.phone is null then
    v_reason := 'no_phone';
  elsif coalesce((p_rules ->> 'require_verified')::boolean, false)
        and not exists (select 1 from public.verified_demo_numbers n where n.phone = v_lead.phone) then
    v_reason := 'number_not_verified';
  elsif v_calls >= coalesce((p_rules ->> 'max_per_day')::int, 0) then
    v_reason := 'daily_limit';
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
create or replace function public.start_web_call(p_lead_id uuid, p_channel text, p_rules jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_channel not in ('browser', 'text') then
    raise exception 'the website starts browser or typed calls only' using errcode = 'invalid_parameter_value';
  end if;
  return app_private.start_call(p_lead_id, p_channel, p_rules || '{"outbound": false, "require_verified": false}', 'lead', null);
end;
$$;

-- The CRM's dialer: front desk staff place an outbound assistant call.
create or replace function public.place_assistant_call(p_lead_id uuid, p_channel text, p_rules jsonb)
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
  return app_private.start_call(v_lead.id, p_channel, p_rules || '{"outbound": true}', 'staff', v_staff.id);
end;
$$;

create or replace function public.add_verified_number(p_phone text, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager']);
begin
  insert into public.verified_demo_numbers (phone, label, added_by_staff_id)
  values (p_phone, btrim(p_label), v_staff.id)
  on conflict (phone) do update set label = excluded.label;
end;
$$;

create or replace function public.remove_verified_number(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.staff := app_private.acting_staff(array['manager']);
begin
  delete from public.verified_demo_numbers where phone = p_phone;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stage changes, shared by staff and the voice webhook
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
  if p_to_stage !~ '^[a-z]+(_[a-z]+)*$' then
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

-- Same behaviour as before, now through the shared helper.
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
begin
  return app_private.apply_stage_change(v_lead, p_to_stage, p_plan, p_reason, 'staff', v_staff.id, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- The voice webhook (CRM server only)
-- ---------------------------------------------------------------------------

-- Records a finished call. p_call is the validated VoiceCallResult (camelCase,
-- as the agent posts it); p_update holds the lead fields the CRM derived from
-- it with the industry pack: {"answers": {..}, "specialty_slug": "..",
-- "billing_flag": bool, "urgency": "..", "preferred_language": "..",
-- "message": ".." , "withdraw_purpose": ".."}. Replays of a completed call
-- change nothing.
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
  v_rank jsonb := '{"low": 0, "normal": 1, "high": 2, "urgent": 3}';
  v_urgency text;
begin
  select * into v_session from public.call_sessions where id = v_call_id for update;
  if not found or v_session.lead_id <> v_lead_id then
    raise exception 'unknown call' using errcode = 'no_data_found';
  end if;
  if v_session.status = 'completed' then
    return jsonb_build_object('status', 'duplicate', 'lead_id', v_lead_id);
  end if;

  select * into v_lead from public.leads where id = v_lead_id for update;
  if v_lead.erased_at is not null then
    raise exception 'this lead has been erased' using errcode = 'object_not_in_prerequisite_state';
  end if;

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

  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (v_lead_id, 'call.completed', 'system', jsonb_build_object(
    'call_id', v_call_id,
    'channel', v_session.channel,
    'outcome', p_call ->> 'outcome',
    'duration_seconds', (p_call ->> 'durationSeconds')::int,
    'language', p_call ->> 'language',
    'flags', coalesce((select jsonb_agg(f ->> 'code') from jsonb_array_elements(p_call -> 'safetyFlags') f), '[]'::jsonb)
  ));
  for v_flag in select * from jsonb_array_elements(coalesce(p_call -> 'safetyFlags', '[]'::jsonb)) loop
    perform app_private.assert_code(v_flag ->> 'code', 'flag');
    if v_flag ->> 'kind' = 'red_flag' then
      insert into public.lead_events (lead_id, type, actor_type, payload)
      values (v_lead_id, 'safety.flagged', 'system', jsonb_build_object('call_id', v_call_id, 'code', v_flag ->> 'code'));
    end if;
  end loop;

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

-- Applies what the CRM decided after a call: a stage change with its nurture
-- plan, a routing assignment, and an urgent call-back task after a red flag.
create or replace function public.apply_voice_outcome(
  p_lead_id uuid,
  p_call_id uuid,
  p_to_stage text,
  p_plan jsonb,
  p_staff_id uuid,
  p_routing jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_stage jsonb := '{}'::jsonb;
  v_due timestamptz := now();
  v_red boolean;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or v_lead.erased_at is not null then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.call_sessions where id = p_call_id and lead_id = p_lead_id and status = 'completed') then
    raise exception 'unknown call' using errcode = 'no_data_found';
  end if;

  if p_to_stage is not null then
    v_stage := app_private.apply_stage_change(v_lead, p_to_stage, p_plan, 'voice_call', 'system', null, false);
    select * into v_lead from public.leads where id = p_lead_id;
  end if;
  if p_routing is not null then
    perform app_private.apply_assignment(v_lead, p_staff_id, 'routing', p_routing, 'system', null);
    select * into v_lead from public.leads where id = p_lead_id;
  end if;

  select exists (
    select 1 from public.call_sessions s, jsonb_array_elements(s.safety_flags) f
    where s.id = p_call_id and f ->> 'kind' = 'red_flag'
  ) into v_red;
  if v_red and not exists (
    select 1 from public.tasks where lead_id = p_lead_id and completed_at is null and title like 'Urgent:%'
  ) then
    insert into public.tasks (lead_id, assignee_staff_id, title, due_at, remind_at)
    values (p_lead_id, v_lead.assigned_staff_id,
            'Urgent: safety concern on the assistant call. Call back now.', v_due, v_due);
    insert into public.lead_events (lead_id, type, actor_type, payload)
    values (p_lead_id, 'task.created', 'system',
            jsonb_build_object('due_at', v_due, 'assignee_staff_id', v_lead.assigned_staff_id, 'reason', 'safety_flag'));
  end if;

  return jsonb_build_object(
    'stage', v_lead.stage,
    'assigned_staff_id', v_lead.assigned_staff_id,
    -- Inputs for the lead score, which the CRM computes from the pack's rules.
    'score_input', jsonb_build_object(
      'industry', v_lead.industry, 'stage', v_lead.stage, 'urgency', v_lead.urgency,
      'specialty_slug', v_lead.specialty_slug, 'answers', v_lead.answers,
      'has_email', v_lead.email is not null, 'has_message', v_lead.message is not null,
      'created_at', v_lead.created_at, 'replied', v_lead.last_inbound_at is not null,
      'opted_out', v_lead.opted_out_at is not null,
      'consents', coalesce((select jsonb_agg(c.purpose) from public.current_consents c
                            where c.lead_id = p_lead_id and c.granted), '[]'::jsonb)
    )
  ) || v_stage;
end;
$$;

-- Saves the lead score the CRM computed after a call.
create or replace function public.save_call_lead_score(
  p_lead_id uuid,
  p_call_id uuid,
  p_score integer,
  p_band text,
  p_factors jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.call_sessions where id = p_call_id and lead_id = p_lead_id and status = 'completed') then
    raise exception 'unknown call' using errcode = 'no_data_found';
  end if;
  insert into public.lead_scores (lead_id, score, band, factors, computed_at)
  values (p_lead_id, p_score, p_band, p_factors, now())
  on conflict (lead_id) do update
    set score = excluded.score, band = excluded.band, factors = excluded.factors, computed_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Erasure also scrubs call content (rows stay for usage counts).
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
  update public.messages set subject = null, body = null where lead_id = p_lead_id;
  update public.call_sessions
     set answers = '{}'::jsonb, summary = '{}', transcript = '[]'::jsonb
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
  public.start_web_call(uuid, text, jsonb),
  public.place_assistant_call(uuid, text, jsonb),
  public.add_verified_number(text, text),
  public.remove_verified_number(text),
  public.change_lead_stage(uuid, text, jsonb, text),
  public.record_voice_call(jsonb, jsonb),
  public.apply_voice_outcome(uuid, uuid, text, jsonb, uuid, jsonb),
  public.save_call_lead_score(uuid, uuid, integer, text, jsonb),
  public.erase_lead(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.place_assistant_call(uuid, text, jsonb),
  public.add_verified_number(text, text),
  public.remove_verified_number(text),
  public.change_lead_stage(uuid, text, jsonb, text)
to authenticated;

grant execute on function
  public.start_web_call(uuid, text, jsonb),
  public.place_assistant_call(uuid, text, jsonb),
  public.add_verified_number(text, text),
  public.remove_verified_number(text),
  public.change_lead_stage(uuid, text, jsonb, text),
  public.record_voice_call(jsonb, jsonb),
  public.apply_voice_outcome(uuid, uuid, text, jsonb, uuid, jsonb),
  public.save_call_lead_score(uuid, uuid, integer, text, jsonb),
  public.erase_lead(uuid, text)
to service_role;

grant execute on function public.start_web_call(uuid, text, jsonb) to web_submitter;
grant execute on function
  public.record_voice_call(jsonb, jsonb),
  public.apply_voice_outcome(uuid, uuid, text, jsonb, uuid, jsonb),
  public.save_call_lead_score(uuid, uuid, integer, text, jsonb)
to crm_server;
