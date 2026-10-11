'use server';

import { isLocalDate, isLocalTime, planStageEntry } from '@healwyn/core';
import { revalidatePath } from 'next/cache';
import { assertCapability } from '@/lib/server/auth';
import { activeSequences, slotsOf, staffCalendars } from '@/lib/server/booking';
import { asStaff } from '@/lib/server/db';
import { friendlyError, type ActionResult } from '@/lib/server/errors';
import { packFor } from '@/lib/server/pack';
import { recomputeScore } from '@/lib/server/scores';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXCEPTION_REASONS = ['leave', 'training', 'public_holiday', 'site_visit', 'other'] as const;

function refresh(leadId?: string) {
  revalidatePath('/bookings');
  revalidatePath('/availability');
  revalidatePath('/pipeline');
  revalidatePath('/workspace');
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

function bookingError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === '23P01') return 'Someone booked that time a moment ago. Choose another.';
  if (code === '23505') return 'This lead already has an upcoming appointment. Move or cancel it instead.';
  if (code === '22023') return 'That time is not available any more. Choose another.';
  const message = error instanceof Error ? error.message : '';
  if (/already closed/.test(message)) return 'This appointment is already marked.';
  if (/not started yet/.test(message)) return 'You can mark an appointment once it has started.';
  if (/does not take bookings/.test(message)) return 'That colleague does not take bookings.';
  return friendlyError(error);
}

/** Books (or moves) a lead's appointment into an open slot of a bookable colleague's calendar. */
export async function bookAppointment(
  leadId: string,
  staffId: string,
  start: string,
  replaces: string | null = null,
): Promise<ActionResult<{ appointmentId: string }>> {
  try {
    const session = await assertCapability('booking.manage');
    const pack = packFor(session);
    if (!UUID.test(leadId) || !UUID.test(staffId) || (replaces !== null && !UUID.test(replaces))) {
      return { ok: false, error: 'Unknown lead or colleague.' };
    }
    if (session.role === 'specialist_doctor' && staffId !== session.staffId) {
      return { ok: false, error: 'You can book only into your own calendar.' };
    }
    const result = await asStaff(session, async (tx) => {
      const [calendar] = await staffCalendars(tx, pack, [staffId]);
      const slot = calendar ? slotsOf(calendar, pack).find((s) => s.start.toISOString() === start) : undefined;
      if (!slot) return null;
      const plan = planStageEntry(pack.sequences, pack.booking.bookedStageId, await activeSequences(tx, leadId));
      const [row] = await tx<{ r: { appointment_id: string } }[]>`
        select public.book_appointment(${leadId}, ${staffId}, ${slot.start}, ${slot.end},
          ${tx.json(plan as never)}, ${replaces}) as r`;
      await recomputeScore(tx, leadId);
      return row!.r.appointment_id;
    });
    if (!result) return { ok: false, error: 'That time is not available any more. Choose another.' };
    refresh(leadId);
    return { ok: true, appointmentId: result };
  } catch (error) {
    return { ok: false, error: bookingError(error) };
  }
}

/** Cancels an upcoming appointment; a lead still in the booked stage returns to its earlier stage. */
export async function cancelAppointment(appointmentId: string): Promise<ActionResult> {
  try {
    const session = await assertCapability('booking.manage');
    const pack = packFor(session);
    if (!UUID.test(appointmentId)) return { ok: false, error: 'Unknown appointment.' };
    const leadId = await asStaff(session, async (tx) => {
      const [appointment] = await tx<{ lead_id: string; previous_stage: string | null }[]>`
        select lead_id, previous_stage from public.appointments where id = ${appointmentId}`;
      if (!appointment) throw Object.assign(new Error('lead not found'), { code: 'P0002' });
      const plan = appointment.previous_stage
        ? planStageEntry(pack.sequences, appointment.previous_stage, await activeSequences(tx, appointment.lead_id))
        : null;
      await tx`select public.cancel_appointment(${appointmentId}, ${plan ? tx.json(plan as never) : null})`;
      await recomputeScore(tx, appointment.lead_id);
      return appointment.lead_id;
    });
    refresh(leadId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: bookingError(error) };
  }
}

