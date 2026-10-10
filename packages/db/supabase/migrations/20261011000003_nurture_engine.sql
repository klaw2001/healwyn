-- Phase 2: nurture engine, unsubscribe and replies, retention, sign-in, and
-- least-privilege roles for the CRM server and the worker.

-- ---------------------------------------------------------------------------
-- Consent records remember which consents were required to store the lead
-- ---------------------------------------------------------------------------

alter table public.consent_records add column required boolean not null default false;
-- Appending a column is not "changing history": backfill without the trigger.
alter table public.consent_records disable trigger consent_records_append_only;
update public.consent_records set required = purpose in ('contact', 'partner_contact') where granted;
alter table public.consent_records enable trigger consent_records_append_only;

-- True while no consent that was required to store the lead has been withdrawn.
create or replace function app_private.has_required_consent(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.consent_records w
    where w.lead_id = p_lead_id and not w.granted
      and w.purpose in (select r.purpose from public.consent_records r where r.lead_id = p_lead_id and r.required)
  )
$$;

-- ---------------------------------------------------------------------------
-- submit_lead: billing flag and the first nurture plan, in the same transaction
-- ---------------------------------------------------------------------------

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
  v_industry text := coalesce(payload ->> 'industry', 'clinic');
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
    industry, lead_type, source, stage, urgency, full_name, phone, email, preferred_language,
    specialty_slug, message, answers, billing_flag, is_demo
  ) values (
    v_industry,
    v_lead_type,
    v_source,
    v_stage,
    coalesce(payload ->> 'urgency', 'normal'),
    payload ->> 'fullName',
    payload ->> 'phone',
    nullif(payload ->> 'email', ''),
    coalesce(payload ->> 'preferredLanguage', 'en'),
    nullif(payload ->> 'specialtySlug', ''),
    nullif(payload ->> 'message', ''),
    coalesce(payload -> 'answers', '{}'::jsonb),
    coalesce((payload ->> 'billingFlag')::boolean, false),
    coalesce((payload ->> 'isDemo')::boolean, false)
  )
  returning id into v_lead_id;

  insert into public.consent_records (lead_id, purpose, granted, required, text_version, text_hash, source)
  select v_lead_id, c ->> 'purpose', (c ->> 'granted')::boolean, coalesce((c ->> 'required')::boolean, false),
         c ->> 'textVersion', c ->> 'textHash', v_source
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

  perform app_private.apply_sequence_plan(v_lead_id, payload -> 'sequencePlan', v_industry, null);

  return v_lead_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- erase_lead: also clears staff notes, tasks and message bodies, and stops
-- every sequence. Event history, consent ledger and message metadata remain.
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
  perform app_private.stop_enrollments(p_lead_id, 'lead_erased');

  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'lead.erased', 'system', jsonb_build_object('reason', p_reason));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unsubscribe (from the link in every email) and inbound replies
-- ---------------------------------------------------------------------------

create or replace function public.opt_out_lead(p_lead_id uuid, p_source text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.assert_code(p_source, 'source');
  update public.leads set opted_out_at = now() where id = p_lead_id and opted_out_at is null and erased_at is null;
  if not found then
    return false;
  end if;
  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'lead.opted_out', 'lead', jsonb_build_object('source', p_source));
  perform app_private.stop_enrollments(p_lead_id, 'opted_out');
  return true;
end;
$$;

create or replace function public.record_inbound_message(p_lead_id uuid, p_channel text, p_body text, p_source text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_id uuid;
begin
  perform app_private.assert_code(p_source, 'source');
  if not exists (select 1 from public.leads where id = p_lead_id and erased_at is null) then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  insert into public.messages (lead_id, channel, direction, status, body)
  values (p_lead_id, p_channel, 'inbound', 'received', left(p_body, 5000))
  returning id into v_message_id;
  update public.leads set last_inbound_at = now() where id = p_lead_id;
  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'message.received', 'lead', jsonb_build_object('channel', p_channel, 'source', p_source));
  perform app_private.stop_enrollments(p_lead_id, 'replied');
  return v_message_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- The worker: claim due steps safely under concurrency, then finish each one.
-- ---------------------------------------------------------------------------

