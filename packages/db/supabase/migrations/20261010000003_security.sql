-- Row level security and privileges.
--
-- Phase 1 rule: nothing is readable or writable from the browser. The public
-- website writes through server-side code using the service role (which
-- bypasses RLS) or the database owner. anon and authenticated get no table
-- privileges and no policies, so every direct request is denied twice over.
-- Phase 2 adds staff policies for `authenticated` alongside explicit grants.

alter table public.specialties enable row level security;
alter table public.staff enable row level security;
alter table public.leads enable row level security;
alter table public.consent_records enable row level security;
alter table public.lead_events enable row level security;
alter table public.rate_limits enable row level security;

-- Supabase's default privileges grant everything in `public` to anon and
-- authenticated. Take it back explicitly.
revoke all on table
  public.specialties,
  public.staff,
  public.leads,
  public.consent_records,
  public.lead_events,
  public.rate_limits,
  public.current_consents
from anon, authenticated;

grant select, insert, update, delete on table
  public.specialties,
  public.staff,
  public.leads,
  public.consent_records,
  public.lead_events,
  public.rate_limits
to service_role;
grant select on table public.current_consents to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on all sequences in schema public from anon, authenticated;

-- Functions: callable by the service role only. Postgres grants EXECUTE to
-- PUBLIC by default, and Supabase also grants it to anon and authenticated.
revoke execute on function
  public.submit_lead(jsonb),
  public.erase_lead(uuid, text),
  public.withdraw_consent(uuid, text, text, boolean),
  public.hit_rate_limit(text, integer, integer),
  public.set_updated_at(),
  public.prevent_audit_change()
from public, anon, authenticated;

grant execute on function
  public.submit_lead(jsonb),
  public.erase_lead(uuid, text),
  public.withdraw_consent(uuid, text, text, boolean),
  public.hit_rate_limit(text, integer, integer)
to service_role;
