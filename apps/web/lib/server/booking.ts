import 'server-only';
import {
  addDays,
  getIndustryPack,
  isIndustryId,
  localDate,
  openSlots,
  type IndustryPack,
  type Slot,
  type StaffCalendar,
} from '@healwyn/core';
import type { BookingContext } from '@healwyn/db';
import { bookingUrl, signBookingToken, verifyBookingToken } from '@healwyn/messaging';
import { getLeadStore } from './lead-store';

/**
 * The public booking flow. A person reaches it with their own signed link (from
 * the thank-you panel after an enquiry): the link names the lead, so nobody can
 * book, move or cancel someone else's appointment. Slots come from the staff
 * member's real calendar; the database re-checks the chosen one and refuses
 * double booking.
 */

const hasBooking = () => ['postgres', 'supabase'].includes(getLeadStore().kind);

/** The lead's booking page, relative to the site, or null when booking is not available. */
export async function bookingPathFor(leadId: string, pack: IndustryPack): Promise<string | null> {
  if (!hasBooking() || !process.env.UNSUBSCRIBE_SECRET) return null;
  const token = await signBookingToken(leadId, process.env.UNSUBSCRIBE_SECRET);
  return bookingUrl('', token, pack.id);
}

export interface LoadedBooking {
  token: string;
  context: BookingContext;
  pack: IndustryPack;
}

/** Verifies the link and loads the lead's booking context; null for a bad, expired or erased link. */
export async function loadBooking(token: string | null | undefined): Promise<LoadedBooking | null> {
  if (!hasBooking()) return null;
  const leadId = await verifyBookingToken(token, process.env.UNSUBSCRIBE_SECRET);
  if (!leadId || !token) return null;
  const context = await getLeadStore().bookingContext(leadId);
  if (!context || !isIndustryId(context.industry)) return null;
  return { token, context, pack: getIndustryPack(context.industry) };
}

/**
 * Whose calendars to offer: the assigned expert when there is one, otherwise
 * the experts for the service the person asked about (or everyone bookable).
 */
export async function candidateCalendars(loaded: LoadedBooking): Promise<StaffCalendar[]> {
  const { context, pack } = loaded;
  const today = localDate(new Date(), pack.brand.timeZone);
  const all = await getLeadStore().bookingCalendar(
    context.industry,
    null,
    today,
    addDays(today, pack.booking.horizonDays),
  );
  const assigned = all.find((c) => c.staff_id === context.assigned_staff_id);
  if (assigned) return [assigned];
  const matching = all.filter((c) => context.specialty_slug && c.specialties.includes(context.specialty_slug));
  return matching.length > 0 ? matching : all;
}

export function slotsOf(calendar: StaffCalendar, pack: IndustryPack, now: Date = new Date()): Slot[] {
  return openSlots(calendar, {
    slotMinutes: pack.booking.slotMinutes,
    horizonDays: pack.booking.horizonDays,
    timeZone: pack.brand.timeZone,
    now,
  });
}
