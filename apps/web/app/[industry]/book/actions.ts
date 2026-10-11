'use server';

import { planStageEntry } from '@healwyn/core';
import { redirect, unstable_rethrow } from 'next/navigation';
import { candidateCalendars, loadBooking, slotsOf } from '@/lib/server/booking';
import { errorFields, log } from '@/lib/server/log';
import { getLeadStore } from '@/lib/server/lead-store';

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const back = (token: string, industry: string, query: string) =>
  `/book?t=${encodeURIComponent(token)}&i=${encodeURIComponent(industry)}&${query}`;

/** Books (or moves) the person's appointment to a slot that is open right now. */
export async function bookSlot(formData: FormData) {
  const loaded = await loadBooking(text(formData, 't')).catch(() => null);
  if (!loaded) redirect('/book?error=link');
  const { token, context, pack } = loaded;
  const staffId = text(formData, 'staff');
  const start = text(formData, 'start');
  const replaces = context.appointment?.id ?? null;
  const retry = (code: string) =>
    back(token, pack.id, `staff=${encodeURIComponent(staffId)}&error=${code}${replaces ? '&change=1' : ''}`);

  let destination: string;
  try {
    const store = getLeadStore();
    if (!(await store.hitRateLimit(`booking:${context.lead_id}`, 12, 3600))) redirect(retry('busy'));
    const calendar = (await candidateCalendars(loaded)).find((c) => c.staff_id === staffId);
    const slot = calendar ? slotsOf(calendar, pack).find((s) => s.start.toISOString() === start) : undefined;
    if (!slot) redirect(retry(start ? 'unavailable' : 'choose'));
    const outcome = await store.bookAppointment({
      leadId: context.lead_id,
      staffId,
      startsAt: slot.start,
      endsAt: slot.end,
      plan: planStageEntry(pack.sequences, pack.booking.bookedStageId, context.active_sequences),
      replaces,
    });
    log.info('booking.public', { outcome: outcome.ok ? 'booked' : outcome.reason, rescheduled: Boolean(replaces) });
    destination = outcome.ok ? back(token, pack.id, 'done=booked') : retry(outcome.reason);
  } catch (error) {
    unstable_rethrow(error);
    log.error('booking.public_failed', errorFields(error));
    destination = retry('failed');
  }
  redirect(destination);
}

/** Cancels the person's upcoming appointment. */
export async function cancelBooking(formData: FormData) {
  const loaded = await loadBooking(text(formData, 't')).catch(() => null);
  if (!loaded) redirect('/book?error=link');
  const { token, context, pack } = loaded;
  let destination = back(token, pack.id, 'done=cancelled');
  try {
    const appointment = context.appointment;
    if (appointment && appointment.id === text(formData, 'appointment')) {
      const returnTo = appointment.previous_stage;
      const plan = returnTo ? planStageEntry(pack.sequences, returnTo, context.active_sequences) : null;
      const outcome = await getLeadStore().cancelAppointment(context.lead_id, appointment.id, plan);
      log.info('booking.public_cancel', { outcome: outcome.ok ? 'cancelled' : outcome.reason });
      if (!outcome.ok) destination = back(token, pack.id, 'error=failed');
    }
  } catch (error) {
    log.error('booking.public_cancel_failed', errorFields(error));
    destination = back(token, pack.id, 'error=failed');
  }
  redirect(destination);
}
