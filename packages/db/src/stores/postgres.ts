import type { NewLeadPayload, StaffCalendar } from '@healwyn/core';
import postgres from 'postgres';
import { sslModeFor } from '../sql-target';
import {
  bookingFailure,
  LeadStoreError,
  type BookingContext,
  type CallStart,
  type LeadPayment,
  type LeadStore,
  type PaymentForOrder,
} from './types';

/**
 * Direct Postgres connection. On serverless hosts use Supabase's transaction
 * pooler (port 6543): prepared statements are disabled for that reason.
 */
export function createPostgresLeadStore(url: string): LeadStore {
  const sql = postgres(url, {
    max: 3,
    prepare: false,
    ssl: sslModeFor(url),
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: 'healwyn-web' },
  });

  return {
    kind: 'postgres',
    async submitLead(payload: NewLeadPayload) {
      try {
        const [row] = await sql<{ id: string }[]>`
          select public.submit_lead(${sql.json(payload as unknown as postgres.JSONValue)}) as id`;
        if (!row) throw new Error('submit_lead returned no row');
        return { id: row.id };
      } catch (error) {
        throw new LeadStoreError('Could not store the lead', { cause: error });
      }
    },
    async hitRateLimit(key, limit, windowSeconds) {
      try {
        const [row] = await sql<{ allowed: boolean }[]>`
          select public.hit_rate_limit(${key}, ${limit}, ${windowSeconds}) as allowed`;
        return row?.allowed ?? false;
      } catch (error) {
        throw new LeadStoreError('Could not check the rate limit', { cause: error });
      }
    },
    async optOut(leadId, source) {
      try {
        const [row] = await sql<{ changed: boolean }[]>`select public.opt_out_lead(${leadId}, ${source}) as changed`;
        return row?.changed ?? false;
      } catch (error) {
        throw new LeadStoreError('Could not record the unsubscribe', { cause: error });
      }
    },
    async startWebCall(leadId, channel) {
      try {
        const [row] = await sql<{ r: CallStart }[]>`select public.start_web_call(${leadId}, ${channel}) as r`;
        return row!.r;
      } catch (error) {
        throw new LeadStoreError('Could not start the call', { cause: error });
      }
    },
    async useTextFallback(callId, leadId) {
      try {
        const [row] = await sql<{ ok: boolean }[]>`select public.use_text_fallback(${callId}, ${leadId}) as ok`;
        return row?.ok === true;
      } catch (error) {
        throw new LeadStoreError('Could not switch the call to typing', { cause: error });
      }
    },
    async bookingContext(leadId) {
      try {
        const [row] = await sql<{ r: BookingContext | null }[]>`select public.booking_context(${leadId}) as r`;
        return row?.r ?? null;
      } catch (error) {
        throw new LeadStoreError('Could not read the booking', { cause: error });
      }
    },
    async bookingCalendar(industry, staffIds, from, to) {
      try {
        const [row] = await sql<{ r: StaffCalendar[] }[]>`
          select public.booking_calendar(${industry}, ${staffIds ? [...staffIds] : null}::uuid[], ${from}::date, ${to}::date) as r`;
        return row?.r ?? [];
      } catch (error) {
        throw new LeadStoreError('Could not read the calendar', { cause: error });
      }
    },
    async bookAppointment({ leadId, staffId, startsAt, endsAt, plan, replaces }) {
      try {
        const [row] = await sql<{ r: { appointment_id: string } }[]>`
          select public.book_appointment_public(${leadId}, ${staffId}, ${startsAt}, ${endsAt},
            ${sql.json(plan as unknown as postgres.JSONValue)}, ${replaces ?? null}) as r`;
        return { ok: true, appointmentId: row!.r.appointment_id };
      } catch (error) {
        const reason = bookingFailure((error as { code?: string }).code);
        if (reason) return { ok: false, reason };
        throw new LeadStoreError('Could not book the appointment', { cause: error });
      }
    },
    async cancelAppointment(leadId, appointmentId, plan) {
      try {
        await sql`select public.cancel_appointment_public(${leadId}, ${appointmentId},
          ${plan ? sql.json(plan as unknown as postgres.JSONValue) : null})`;
        return { ok: true, appointmentId };
      } catch (error) {
        const reason = bookingFailure((error as { code?: string }).code);
        if (reason) return { ok: false, reason };
        throw new LeadStoreError('Could not cancel the appointment', { cause: error });
      }
    },
    async createPayment(p) {
      try {
        await sql`select public.create_payment(${p.paymentId}, ${p.leadId}, ${p.productId}, ${p.amountPaise},
          ${p.provider}, ${p.orderId}, ${p.requestedBy})`;
      } catch (error) {
        throw new LeadStoreError('Could not record the payment', { cause: error });
      }
    },
    async paymentForOrder(provider, orderId) {
      try {
        const [row] = await sql<PaymentForOrder[]>`select * from public.payment_for_order(${provider}, ${orderId})`;
        return row ?? null;
      } catch (error) {
        throw new LeadStoreError('Could not read the payment', { cause: error });
      }
    },
    async leadPayments(leadId) {
      try {
        const rows = await sql<LeadPayment[]>`select * from public.lead_payments(${leadId})`;
        return rows.map((r) => ({
          ...r,
          created_at: new Date(r.created_at).toISOString(),
          paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
        }));
      } catch (error) {
        throw new LeadStoreError('Could not read the payments', { cause: error });
      }
    },
    async recordPaymentEvent(e) {
      try {
        const [row] = await sql<{ r: { duplicate: boolean; status: string; changed: boolean } }[]>`
          select public.record_payment_event(${e.provider}, ${e.eventId}, ${e.type}, ${e.orderId}, ${e.paymentId},
            ${e.status}, ${e.failureCode}, ${e.paidStage}, ${sql.json(e.plan as unknown as postgres.JSONValue)}) as r`;
        return row!.r;
      } catch (error) {
        throw new LeadStoreError('Could not record the payment event', { cause: error });
      }
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
