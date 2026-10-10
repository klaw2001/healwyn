-- Core schema: specialties, staff, leads, consent records, lead events and
-- rate limits. Row level security is switched on for every table in
-- 20261010000003_security.sql. Everything here is synthetic demo data.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Append-only guard for audit tables. Rows can never be updated, and can only
-- disappear together with their lead (an ON DELETE CASCADE from public.leads).
create or replace function public.prevent_audit_change()
returns trigger
language plpgsql
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

-- ---------------------------------------------------------------------------
-- Specialties (offerings). Content lives in packages/core; this table mirrors
-- the slugs so leads and staff can reference them.
-- ---------------------------------------------------------------------------

create table public.specialties (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  industry text not null default 'clinic',
  name text not null check (char_length(name) between 1 and 100),
  summary text not null default '' check (char_length(summary) <= 500),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.specialties is 'Offerings a lead can be routed to (specialties for the clinic pack).';

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  industry text not null default 'clinic',
  full_name text not null check (char_length(full_name) between 1 and 100),
  title text not null default '' check (char_length(title) <= 150),
  level text not null check (level ~ '^[a-z]+(_[a-z]+)*$'),
  specialties text[] not null default '{}',
  languages text[] not null default '{en}',
  locations text[] not null default '{}',
  email text unique check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$')),
  capacity integer not null default 20 check (capacity > 0),
  active boolean not null default true,
  is_demo boolean not null default false,
  -- Linked to auth.users in Phase 2 (staff sign-in).
  auth_user_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff is 'People leads are routed to. level is a staff-level id from the industry pack.';
comment on column public.staff.capacity is 'Open leads this person can hold; used by routing in Phase 3.';

create index staff_specialties_idx on public.staff using gin (specialties);
create index staff_active_level_idx on public.staff (level) where active;

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  industry text not null default 'clinic',
  lead_type text not null default 'individual' check (lead_type in ('individual', 'partner')),
  source text not null check (source in ('web_form', 'partner_form', 'voice', 'phone', 'staff', 'seed')),
  -- A stage id from the industry pack (validated by the app, which knows the pack).
  stage text not null default 'new' check (stage ~ '^[a-z]+(_[a-z]+)*$'),
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high', 'urgent')),

  -- Personal data. Cleared by public.erase_lead() when consent is withdrawn.
  full_name text check (char_length(full_name) between 1 and 100),
  phone text check (phone ~ '^\+91[6-9][0-9]{9}$'),
  email text check (char_length(email) <= 254),
  -- Free text from the enquiry. Never copied into logs, emails or lead_events.
  message text check (char_length(message) <= 2000),
  -- Qualifying answers keyed by question id from the industry pack.
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),

  preferred_language text not null default 'en' check (preferred_language ~ '^[a-z]{2,3}$'),
  specialty_slug text references public.specialties (slug) on update cascade on delete set null,
  assigned_staff_id uuid references public.staff (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  erased_at timestamptz,
  erasure_reason text check (char_length(erasure_reason) <= 200),

  constraint leads_personal_data_present
    check (erased_at is not null or (full_name is not null and phone is not null)),
  constraint leads_erased_rows_hold_no_personal_data
    check (erased_at is null or (full_name is null and phone is null and email is null
                                 and message is null and answers = '{}'::jsonb))
);

comment on table public.leads is 'Every enquiry. Personal data is erased in place (erase_lead) so funnel metrics survive deletion.';

create index leads_stage_created_idx on public.leads (stage, created_at desc);
create index leads_created_idx on public.leads (created_at desc);
create index leads_assigned_staff_idx on public.leads (assigned_staff_id) where assigned_staff_id is not null;
create index leads_phone_idx on public.leads (phone) where erased_at is null;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Consent records (append-only): what was agreed, which wording, when.
-- A withdrawal is a new row with granted = false.
-- ---------------------------------------------------------------------------

create table public.consent_records (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  purpose text not null check (purpose ~ '^[a-z]+(_[a-z]+)*$'),
  granted boolean not null,
  text_version text not null check (char_length(text_version) between 1 and 100),
  -- SHA-256 of the exact wording shown. Null for withdrawals.
  text_hash text check (text_hash ~ '^[0-9a-f]{64}$'),
  source text not null check (char_length(source) between 1 and 50),
  recorded_at timestamptz not null default now()
);

comment on table public.consent_records is 'Append-only consent ledger. The latest row per (lead_id, purpose) is the current state.';

create index consent_records_lead_purpose_idx on public.consent_records (lead_id, purpose, recorded_at desc, id desc);

create trigger consent_records_append_only
  before update or delete on public.consent_records
  for each row execute function public.prevent_audit_change();

create view public.current_consents
with (security_invoker = true) as
select distinct on (lead_id, purpose)
  lead_id,
  purpose,
  granted,
  text_version,
  recorded_at
from public.consent_records
order by lead_id, purpose, recorded_at desc, id desc;

comment on view public.current_consents is 'Current consent state per lead and purpose.';

-- ---------------------------------------------------------------------------
-- Lead events (append-only audit of everything that happens to a lead).
-- Payloads must never contain personal data or free text.
-- ---------------------------------------------------------------------------

create table public.lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null check (type ~ '^[a-z]+(_[a-z]+)*(\.[a-z]+(_[a-z]+)*)+$'),
  actor_type text not null default 'system' check (actor_type in ('system', 'staff', 'assistant', 'lead')),
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

comment on table public.lead_events is 'Append-only lead history, e.g. lead.created, stage.changed, consent.withdrawn.';

create index lead_events_lead_created_idx on public.lead_events (lead_id, created_at, id);

create trigger lead_events_append_only
  before update or delete on public.lead_events
  for each row execute function public.prevent_audit_change();

-- ---------------------------------------------------------------------------
-- Rate limits for public form endpoints. Keys are salted hashes, never raw IPs.
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  key text not null check (char_length(key) between 1 and 128),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (key, window_start)
);

comment on table public.rate_limits is 'Fixed-window counters for form submissions. Rows older than a day are pruned.';
