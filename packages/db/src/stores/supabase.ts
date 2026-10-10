import type { NewLeadPayload } from '@healwyn/core';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../database.types';
import { LeadStoreError, type LeadStore } from './types';

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
    async close() {},
  };
}
