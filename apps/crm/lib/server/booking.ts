import 'server-only';
import {
  addDays,
  formatDay,
  formatTime,
  localDate,
  openSlots,
  slotsByDay,
  type IndustryPack,
  type StaffCalendar,
} from '@healwyn/core';
import type { Session } from './session';
import { asStaff, type Tx } from './db';

/** One bookable person's open slots, grouped by India-time day, ready for the picker. */
export interface SlotChoice {
  staffId: string;
  name: string;
  title: string;
  days: { date: string; label: string; slots: { start: string; label: string }[] }[];
}

export async function staffCalendars(
  tx: Tx,
  pack: IndustryPack,
  staffIds: readonly string[] | null,
  days: number = pack.booking.horizonDays,
): Promise<StaffCalendar[]> {
  const today = localDate(new Date(), pack.brand.timeZone);
  const [row] = await tx<{ c: StaffCalendar[] }[]>`
    select public.staff_calendar(${staffIds ? [...staffIds] : null}::uuid[], ${today}::date, ${addDays(today, days)}::date) as c`;
  return row?.c ?? [];
}

export function slotsOf(calendar: StaffCalendar, pack: IndustryPack, now: Date = new Date()) {
  return openSlots(calendar, {
    slotMinutes: pack.booking.slotMinutes,
    horizonDays: pack.booking.horizonDays,
    timeZone: pack.brand.timeZone,
    now,
  });
}

export function toSlotChoices(calendars: StaffCalendar[], pack: IndustryPack): SlotChoice[] {
  const tz = pack.brand.timeZone;
  return calendars.map((calendar) => ({
    staffId: calendar.staff_id,
    name: calendar.full_name,
    title: calendar.title,
    days: slotsByDay(slotsOf(calendar, pack), tz).map((day) => ({
      date: day.date,
      label: formatDay(day.date),
      slots: day.slots.map((slot) => ({ start: slot.start.toISOString(), label: formatTime(slot.start, tz) })),
    })),
  }));
}

export interface AppointmentRow {
  id: string;
  lead_id: string;
  lead_name: string | null;
  staff_id: string;
  staff_name: string;
  starts_at: Date;
  ends_at: Date;
  status: 'booked' | 'attended' | 'no_show' | 'cancelled';
  booked_via: string;
  lead_stage: string;
}

export async function leadAppointments(session: Session, leadId: string): Promise<AppointmentRow[]> {
  return asStaff(
    session,
    (tx) => tx<AppointmentRow[]>`
      select a.id, a.lead_id, l.full_name as lead_name, a.staff_id, s.full_name as staff_name, a.starts_at, a.ends_at,
             a.status, a.booked_via, l.stage as lead_stage
      from public.appointments a
      join public.leads l on l.id = a.lead_id
      join public.staff s on s.id = a.staff_id
      where a.lead_id = ${leadId}
      order by a.starts_at desc`,
  );
}

/** Appointments in a date range (India time), for the bookings screen. Experts see their own. */
export async function appointmentsBetween(
  session: Session,
  pack: IndustryPack,
  from: string,
  to: string,
  staffId: string | null,
): Promise<AppointmentRow[]> {
  const tz = pack.brand.timeZone;
  return asStaff(
    session,
    (tx) => tx<AppointmentRow[]>`
      select a.id, a.lead_id, l.full_name as lead_name, a.staff_id, s.full_name as staff_name, a.starts_at, a.ends_at,
             a.status, a.booked_via, l.stage as lead_stage
      from public.appointments a
      join public.leads l on l.id = a.lead_id
      join public.staff s on s.id = a.staff_id
      where a.status <> 'cancelled'
        and (a.starts_at at time zone ${tz})::date between ${from}::date and ${to}::date
        ${staffId ? tx`and a.staff_id = ${staffId}` : tx``}
      order by a.starts_at`,
  );
}

/** Appointments that started but nobody has marked yet. */
export async function unmarkedAppointments(session: Session): Promise<AppointmentRow[]> {
  return asStaff(
    session,
    (tx) => tx<AppointmentRow[]>`
      select a.id, a.lead_id, l.full_name as lead_name, a.staff_id, s.full_name as staff_name, a.starts_at, a.ends_at,
             a.status, a.booked_via, l.stage as lead_stage
      from public.appointments a
      join public.leads l on l.id = a.lead_id
      join public.staff s on s.id = a.staff_id
      where a.status = 'booked' and a.starts_at < now()
      order by a.starts_at`,
  );
}

export async function activeSequences(tx: Tx, leadId: string): Promise<string[]> {
  const rows = await tx<{ sequence_id: string }[]>`
    select sequence_id from public.sequence_enrollments where lead_id = ${leadId} and status = 'active'`;
  return rows.map((r) => r.sequence_id);
}
