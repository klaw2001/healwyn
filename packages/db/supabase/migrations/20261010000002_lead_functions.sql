-- Server-side operations on leads. Each runs in one transaction, so a lead is
-- never stored without its consent records and audit events. Execute rights
-- are restricted to the service role in 20261010000003_security.sql.

-- Creates a lead with its consent evidence and audit events.
-- payload matches NewLeadPayload in packages/core/src/leads.ts.
create or replace function public.submit_lead(payload jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_source text := payload ->> 'source';
  v_lead_type text := coalesce(payload ->> 'leadType', 'individual');
  v_stage text := coalesce(payload ->> 'stage', 'new');
begin
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'payload must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(payload -> 'consents') is distinct from 'array'
     or jsonb_array_length(payload -> 'consents') = 0 then
    raise exception 'consent evidence is required' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(payload -> 'consents') as c
    where (c ->> 'granted')::boolean
  ) then
    raise exception 'a lead cannot be stored without consent' using errcode = 'invalid_parameter_value';
  end if;
  if payload -> 'answers' is not null and jsonb_typeof(payload -> 'answers') <> 'object' then
    raise exception 'answers must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.leads (
    industry, lead_type, source, stage, full_name, phone, email, preferred_language,
    specialty_slug, message, answers, is_demo
  ) values (
    coalesce(payload ->> 'industry', 'clinic'),
    v_lead_type,
    v_source,
    v_stage,
    payload ->> 'fullName',
    payload ->> 'phone',
    nullif(payload ->> 'email', ''),
    coalesce(payload ->> 'preferredLanguage', 'en'),
    nullif(payload ->> 'specialtySlug', ''),
    nullif(payload ->> 'message', ''),
    coalesce(payload -> 'answers', '{}'::jsonb),
    coalesce((payload ->> 'isDemo')::boolean, false)
  )
  returning id into v_lead_id;

  insert into public.consent_records (lead_id, purpose, granted, text_version, text_hash, source)
  select v_lead_id, c ->> 'purpose', (c ->> 'granted')::boolean, c ->> 'textVersion', c ->> 'textHash', v_source
  from jsonb_array_elements(payload -> 'consents') as c;

  insert into public.lead_events (lead_id, type, actor_type, payload)
  values
    (v_lead_id, 'lead.created', 'lead',
     jsonb_build_object('source', v_source, 'lead_type', v_lead_type, 'stage', v_stage)),
    (v_lead_id, 'consent.recorded', 'lead',
     jsonb_build_object('purposes', (
       select jsonb_object_agg(c ->> 'purpose', (c ->> 'granted')::boolean)
       from jsonb_array_elements(payload -> 'consents') as c
     )));

  return v_lead_id;
end;
$$;

comment on function public.submit_lead(jsonb) is 'Creates a lead, its consent records and lead.created / consent.recorded events in one transaction.';

-- Erases a lead's personal data in place (DPDP). The row, its consent ledger
-- and its event history remain, holding no personal data, so audit and funnel
-- metrics survive. Returns false if the lead was already erased or not found.
create or replace function public.erase_lead(p_lead_id uuid, p_reason text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.leads
     set full_name = null,
         phone = null,
         email = null,
         message = null,
         answers = '{}'::jsonb,
         erased_at = now(),
         erasure_reason = left(p_reason, 200)
   where id = p_lead_id
     and erased_at is null;

  if not found then
    return false;
  end if;

  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'lead.erased', 'system', jsonb_build_object('reason', left(p_reason, 200)));
  return true;
end;
$$;

comment on function public.erase_lead(uuid, text) is 'Removes personal data from a lead and records lead.erased.';

-- Records a consent withdrawal and, when p_erase is true (the pack marks the
-- consent as required for storing data), erases the lead's personal data.
create or replace function public.withdraw_consent(
  p_lead_id uuid,
  p_purpose text,
  p_source text,
  p_erase boolean
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.leads where id = p_lead_id) then
    raise exception 'lead % not found', p_lead_id using errcode = 'no_data_found';
  end if;

  insert into public.consent_records (lead_id, purpose, granted, text_version, text_hash, source)
  values (p_lead_id, p_purpose, false, 'withdrawal', null, p_source);

  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'consent.withdrawn', 'lead',
          jsonb_build_object('purpose', p_purpose, 'source', p_source, 'erase', p_erase));

  if p_erase then
    perform public.erase_lead(p_lead_id, 'consent_withdrawn:' || p_purpose);
  end if;
end;
$$;

comment on function public.withdraw_consent(uuid, text, text, boolean) is 'Appends a withdrawal to the consent ledger and optionally erases personal data.';

-- Fixed-window rate limiter. Returns true when the call is allowed.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'limit and window must be positive' using errcode = 'invalid_parameter_value';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup keeps the table small without a scheduler.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

comment on function public.hit_rate_limit(text, integer, integer) is 'Counts a hit for a hashed key and reports whether it is within the limit.';
