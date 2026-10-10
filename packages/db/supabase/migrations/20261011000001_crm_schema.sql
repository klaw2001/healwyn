-- Phase 2: CRM schema. Staff roles and sign-in, notes, tasks, messages,
-- nurture enrolments and their schedule, lead scores, sequence settings.
-- Row level security and grants for these tables are in 20261011000002.

-- ---------------------------------------------------------------------------
-- Staff: permission role and link to Supabase Auth
-- ---------------------------------------------------------------------------

alter table public.staff add column role text;
update public.staff
   set role = case level
                when 'care_coordinator' then 'care_coordinator'
                when 'billing_desk' then 'billing_desk'
                else 'specialist_doctor'
              end;
alter table public.staff
  alter column role set not null,
  add constraint staff_role_check check (role in ('manager', 'care_coordinator', 'specialist_doctor', 'billing_desk')),
  add constraint staff_auth_user_fk foreign key (auth_user_id) references auth.users (id) on delete set null;

comment on column public.staff.role is 'Permission role (packages/core/src/permissions.ts). level is the clinical seniority.';

-- ---------------------------------------------------------------------------
-- Leads: response and engagement timestamps
-- ---------------------------------------------------------------------------

alter table public.leads
  add column first_response_at timestamptz,
  add column last_inbound_at timestamptz,
  add column opted_out_at timestamptz,
  -- Set from the industry pack's billing rule (clinic: has insurance). The
  -- billing desk sees these leads; Phase 3 routing copies the desk in.
  add column billing_flag boolean not null default false;

update public.leads set billing_flag = coalesce(answers ->> 'has_insurance', '') = 'yes';

comment on column public.leads.first_response_at is 'First staff action on the lead; drives the first-response SLA.';
comment on column public.leads.opted_out_at is 'Unsubscribed from nurture messages. Data is kept; consent is unchanged.';

-- ---------------------------------------------------------------------------
-- Notes and tasks
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  author_staff_id uuid references public.staff (id) on delete set null,
  template_id text check (char_length(template_id) <= 100),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index notes_lead_idx on public.notes (lead_id, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  assignee_staff_id uuid references public.staff (id) on delete set null,
  created_by_staff_id uuid references public.staff (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  due_at timestamptz not null,
  remind_at timestamptz,
  completed_at timestamptz,
  completed_by_staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tasks_assignee_due_idx on public.tasks (assignee_staff_id, due_at) where completed_at is null;
create index tasks_lead_idx on public.tasks (lead_id, due_at);

-- ---------------------------------------------------------------------------
-- Nurture: enrolments, the schedule, and every message sent or received
-- ---------------------------------------------------------------------------

create table public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  industry text not null default 'clinic',
  sequence_id text not null check (sequence_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  stop_reason text check (stop_reason in ('replied', 'opted_out', 'consent_withdrawn', 'lead_erased', 'stage_changed', 'manual')),
  enrolled_by_staff_id uuid references public.staff (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint sequence_enrollments_stop_reason check ((status = 'stopped') = (stop_reason is not null))
);

-- One active enrolment per lead and sequence.
create unique index sequence_enrollments_one_active on public.sequence_enrollments (lead_id, sequence_id) where status = 'active';
create index sequence_enrollments_sequence_idx on public.sequence_enrollments (sequence_id, status);

create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.sequence_enrollments (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  sequence_id text not null,
  step_index integer not null check (step_index >= 0),
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  template_id text not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'skipped', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  locked_at timestamptz,
  processed_at timestamptz,
  skip_reason text,
  last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  unique (enrollment_id, step_index)
);

comment on table public.scheduled_messages is 'The nurture schedule. Claimed by the worker with FOR UPDATE SKIP LOCKED; each row sends at most once.';

create index scheduled_messages_due_idx on public.scheduled_messages (due_at) where status = 'pending';
create index scheduled_messages_lead_idx on public.scheduled_messages (lead_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  direction text not null check (direction in ('outbound', 'inbound')),
  -- sent: delivered to the provider; simulated: SMS/WhatsApp in the demo;
  -- logged: email printed to the console because no provider is configured;
  -- failed: provider error; received: inbound reply.
  status text not null check (status in ('sent', 'simulated', 'logged', 'failed', 'received')),
  template_id text,
  subject text check (char_length(subject) <= 300),
  body text check (char_length(body) <= 5000),
  scheduled_message_id uuid unique references public.scheduled_messages (id) on delete set null,
  enrollment_id uuid references public.sequence_enrollments (id) on delete set null,
  provider_message_id text,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now()
);

comment on column public.messages.scheduled_message_id is 'Unique: a scheduled step can produce at most one message, even if a worker retries.';

create index messages_lead_idx on public.messages (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Scores and sequence settings
-- ---------------------------------------------------------------------------

create table public.lead_scores (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  band text not null check (band in ('hot', 'warm', 'cool')),
  factors jsonb not null default '[]'::jsonb check (jsonb_typeof(factors) = 'array'),
  computed_at timestamptz not null default now()
);

create table public.sequence_settings (
  industry text not null default 'clinic',
  sequence_id text not null,
  paused boolean not null default false,
  updated_by_staff_id uuid references public.staff (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (industry, sequence_id)
);

comment on table public.sequence_settings is 'Per-sequence switches. A paused sequence keeps its schedule; nothing is sent until resumed.';
