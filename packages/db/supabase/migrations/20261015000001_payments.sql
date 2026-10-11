-- Phase 4: test-mode payments.
--
-- A lead pays a fee or a package from the pack's `payments.products`, with
-- Razorpay in TEST mode or, when no Razorpay test keys are configured, a
-- simulated provider that goes through the same webhook handling. Live mode is
-- refused everywhere (the apps refuse to start with live keys; `mode` can only
-- be 'test' here).
--
-- `payments` holds one row per checkout attempt (a retry is a new row with a
-- new order). Provider events are recorded once each in `payment_events`
-- (unique provider event id), so a webhook delivered twice changes nothing the
-- second time. A paid payment moves the lead to its pack's won stage (the
-- pack's `payments.paidStageId`) with that stage's nurture plan, in the same
-- transaction. No provider payload is stored: Razorpay payloads carry the
-- payer's email and phone.

create table public.payments (
  id uuid primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  industry text not null,
  product_id text not null check (product_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  amount_paise integer not null check (amount_paise between 100 and 5000000),
  currency text not null default 'INR' check (currency = 'INR'),
  provider text not null check (provider in ('razorpay', 'simulated')),
  mode text not null default 'test' check (mode = 'test'),
  provider_order_id text not null unique check (provider_order_id ~ '^order_[A-Za-z0-9_]{6,40}$'),
  provider_payment_id text check (provider_payment_id ~ '^pay_[A-Za-z0-9_]{6,40}$'),
  status text not null default 'created' check (status in ('created', 'authorized', 'paid', 'failed')),
  failure_code text check (failure_code ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  requested_by text not null check (requested_by in ('lead', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_lead on public.payments (lead_id, created_at desc);
comment on table public.payments is 'Test-mode checkout attempts. One row per order; a retry is a new order.';

create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments (id) on delete cascade,
  provider text not null,
  provider_event_id text not null check (length(provider_event_id) between 6 and 100),
  type text not null check (type ~ '^[a-z_.]{3,40}$'),
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
comment on table public.payment_events is 'Each provider event once (idempotency). Ids and types only, never payloads.';

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
create policy payments_staff_read on public.payments
  for select to authenticated using (exists (select 1 from public.leads l where l.id = lead_id));
create policy payment_events_staff_read on public.payment_events
  for select to authenticated using (exists (select 1 from public.payments p where p.id = payment_id));

revoke all on table public.payments, public.payment_events from anon, authenticated;
grant select on table public.payments, public.payment_events to authenticated;
grant select, insert, update, delete on table public.payments, public.payment_events to service_role;
revoke truncate, trigger, references on public.payments, public.payment_events from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Functions (the website's server, web_submitter)
-- ---------------------------------------------------------------------------

-- Records a new checkout attempt for an order the server just created.
create or replace function public.create_payment(
  p_payment_id uuid,
  p_lead_id uuid,
  p_product_id text,
  p_amount_paise integer,
  p_provider text,
  p_order_id text,
  p_requested_by text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
begin
  select * into v_lead from public.leads
   where id = p_lead_id and lead_type = 'individual' and erased_at is null for update;
  if not found then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;
  insert into public.payments (id, lead_id, industry, product_id, amount_paise, provider, provider_order_id, requested_by)
  values (p_payment_id, p_lead_id, v_lead.industry, p_product_id, p_amount_paise, p_provider, p_order_id, p_requested_by);
  insert into public.lead_events (lead_id, type, actor_type, payload)
  values (p_lead_id, 'payment.created', case p_requested_by when 'staff' then 'staff' else 'lead' end,
          jsonb_build_object('payment_id', p_payment_id, 'product_id', p_product_id, 'amount_paise', p_amount_paise,
                             'provider', p_provider, 'mode', 'test'));
  return p_payment_id;
end;
$$;

-- What the webhook needs to plan the stage change: the payment's lead and industry.
create or replace function public.payment_for_order(p_provider text, p_order_id text)
returns table (payment_id uuid, lead_id uuid, industry text, status text, amount_paise integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.lead_id, p.industry, p.status, p.amount_paise
  from public.payments p where p.provider = p_provider and p.provider_order_id = p_order_id
$$;

-- A lead's payments, for its own payment page (no personal data).
create or replace function public.lead_payments(p_lead_id uuid)
returns table (id uuid, product_id text, amount_paise integer, provider text, status text,
               failure_code text, created_at timestamptz, paid_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.product_id, p.amount_paise, p.provider, p.status, p.failure_code, p.created_at, p.paid_at
  from public.payments p join public.leads l on l.id = p.lead_id
  where p.lead_id = p_lead_id and l.erased_at is null
  order by p.created_at desc
  limit 20
$$;

-- Applies one verified provider event, once. p_status: authorized | paid | failed.
-- p_paid_stage must be a won stage of the lead's industry; p_plan is its plan.
-- Returns {duplicate, status, changed}. A paid payment never goes back.
create or replace function public.record_payment_event(
  p_provider text,
  p_event_id text,
  p_type text,
  p_order_id text,
  p_provider_payment_id text,
  p_status text,
  p_failure_code text,
  p_paid_stage text,
  p_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_lead public.leads;
  v_inserted bigint;
  v_rank jsonb := '{"created": 0, "failed": 1, "authorized": 2, "paid": 3}';
begin
  if p_status not in ('authorized', 'paid', 'failed') then
    raise exception 'invalid status' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_payment from public.payments
   where provider = p_provider and provider_order_id = p_order_id for update;
  if not found then
    raise exception 'payment not found' using errcode = 'no_data_found';
  end if;

  insert into public.payment_events (payment_id, provider, provider_event_id, type)
  values (v_payment.id, p_provider, p_event_id, p_type)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_inserted;
  if v_inserted is null then
    return jsonb_build_object('duplicate', true, 'status', v_payment.status, 'changed', false);
  end if;

  -- Only move forward: created < failed < authorized < paid. A late "failed"
  -- never undoes "paid", while a failed attempt can still be followed by a
  -- successful one on the same order (Razorpay allows several attempts).
  if (v_rank ->> p_status)::int <= (v_rank ->> v_payment.status)::int then
    return jsonb_build_object('duplicate', false, 'status', v_payment.status, 'changed', false);
  end if;

  update public.payments
     set status = p_status,
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         failure_code = case when p_status = 'failed' then coalesce(p_failure_code, 'failed') else null end,
         paid_at = case when p_status = 'paid' then now() else paid_at end,
         updated_at = now()
   where id = v_payment.id;

  if p_status = 'failed' then
    insert into public.lead_events (lead_id, type, actor_type, payload)
    values (v_payment.lead_id, 'payment.failed', 'system',
            jsonb_build_object('payment_id', v_payment.id, 'code', coalesce(p_failure_code, 'failed'), 'mode', 'test'));
  elsif p_status = 'paid' then
    insert into public.lead_events (lead_id, type, actor_type, payload)
    values (v_payment.lead_id, 'payment.paid', 'system',
            jsonb_build_object('payment_id', v_payment.id, 'product_id', v_payment.product_id,
                               'amount_paise', v_payment.amount_paise, 'mode', 'test'));
    select * into v_lead from public.leads where id = v_payment.lead_id for update;
    if v_lead.erased_at is null
       and exists (select 1 from public.industry_stages s
                   where s.industry = v_lead.industry and s.stage_id = p_paid_stage and s.kind = 'won') then
      return jsonb_build_object('duplicate', false, 'status', p_status, 'changed', true)
        || jsonb_build_object('stage', app_private.apply_stage_change(v_lead, p_paid_stage, p_plan, 'payment_received',
                                                                      'system', null, false));
    end if;
  end if;
  return jsonb_build_object('duplicate', false, 'status', p_status, 'changed', true);
end;
$$;

-- Staff (CRM): a lead's payments come through RLS on `payments`; nothing to write.

revoke execute on all functions in schema app_private from public, anon, authenticated, service_role;
revoke execute on function
  public.create_payment(uuid, uuid, text, integer, text, text, text),
  public.payment_for_order(text, text),
  public.lead_payments(uuid),
  public.record_payment_event(text, text, text, text, text, text, text, text, jsonb)
from public, anon, authenticated;
grant execute on function
  public.create_payment(uuid, uuid, text, integer, text, text, text),
  public.payment_for_order(text, text),
  public.lead_payments(uuid),
  public.record_payment_event(text, text, text, text, text, text, text, text, jsonb)
to web_submitter, service_role;