create or replace function public.claim_due_messages(p_limit integer default 50, p_stale_after interval default '15 minutes')
returns table (
  id uuid,
  lead_id uuid,
  enrollment_id uuid,
  industry text,
  sequence_id text,
  step_index integer,
  channel text,
  template_id text,
  attempts integer,
  enrollment_status text,
  lead_stage text,
  full_name text,
  email text,
  phone text,
  specialty_slug text,
  opted_out boolean,
  erased boolean,
  contact_consent boolean,
  replied boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rows stuck in 'processing' (a worker died mid-send) become due again.
  -- Sends are idempotent downstream: one message per step (unique), and the
  -- email provider gets the step id as its idempotency key.
  update public.scheduled_messages s
     set status = 'pending', locked_at = null
   where s.status = 'processing' and s.locked_at < now() - p_stale_after;

  delete from public.rate_limits where window_start < now() - interval '1 day';

  return query
  with due as (
    select s.id
      from public.scheduled_messages s
      join public.sequence_enrollments e on e.id = s.enrollment_id
     where s.status = 'pending'
       and s.due_at <= now()
       and not exists (
         select 1 from public.sequence_settings ss
          where ss.industry = e.industry and ss.sequence_id = s.sequence_id and ss.paused
       )
     order by s.due_at, s.id
     limit p_limit
     for update of s skip locked
  ),
  claimed as (
    update public.scheduled_messages s
       set status = 'processing', locked_at = now(), attempts = s.attempts + 1
      from due
     where s.id = due.id
    returning s.*
  )
  select c.id, c.lead_id, c.enrollment_id, e.industry, c.sequence_id, c.step_index, c.channel, c.template_id,
         c.attempts, e.status, l.stage, l.full_name, l.email, l.phone, l.specialty_slug,
         l.opted_out_at is not null, l.erased_at is not null,
         app_private.has_required_consent(l.id),
         coalesce(l.last_inbound_at > e.enrolled_at, false)
    from claimed c
    join public.sequence_enrollments e on e.id = c.enrollment_id
    join public.leads l on l.id = c.lead_id;
end;
$$;

-- p_outcome: 'sent' (p_message describes the message), 'skipped' (p_detail is
-- the stop reason), or 'retry' (p_detail is a short error; fails after 3 tries).
create or replace function public.finish_scheduled_message(
  p_id uuid,
  p_outcome text,
  p_message jsonb default null,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step public.scheduled_messages;
begin
  select * into v_step from public.scheduled_messages where id = p_id and status = 'processing' for update;
  if not found then
    return; -- already finished by another worker, or cancelled meanwhile
  end if;

  if p_outcome = 'sent' then
    insert into public.messages (lead_id, channel, direction, status, template_id, subject, body,
                                 scheduled_message_id, enrollment_id, provider_message_id, error)
    values (v_step.lead_id, v_step.channel, 'outbound', p_message ->> 'status', v_step.template_id,
            p_message ->> 'subject', p_message ->> 'body', v_step.id, v_step.enrollment_id,
            p_message ->> 'providerMessageId', left(p_message ->> 'error', 500))
    on conflict (scheduled_message_id) do nothing;

    update public.scheduled_messages set status = 'done', processed_at = now(), locked_at = null where id = p_id;

    insert into public.lead_events (lead_id, type, actor_type, payload)
    values (v_step.lead_id, 'message.sent', 'system',
            jsonb_build_object('channel', v_step.channel, 'status', p_message ->> 'status',
                               'template_id', v_step.template_id, 'sequence_id', v_step.sequence_id));

    update public.sequence_enrollments e
       set status = 'completed', ended_at = now()
     where e.id = v_step.enrollment_id and e.status = 'active'
       and not exists (
         select 1 from public.scheduled_messages s
          where s.enrollment_id = e.id and s.status in ('pending', 'processing')
       );
  elsif p_outcome = 'skipped' then
    update public.scheduled_messages
       set status = 'skipped', skip_reason = p_detail, processed_at = now(), locked_at = null
     where id = p_id;
    if p_detail in ('replied', 'opted_out', 'consent_withdrawn', 'lead_erased', 'stage_changed', 'manual') then
      perform app_private.stop_enrollments(v_step.lead_id, p_detail, array[v_step.sequence_id]);
    end if;
  elsif p_outcome = 'retry' then
    if v_step.attempts >= 3 then
      update public.scheduled_messages
         set status = 'failed', last_error = left(p_detail, 500), processed_at = now(), locked_at = null
       where id = p_id;
      insert into public.lead_events (lead_id, type, actor_type, payload)
      values (v_step.lead_id, 'message.failed', 'system',
              jsonb_build_object('channel', v_step.channel, 'template_id', v_step.template_id));
    else
      update public.scheduled_messages
         set status = 'pending', last_error = left(p_detail, 500), locked_at = null,
             due_at = now() + make_interval(mins => 5 * v_step.attempts)
       where id = p_id;
    end if;
  else
    raise exception 'unknown outcome %', p_outcome using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- Retention promised in the privacy notice: erase leads with no activity for
-- p_months months. Run by the worker; returns how many were erased.
create or replace function public.purge_stale_leads(p_months integer default 12)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_count integer := 0;
begin
  for v_lead_id in
    select l.id
      from public.leads l
     where l.erased_at is null
       and greatest(
             l.updated_at,
             coalesce((select max(ev.created_at) from public.lead_events ev where ev.lead_id = l.id), l.created_at)
           ) < now() - make_interval(months => p_months)
  loop
    if public.erase_lead(v_lead_id, 'retention_expired') then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff sign-in against Supabase Auth's users table (local and Supabase alike)
-- ---------------------------------------------------------------------------

create or replace function public.verify_staff_password(p_email text, p_password text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
    from auth.users u
    join public.staff s on s.auth_user_id = u.id and s.active
   where lower(u.email) = lower(btrim(p_email))
     and u.encrypted_password is not null
     and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)
$$;

-- The signed-in staff member for a session (used to build the session).
create or replace function public.staff_for_auth_user(p_auth_user_id uuid)
returns table (staff_id uuid, full_name text, role text, title text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.role, s.title, s.email from public.staff s where s.auth_user_id = p_auth_user_id and s.active
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema app_private from public, anon, authenticated, service_role;

revoke execute on function
  public.submit_lead(jsonb),
  public.erase_lead(uuid, text),
  public.opt_out_lead(uuid, text),
  public.record_inbound_message(uuid, text, text, text),
  public.claim_due_messages(integer, interval),
  public.finish_scheduled_message(uuid, text, jsonb, text),
  public.purge_stale_leads(integer),
  public.verify_staff_password(text, text),
  public.staff_for_auth_user(uuid)
from public, anon, authenticated;

grant execute on function
  public.submit_lead(jsonb),
  public.erase_lead(uuid, text),
  public.opt_out_lead(uuid, text),
  public.record_inbound_message(uuid, text, text, text),
  public.claim_due_messages(integer, interval),
  public.finish_scheduled_message(uuid, text, jsonb, text),
  public.purge_stale_leads(integer),
  public.verify_staff_password(text, text),
  public.staff_for_auth_user(uuid)
to service_role;

-- The website may also unsubscribe people (the link in every email).
grant execute on function public.opt_out_lead(uuid, text) to web_submitter;

-- nurture_worker: runs the schedule and the retention purge, nothing else.
do $$
begin
  if not exists (select from pg_roles where rolname = 'nurture_worker') then
    create role nurture_worker nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'crm_server') then
    create role crm_server nologin;
  end if;
end
$$;

grant usage on schema public to nurture_worker, crm_server;
grant execute on function
  public.claim_due_messages(integer, interval),
  public.finish_scheduled_message(uuid, text, jsonb, text),
  public.purge_stale_leads(integer)
to nurture_worker;

-- crm_server: the CRM's server connection. It signs staff in, receives reply
-- webhooks, runs the worker endpoint, and (as a member of `authenticated`,
-- granted outside migrations) acts as the signed-in staff member under RLS.
grant nurture_worker to crm_server;
grant execute on function
  public.verify_staff_password(text, text),
  public.staff_for_auth_user(uuid),
  public.record_inbound_message(uuid, text, text, text)
to crm_server;

comment on role nurture_worker is 'Runs the nurture schedule and retention purge.';
comment on role crm_server is 'CRM server connection. Also needs: grant authenticated to <login role> (see README).';
