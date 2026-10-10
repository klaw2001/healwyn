import type { NewLeadPayload } from '@healwyn/core';

export type LeadStoreKind = 'postgres' | 'supabase' | 'memory' | 'unconfigured';

/** Server-side persistence for public submissions. Never import from client code. */
export interface LeadStore {
  readonly kind: LeadStoreKind;
  /** Stores a lead with its consent evidence and audit events, atomically. */
  submitLead(payload: NewLeadPayload): Promise<{ id: string }>;
  /** Counts a hit for a hashed key; resolves true while within the limit. */
  hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** Unsubscribes a lead from nurture messages. Resolves false if already out (or erased). */
  optOut(leadId: string, source: string): Promise<boolean>;
  close(): Promise<void>;
}

/** A storage failure. Messages never include personal data from the payload. */
export class LeadStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LeadStoreError';
  }
}
