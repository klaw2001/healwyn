-- Phase 3: a browser call that falls back to typed chat finishes as a typed chat.
-- record_voice_call now stores the channel the call actually ended on, so usage
-- (LiveKit minutes count only browser and phone calls) reflects what ran.

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
         channel = p_call ->> 'channel',
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

revoke execute on function public.record_voice_call(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_voice_call(jsonb, jsonb) to service_role, crm_server;
