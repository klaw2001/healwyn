import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatAppointment,
  formatTime,
  isoWeekday,
  localDate,
  localTime,
  openSlots,
  slotsByDay,
  zonedTime,
  type StaffCalendar,
} from '../src';

const TZ = 'Asia/Kolkata';
// Monday 12 October 2026, 08:00 India time.
const now = zonedTime('2026-10-12', '08:00', TZ);
const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '12:00' }));
const calendar = (over: Partial<StaffCalendar> = {}) => ({ rules: weekdays, exceptions: [], busy: [], ...over });
const options = { slotMinutes: 60, horizonDays: 6, timeZone: TZ, now };

describe('India time helpers', () => {
  it('converts local times to instants and back', () => {
    const instant = zonedTime('2026-10-14', '09:30', TZ);
    expect(instant.toISOString()).toBe('2026-10-14T04:00:00.000Z');
    expect(localDate(instant, TZ)).toBe('2026-10-14');
    expect(localTime(instant, TZ)).toBe('09:30');
    // 23:00 UTC is already the next day in India.
    expect(localDate(new Date('2026-10-14T23:00:00Z'), TZ)).toBe('2026-10-15');
  });

  it('knows weekdays and adds days across months', () => {
    expect(isoWeekday('2026-10-12')).toBe(1);
    expect(isoWeekday('2026-10-18')).toBe(7);
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('formats times for people', () => {
    expect(formatTime(zonedTime('2026-10-14', '14:30', TZ), TZ)).toBe('2:30 pm');
    expect(formatAppointment(zonedTime('2026-10-14', '09:00', TZ), TZ)).toBe('Wednesday 14 October, 9:00 am');
  });
});

describe('openSlots', () => {
  it('offers the weekly template, weekdays only', () => {
    const days = slotsByDay(openSlots(calendar(), options), TZ);
    expect(days.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    expect(days[0]!.slots.map((s) => localTime(s.start, TZ))).toEqual(['09:00', '10:00', '11:00']);
  });

  it('keeps a notice period before the first slot', () => {
    const late = zonedTime('2026-10-12', '09:30', TZ);
    const first = openSlots(calendar(), { ...options, now: late })[0]!;
    expect(localTime(first.start, TZ)).toBe('11:00');
  });

  it('removes busy times, days off and hours off, and adds extra hours', () => {
    const slots = openSlots(
      calendar({
        busy: [{ start: zonedTime('2026-10-13', '10:00', TZ), end: zonedTime('2026-10-13', '11:00', TZ) }],
        exceptions: [
          { date: '2026-10-14', kind: 'off', start: null, end: null },
          { date: '2026-10-15', kind: 'off', start: '09:30', end: '10:30' },
          { date: '2026-10-17', kind: 'extra', start: '10:00', end: '12:00' },
        ],
      }),
      options,
    );
    const byDay = Object.fromEntries(
      slotsByDay(slots, TZ).map((d) => [d.date, d.slots.map((s) => localTime(s.start, TZ))]),
    );
    expect(byDay).toEqual({
      '2026-10-12': ['09:00', '10:00', '11:00'],
      '2026-10-13': ['09:00', '11:00'],
      '2026-10-15': ['11:00'],
      '2026-10-16': ['09:00', '10:00', '11:00'],
      '2026-10-17': ['10:00', '11:00'],
    });
  });

  it('never offers a slot that runs past the end of the hours', () => {
    const slots = openSlots(calendar({ rules: [{ weekday: 1, start: '09:00', end: '10:30' }] }), {
      ...options,
      slotMinutes: 45,
    });
    expect(slots.map((s) => localTime(s.start, TZ))).toEqual(['09:00', '09:45']);
  });
});
