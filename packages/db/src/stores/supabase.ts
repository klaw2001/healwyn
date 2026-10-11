import type { NewLeadPayload, StaffCalendar } from '@healwyn/core';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../database.types';
import { bookingFailure, LeadStoreError, type BookingContext, type CallStart, type LeadStore } from './types';

/**
 * Supabase over HTTPS (PostgREST RPC) with the service-role key. Preferred in
 * production: no TCP connection limits and no IPv4/IPv6 concerns.
 * The service-role key bypasses RLS: server-side code only.
 */
export function createSupabaseLeadStore(
  url: string,
  serviceRoleKey: string,
  options: { fetch?: typeof fetch } = {},
): LeadStore {
  const client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
  });

  return {
    kind: 'supabase',
    async submitLead(payload: NewLeadPayload) {
      const { data, error } = await client.rpc('submit_lead', { payload: payload as unknown as Json });
      if (error || !data) {
        throw new LeadStoreError(`Could not store the lead (${error?.code ?? 'no data'})`, { cause: error });
      }
      return { id: data };
    },
    async hitRateLimit(key, limit, windowSeconds) {
      const { data, error } = await client.rpc('hit_rate_limit', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) throw new LeadStoreError(`Could not check the rate limit (${error.code})`, { cause: error });
      return data === true;
    },
    async optOut(leadId, source) {
      const { data, error } = await client.rpc('opt_out_lead', { p_lead_id: leadId, p_source: source });
      if (error) throw new LeadStoreError(`Could not record the unsubscribe (${error.code})`, { cause: error });
      return data === true;
    },
    async startWebCall(leadId, channel) {
      const { data, error } = await client.rpc('start_web_call', { p_lead_id: leadId, p_channel: channel });
      if (error) throw new LeadStoreError(`Could not start the call (${error.code})`, { cause: error });
      return data as CallStart;
    },
    async useTextFallback(callId, leadId) {
      const { data, error } = await client.rpc('use_text_fallback', { p_call_id: callId, p_lead_id: leadId });
      if (error) throw new LeadStoreError(`Could not switch the call to typing (${error.code})`, { cause: error });
      return data === true;
    },
    async bookingContext(leadId) {
      const { data, error } = await client.rpc('booking_context', { p_lead_id: leadId });
      if (error) throw new LeadStoreError(`Could not read the booking (${error.code})`, { cause: error });
      return (data as unknown as BookingContext | null) ?? null;
    },
    async bookingCalendar(industry, staffIds, from, to) {
      const { data, error } = await client.rpc('booking_calendar', {
        p_industry: industry,
        p_staff_ids: staffIds ? [...staffIds] : (null as unknown as string[]),
        p_from: from,
        p_to: to,
      });
      if (error) throw new LeadStoreError(`Could not read the calendar (${error.code})`, { cause: error });
      return (data as unknown as StaffCalendar[] | null) ?? [];
    },
    async bookAppointment({ leadId, staffId, startsAt, endsAt, plan, replaces }) {
      const { data, error } = await client.rpc('book_appointment_public', {
        p_lead_id: leadId,
        p_staff_id: staffId,
        p_starts: startsAt.toISOString(),
        p_ends: endsAt.toISOString(),
        p_plan: plan as unknown as Json,
        p_replaces: (replaces ?? null) as unknown as string,
      });
      if (error) {
        const reason = bookingFailure(error.code);
        if (reason) return { ok: false, reason };
        throw new LeadStoreError(`Could not book the appointment (${error.code})`, { cause: error });
      }
      return { ok: true, appointmentId: (data as { appointment_id: string }).appointment_id };
    },
    async cancelAppointment(leadId, appointmentId, plan) {
      const { error } = await client.rpc('cancel_appointment_public', {
        p_lead_id: leadId,
        p_appointment_id: appointmentId,
        p_plan: (plan ?? null) as unknown as Json,
      });
      if (error) {
        const reason = bookingFailure(error.code);
        if (reason) return { ok: false, reason };
        throw new LeadStoreError(`Could not cancel the appointment (${error.code})`, { cause: error });
      }
      return { ok: true, appointmentId };
    },
    async close() {},
  };
}
