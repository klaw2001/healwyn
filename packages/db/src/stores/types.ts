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
   * opt-out status and the daily caps allow it (rules from `call_policies`, written from the pack).
   * Refusals are recorded on the lead with a reason.
   */
  startWebCall(leadId: string, channel: 'browser' | 'text'): Promise<CallStart>;
  /** Switches a browser call that could not connect to typed chat. Once per call; false otherwise. */
  useTextFallback(callId: string, leadId: string): Promise<boolean>;
  close(): Promise<void>;
}

export type CallStart = { allowed: true; call_id: string } | { allowed: false; reason: string };

/** A storage failure. Messages never include personal data from the payload. */
export class LeadStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LeadStoreError';
  }
}
