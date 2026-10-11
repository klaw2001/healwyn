import type { NewLeadPayload, SequencePlan, StaffCalendar } from '@healwyn/core';

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
  /** What the booking page needs about a lead (no personal data); null when unknown or erased. */
  bookingContext(leadId: string): Promise<BookingContext | null>;
  /** Bookable staff of an industry with their calendars (template, exceptions, busy times) between two dates. */
  bookingCalendar(
    industry: string,
    staffIds: readonly string[] | null,
    from: string,
    to: string,
  ): Promise<StaffCalendar[]>;
  /** Books (or reschedules) a slot; the database re-checks it and refuses double booking. */
  bookAppointment(input: BookingRequest): Promise<BookingOutcome>;
  /** Cancels the lead's upcoming appointment; `plan` is the nurture plan of the stage it returns to. */
  cancelAppointment(leadId: string, appointmentId: string, plan: SequencePlan | null): Promise<BookingOutcome>;
  /** Records a new test-mode checkout attempt for an order the server just created. */
  createPayment(input: NewPayment): Promise<void>;
  /** The payment behind a provider order, for the webhook. */
  paymentForOrder(provider: string, orderId: string): Promise<PaymentForOrder | null>;
  /** A lead's payments for its own payment page (no personal data). */
  leadPayments(leadId: string): Promise<LeadPayment[]>;
  /** Applies one verified provider event, once (idempotent on the provider event id). */
  recordPaymentEvent(event: PaymentEventInput): Promise<{ duplicate: boolean; status: string; changed: boolean }>;
  close(): Promise<void>;
}

export interface NewPayment {
  paymentId: string;
  leadId: string;
  productId: string;
  amountPaise: number;
  provider: 'razorpay' | 'simulated';
  orderId: string;
  requestedBy: 'lead' | 'staff';
}

export interface PaymentForOrder {
  payment_id: string;
  lead_id: string;
  industry: string;
  status: string;
  amount_paise: number;
}

export interface LeadPayment {
  id: string;
  product_id: string;
  amount_paise: number;
  provider: string;
  status: 'created' | 'authorized' | 'paid' | 'failed';
  failure_code: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface PaymentEventInput {
  provider: 'razorpay' | 'simulated';
  eventId: string;
  type: string;
  orderId: string;
  paymentId: string | null;
  status: 'authorized' | 'paid' | 'failed';
  failureCode: string | null;
  paidStage: string;
  plan: SequencePlan;
}

export interface BookingContext {
  lead_id: string;
  industry: string;
  stage: string;
  specialty_slug: string | null;
  preferred_language: string | null;
  assigned_staff_id: string | null;
  active_sequences: string[];
  appointment: {
    id: string;
    staff_id: string;
    starts_at: string;
    ends_at: string;
    previous_stage: string | null;
  } | null;
}

export interface BookingRequest {
  leadId: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  /** The booked stage's nurture plan (planStageEntry). */
  plan: SequencePlan;
  /** The appointment this one replaces (rescheduling). */
  replaces?: string | null;
}

export type BookingFailure = 'taken' | 'unavailable' | 'already_booked' | 'not_found';
export type BookingOutcome = { ok: true; appointmentId: string } | { ok: false; reason: BookingFailure };

/** Maps the booking functions' SQLSTATEs to outcomes; anything else is a storage failure. */
export function bookingFailure(code: string | undefined): BookingFailure | null {
  switch (code) {
    case '23P01': // exclusion_violation: someone else booked an overlapping time
      return 'taken';
    case '23505': // unique_violation: this lead already has an upcoming appointment
      return 'already_booked';
    case '22023': // invalid_parameter_value: outside the published hours or the policy
      return 'unavailable';
    case 'P0002': // no_data_found
    case '55000': // object_not_in_prerequisite_state (erased lead)
      return 'not_found';
    default:
      return null;
  }
}

export type CallStart = { allowed: true; call_id: string } | { allowed: false; reason: string };

/** A storage failure. Messages never include personal data from the payload. */
export class LeadStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LeadStoreError';
  }
}