/** Marks an appointment that has started as attended or missed, moving the lead on. */
export async function markAppointment(appointmentId: string, status: 'attended' | 'no_show'): Promise<ActionResult> {
  try {
    const session = await assertCapability('booking.manage');
    const pack = packFor(session);
    if (!UUID.test(appointmentId) || (status !== 'attended' && status !== 'no_show')) {
      return { ok: false, error: 'Unknown appointment.' };
    }
    const toStage = status === 'attended' ? pack.booking.attendedStageId : pack.booking.noShowStageId;
    const leadId = await asStaff(session, async (tx) => {
      const [appointment] = await tx<{ lead_id: string }[]>`
        select lead_id from public.appointments where id = ${appointmentId}`;
      if (!appointment) throw Object.assign(new Error('lead not found'), { code: 'P0002' });
      const plan = planStageEntry(pack.sequences, toStage, await activeSequences(tx, appointment.lead_id));
      await tx`select public.mark_appointment(${appointmentId}, ${status}, ${tx.json(plan as never)})`;
      await recomputeScore(tx, appointment.lead_id);
      return appointment.lead_id;
    });
    refresh(leadId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: bookingError(error) };
  }
}

export interface DayHours {
  weekday: number;
  start: string;
  end: string;
}

/** Replaces a colleague's (or your own) weekly hours. */
export async function saveWeeklyHours(staffId: string, hours: DayHours[]): Promise<ActionResult> {
  try {
    const session = await assertCapability('availability.manage');
    if (!UUID.test(staffId)) return { ok: false, error: 'Unknown colleague.' };
    if (session.role === 'specialist_doctor' && staffId !== session.staffId) {
      return { ok: false, error: 'You can change only your own hours.' };
    }
    const seen = new Set<number>();
    for (const day of hours) {
      if (!Number.isInteger(day.weekday) || day.weekday < 1 || day.weekday > 7 || seen.has(day.weekday)) {
        return { ok: false, error: 'Each day can appear once.' };
      }
      if (!isLocalTime(day.start) || !isLocalTime(day.end) || day.end <= day.start) {
        return { ok: false, error: 'Each day needs a start time before its end time.' };
      }
      seen.add(day.weekday);
    }
    const rules = hours.map(({ weekday, start, end }) => ({ weekday, start, end }));
    await asStaff(session, (tx) => tx`select public.set_availability(${staffId}, ${tx.json(rules)})`);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: bookingError(error) };
  }
}

/** Adds time off (a whole day or some hours) or extra hours on a date. */
export async function addAvailabilityException(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await assertCapability('availability.manage');
    const value = (name: string) => {
      const v = formData.get(name);
      return typeof v === 'string' ? v.trim() : '';
    };
    const staffId = value('staff_id');
    const date = value('date');
    const kind = value('kind');
    const wholeDay = value('whole_day') === 'on' && kind === 'off';
    const start = wholeDay ? null : value('start');
    const end = wholeDay ? null : value('end');
    const reason = value('reason') || 'other';
    if (!UUID.test(staffId)) return { ok: false, error: 'Choose a colleague.' };
    if (session.role === 'specialist_doctor' && staffId !== session.staffId) {
      return { ok: false, error: 'You can change only your own hours.' };
    }
    if (!isLocalDate(date)) return { ok: false, error: 'Choose a date.' };
    if (kind !== 'off' && kind !== 'extra') return { ok: false, error: 'Choose time off or extra hours.' };
    if (!wholeDay && (!isLocalTime(start) || !isLocalTime(end) || end! <= start!)) {
      return { ok: false, error: 'Give a start time before the end time, or choose the whole day.' };
    }
    if (!(EXCEPTION_REASONS as readonly string[]).includes(reason)) return { ok: false, error: 'Choose a reason.' };
    await asStaff(
      session,
      (tx) =>
        tx`select public.add_availability_exception(${staffId}, ${date}::date, ${kind}, ${start}::time, ${end}::time, ${reason})`,
    );
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: bookingError(error) };
  }
}

export async function removeAvailabilityException(exceptionId: string): Promise<ActionResult> {
  try {
    const session = await assertCapability('availability.manage');
    if (!UUID.test(exceptionId)) return { ok: false, error: 'Unknown entry.' };
    await asStaff(session, (tx) => tx`select public.remove_availability_exception(${exceptionId})`);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: bookingError(error) };
  }
}
