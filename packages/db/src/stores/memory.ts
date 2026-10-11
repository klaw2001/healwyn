import type { NewLeadPayload } from '@healwyn/core';
import type { LeadStore } from './types';

export interface MemoryLeadStore extends LeadStore {
  readonly kind: 'memory';
  /** Stored leads, for tests and local inspection. */
  readonly leads: ReadonlyMap<string, NewLeadPayload & { createdAt: Date }>;
}

/**
 * In-process store for local development without a database and for unit
 * tests. Data disappears on restart. Never selected in production.
 */
export function createMemoryLeadStore(): MemoryLeadStore {
  const leads = new Map<string, NewLeadPayload & { createdAt: Date }>();
  const windows = new Map<string, number>();
  const optedOut = new Set<string>();
  const browserCalls = new Map<string, string>();

  return {
    kind: 'memory',
    leads,
    async submitLead(payload) {
      if (!payload.consents.some((c) => c.granted)) throw new Error('a lead cannot be stored without consent');
      const id = globalThis.crypto.randomUUID();
      leads.set(id, { ...payload, createdAt: new Date() });
      return { id };
    },
    async hitRateLimit(key, limit, windowSeconds) {
      const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
      const bucket = `${key}:${windowSeconds}:${windowStart}`;
      const hits = (windows.get(bucket) ?? 0) + 1;
      windows.set(bucket, hits);
      return hits <= limit;
    },
    async optOut(leadId) {
      if (!leads.has(leadId) || optedOut.has(leadId)) return false;
      optedOut.add(leadId);
      return true;
    },
    async startWebCall(leadId, channel) {
      // Development only: no consent ledger or cap here.
      if (!leads.has(leadId)) return { allowed: false, reason: 'not_found' };
      const callId = crypto.randomUUID();
      if (channel === 'browser') browserCalls.set(callId, leadId);
      return { allowed: true, call_id: callId };
    },
    async useTextFallback(callId, leadId) {
      if (browserCalls.get(callId) !== leadId) return false;
      browserCalls.delete(callId);
      return true;
    },
    async close() {},
  };
}
