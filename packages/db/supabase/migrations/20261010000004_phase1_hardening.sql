-- Phase 1 hardening, from the end-of-phase review.
--
-- 1. The audit trigger's "is the lead gone?" check runs as the owner, so row
--    security can never make a visible event look orphaned.
-- 2. Audit tables cannot be truncated (TRUNCATE skips row triggers).
-- 3. API roles lose TRUNCATE, TRIGGER and REFERENCES everywhere.
-- 4. Rate-limit rows older than a day are pruned on every call, as the
--    privacy notice promises.
-- 5. submit_lead rejects a lead unless every consent marked required is granted.
-- 6. Reasons and sources written into audit payloads must be short codes,
--    never free text.
-- 7. A least-privilege role for the public website: it can only execute the
--    two functions a form submission needs. Create a login role in it and use
--    that for WEB_DATABASE_URL instead of the owner (see README).

-- 1 -------------------------------------------------------------------------
create or replace function public.prevent_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.leads where id = old.lead_id) then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name
    using errcode = 'insufficient_privilege',
          hint = 'Insert a new row instead of changing history.';
end;
$$;

-- 2 -------------------------------------------------------------------------
create or replace function public.prevent_audit_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only and cannot be truncated', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger lead_events_no_truncate
  before truncate on public.lead_events
  for each statement execute function public.prevent_audit_truncate();

create trigger consent_records_no_truncate
  before truncate on public.consent_records
  for each statement execute function public.prevent_audit_truncate();

-- 3 -------------------------------------------------------------------------
revoke truncate, trigger, references on all tables in schema public from anon, authenticated, service_role;
revoke execute on function public.prevent_audit_truncate() from public, anon, authenticated, service_role;

-- 4 -------------------------------------------------------------------------
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
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

  delete from public.rate_limits where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

-- 5 -------------------------------------------------------------------------
create or replace function public.submit_lead(payload jsonb)
returns uuid
language plpgsql
security definer
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
    where coalesce((c ->> 'required')::boolean, false)
  ) then
    raise exception 'consent evidence must mark the consent required to store data' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from jsonb_array_elements(payload -> 'consents') as c
    where coalesce((c ->> 'required')::boolean, false) and not coalesce((c ->> 'granted')::boolean, false)
  ) then
    raise exception 'a lead cannot be stored without its required consent' using errcode = 'invalid_parameter_value';
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

-- 6 -------------------------------------------------------------------------
create or replace function public.erase_lead(p_lead_id uuid, p_reason text)
returns boolean
language plpgsql
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

  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'lead.erased', 'system', jsonb_build_object('reason', p_reason));
  return true;
end;
$$;

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
  if p_source !~ '^[a-z0-9_.:-]{1,64}$' then
    raise exception 'source must be a short code, not free text' using errcode = 'invalid_parameter_value';
  end if;
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

-- The functions were re-created: re-apply their grants.
revoke execute on function
  public.submit_lead(jsonb),
  public.erase_lead(uuid, text),
  public.withdraw_consent(uuid, text, text, boolean),
  public.hit_rate_limit(text, integer, integer),
  public.prevent_audit_change()
from public, anon, authenticated;

grant execute on function
  public.submit_lead(jsonb),
  public.erase_lead(uuid, text),
  public.withdraw_consent(uuid, text, text, boolean),
  public.hit_rate_limit(text, integer, integer)
to service_role;

-- 7 -------------------------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'web_submitter') then
    create role web_submitter nologin;
  end if;
end
$$;

comment on role web_submitter is 'Public website: may only execute submit_lead and hit_rate_limit. Grant it to a login role for WEB_DATABASE_URL.';

grant usage on schema public to web_submitter;
grant execute on function public.submit_lead(jsonb), public.hit_rate_limit(text, integer, integer) to web_submitter;
