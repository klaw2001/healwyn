/**
 * Booking slots, computed from a staff member's calendar: the weekly template,
 * exceptions (time off, extra hours) and busy times. Pure and deterministic:
 * the website and the CRM both offer exactly these slots, and the database
 * re-checks a chosen slot against the same calendar before it books it
 * (`app_private.slot_is_open`), with an exclusion constraint against double
 * booking. Times on the calendar are local to `timeZone` (India time).
 */

/** Book no sooner than this from now; the seed writes it to `booking_policies`. */
export const BOOKING_MIN_NOTICE_MINUTES = 60;

export interface WeeklyRule {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  readonly weekday: number;
  /** "HH:MM", local time. */
  readonly start: string;
  readonly end: string;
}

export interface CalendarException {
  readonly id?: string;
  /** "YYYY-MM-DD", local date. */
  readonly date: string;
  readonly kind: 'off' | 'extra';
  /** null for a whole day off. */
  readonly start: string | null;
  readonly end: string | null;
  readonly reason?: string;
}

export interface BusyRange {
  readonly start: string | Date;
  readonly end: string | Date;
}

export interface StaffCalendar {
  readonly staff_id: string;
  readonly full_name: string;
  readonly title: string;
  readonly specialties: readonly string[];
  readonly languages: readonly string[];
  readonly locations: readonly string[];
  readonly rules: readonly WeeklyRule[];
  readonly exceptions: readonly CalendarException[];
  readonly busy: readonly BusyRange[];
}

export interface Slot {
  readonly start: Date;
  readonly end: Date;
}

export interface SlotOptions {
  readonly slotMinutes: number;
  readonly horizonDays: number;
  readonly timeZone: string;
  readonly now?: Date;
  readonly minNoticeMinutes?: number;
}

const MINUTE = 60_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isLocalDate = (value: unknown): value is string => typeof value === 'string' && DATE.test(value);
export const isLocalTime = (value: unknown): value is string => typeof value === 'string' && TIME.test(value);

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function localParts(date: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Minutes the zone is ahead of UTC at that instant (330 for India). */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  return (
    (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000) /
    MINUTE
  );
}

/** The instant of a local date and time ("2026-10-14", "09:30") in a zone. */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  const offset = zoneOffsetMinutes(new Date(naive), timeZone);
  return new Date(naive - offset * MINUTE);
}

/** The local date ("YYYY-MM-DD") of an instant. */
export function localDate(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** The local time ("HH:MM") of an instant. */
export function localTime(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Adds days to a local date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday of a local date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Every open slot of one calendar from now until the end of the horizon, in order. */
export function openSlots(
  calendar: Pick<StaffCalendar, 'rules' | 'exceptions' | 'busy'>,
  options: SlotOptions,
): Slot[] {
  const now = options.now ?? new Date();
  const earliest = now.getTime() + (options.minNoticeMinutes ?? BOOKING_MIN_NOTICE_MINUTES) * MINUTE;
  const busy = calendar.busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const);
  const today = localDate(now, options.timeZone);
  const slots: Slot[] = [];

  for (let offset = 0; offset <= options.horizonDays; offset += 1) {
    const date = addDays(today, offset);
    const exceptions = calendar.exceptions.filter((x) => x.date === date);
    if (exceptions.some((x) => x.kind === 'off' && x.start === null)) continue;
    const off = exceptions
      .filter((x) => x.kind === 'off' && x.start && x.end)
      .map((x) => [minutesOf(x.start!), minutesOf(x.end!)] as const);
    const windows = [
      ...calendar.rules.filter((r) => r.weekday === isoWeekday(date)).map((r) => [r.start, r.end] as const),
      ...exceptions.filter((x) => x.kind === 'extra' && x.start && x.end).map((x) => [x.start!, x.end!] as const),
    ];
    const starts = new Set<number>();
    for (const [from, to] of windows) {
      const end = minutesOf(to);
      for (let m = minutesOf(from); m + options.slotMinutes <= end; m += options.slotMinutes) {
        if (off.some(([s, e]) => overlaps(m, m + options.slotMinutes, s, e))) continue;
        starts.add(m);
      }
    }
    for (const m of [...starts].sort((a, b) => a - b)) {
      const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const start = zonedTime(date, time, options.timeZone);
      const end = new Date(start.getTime() + options.slotMinutes * MINUTE);
      if (start.getTime() < earliest) continue;
      if (busy.some(([s, e]) => overlaps(start.getTime(), end.getTime(), s, e))) continue;
      slots.push({ start, end });
    }
  }
  return slots;
}

/** Slots grouped by local date, in date order. */
export function slotsByDay(slots: readonly Slot[], timeZone: string): { date: string; slots: Slot[] }[] {
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const date = localDate(slot.start, timeZone);
    days.set(date, [...(days.get(date) ?? []), slot]);
  }
  return [...days.entries()].map(([date, daySlots]) => ({ date, slots: daySlots }));
}

/** "10:30 am" in the zone. */
export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(date)
    .replace(/\s?([ap])\.?m\.?/i, (_, x: string) => ` ${x.toLowerCase()}m`);
}

/** "Wed 14 Oct" for a local date. */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** "Wednesday 14 October, 10:30 am" (India time). */
export function formatAppointment(date: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(
    date,
  );
  return `${day}, ${formatTime(date, timeZone)}`;
}

/** The short name of the zone for labels: "India time" for Asia/Kolkata. */
export function zoneLabel(timeZone: string): string {
  return timeZone === 'Asia/Kolkata' ? 'India time' : timeZone;
}
