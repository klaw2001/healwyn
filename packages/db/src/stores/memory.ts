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
    async close() {},
  };
}
