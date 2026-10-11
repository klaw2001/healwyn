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
  /**
   * Starts an assistant call (browser voice or typed chat) for a lead, if its call consent,
   * opt-out status and the daily cap allow it. Refusals are recorded on the lead with a reason.
   */
  startWebCall(leadId: string, channel: 'browser' | 'text', rules: CallRules): Promise<CallStart>;
  close(): Promise<void>;
}

/** Pack-defined call rules (see the start_call SQL function). */
export interface CallRules {
  consent_purpose: string;
  max_per_day: number;
  window_start: number;
  window_end: number;
  time_zone: string;
}

export type CallStart = { allowed: true; call_id: string } | { allowed: false; reason: string };

/** A storage failure. Messages never include personal data from the payload. */
export class LeadStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LeadStoreError';
  }
}
