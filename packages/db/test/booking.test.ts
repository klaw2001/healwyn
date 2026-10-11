import {
  addDays,
  clinicDemoStaff,
  clinicPack,
  DEMO_USERS,
  demoAuthUserId,
  industryPacks,
  localDate,
  openSlots,
  planStageEntry,
  zonedTime,
  type Slot,
  type StaffRole,
} from '@healwyn/core';
import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { asUser, connect, databaseUrl, samplePayload } from './helpers';

const TZ = clinicPack.brand.timeZone;
const { booking } = clinicPack;
const doctors = clinicDemoStaff.filter((m) => m.role === 'specialist_doctor');
const user = (role: StaffRole) => DEMO_USERS.find((u) => u.role === role)!;
const plan = (stage: string, active: string[] = []) => planStageEntry(clinicPack.sequences, stage, active);

describe.skipIf(!databaseUrl)('booking', () => {
  const sql = databaseUrl ? connect() : (null as never);
  const store = databaseUrl ? createPostgresLeadStore(databaseUrl) : (null as never);
  afterAll(async () => {
    await store?.close();
    await sql?.end();
  });

  async function slotsFor(staffId: string): Promise<Slot[]> {
    const today = localDate(new Date(), TZ);
    const [calendar] = await store.bookingCalendar('clinic', [staffId], today, addDays(today, booking.horizonDays));
    expect(calendar?.staff_id).toBe(staffId);
    return openSlots(calendar!, { slotMinutes: booking.slotMinutes, horizonDays: booking.horizonDays, timeZone: TZ });
  }

  const newLead = async () => (await store.submitLead(await samplePayload())).id;
  const book = (leadId: string, staffId: string, slot: Slot, replaces?: string) =>
    store.bookAppointment({
      leadId,
      staffId,
      startsAt: slot.start,
      endsAt: slot.end,
      plan: plan(booking.bookedStageId),
      replaces,
    });

  it('books an open slot, assigns the lead and moves it to the booked stage', async () => {
    const doctor = doctors[2]!;
    const slots = await slotsFor(doctor.id);
    expect(slots.length).toBeGreaterThan(5);
    const leadId = await newLead();
    const context = await store.bookingContext(leadId);
    expect(context).toMatchObject({ industry: 'clinic', stage: 'new', appointment: null });

    const outcome = await book(leadId, doctor.id, slots[5]!);
    expect(outcome.ok).toBe(true);
    const [lead] = await sql`select stage, assigned_staff_id from public.leads where id = ${leadId}`;
    expect(lead).toEqual({ stage: booking.bookedStageId, assigned_staff_id: doctor.id });
    const events = await sql`select type from public.lead_events where lead_id = ${leadId} order by id`;
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['appointment.booked', 'lead.assigned', 'stage.changed', 'sequence.enrolled']),
    );
    // The slot is no longer offered.
    const after = await slotsFor(doctor.id);
    expect(after.some((s) => s.start.getTime() === slots[5]!.start.getTime())).toBe(false);
  });

  it('refuses double booking, a second open appointment and times outside the hours', async () => {
    const doctor = doctors[3]!;
    const [slot, other] = await slotsFor(doctor.id);
    const first = await newLead();
    const second = await newLead();
    expect((await book(first, doctor.id, slot!)).ok).toBe(true);
    expect(await book(second, doctor.id, slot!)).toEqual({ ok: false, reason: 'taken' });
    expect(await book(first, doctor.id, other!)).toEqual({ ok: false, reason: 'already_booked' });

    const night = zonedTime(addDays(localDate(new Date(), TZ), 2), '03:00', TZ);
    const nightSlot = { start: night, end: new Date(night.getTime() + booking.slotMinutes * 60_000) };
    expect(await book(second, doctor.id, nightSlot)).toEqual({ ok: false, reason: 'unavailable' });
    // A billing desk member does not take bookings.
    const billing = clinicDemoStaff.find((m) => m.role === 'billing_desk')!;
    expect(await book(second, billing.id, other!)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('enforces no double booking in the database itself', async () => {
    const doctor = doctors[4]!;
    const [slot] = await slotsFor(doctor.id);
    const a = await newLead();
    const b = await newLead();
    const insert = (leadId: string, offsetMinutes: number) => sql`
      insert into public.appointments (lead_id, staff_id, industry, starts_at, ends_at, booked_via)
      values (${leadId}, ${doctor.id}, 'clinic', ${new Date(slot!.start.getTime() + offsetMinutes * 60_000)},
              ${new Date(slot!.end.getTime() + offsetMinutes * 60_000)}, 'staff')`;
    await insert(a, 0);
    await expect(insert(b, 10)).rejects.toMatchObject({ code: '23P01' });
  });

  it('reschedules and cancels, returning the lead to its earlier stage', async () => {
    const doctor = doctors[5]!;
    const [first, second] = await slotsFor(doctor.id);
    const leadId = await newLead();
    const booked = await book(leadId, doctor.id, first!);
    expect(booked.ok).toBe(true);
    const moved = await book(leadId, doctor.id, second!, booked.ok ? booked.appointmentId : undefined);
    expect(moved.ok).toBe(true);
    const rows =
      await sql`select status, previous_stage from public.appointments where lead_id = ${leadId} order by created_at`;
    expect(rows).toEqual([
      { status: 'cancelled', previous_stage: 'new' },
      { status: 'booked', previous_stage: 'new' },
    ]);

    const context = (await store.bookingContext(leadId))!;
    const cancel = await store.cancelAppointment(
      leadId,
      context.appointment!.id,
      plan('new', context.active_sequences),
    );
    expect(cancel.ok).toBe(true);
    const [lead] = await sql`select stage from public.leads where id = ${leadId}`;
    expect(lead!.stage).toBe('new');
    expect((await store.bookingContext(leadId))!.appointment).toBeNull();
    // The freed slot is offered again.
    expect((await slotsFor(doctor.id)).some((s) => s.start.getTime() === second!.start.getTime())).toBe(true);
  });

  it('lets the front desk book anyone, an expert only themselves, and nobody else', async () => {
    const [slot] = await slotsFor(doctors[6]!.id);
    const leadId = await newLead();
    const args = (staffId: string) =>
      [leadId, staffId, slot!.start, slot!.end, JSON.stringify(plan(booking.bookedStageId))] as const;
    const call = (role: StaffRole, staffId: string) =>
      asUser(sql, demoAuthUserId(user(role).staffId), (tx) => {
        const [l, s, a, b, p] = args(staffId);
        return tx`select public.book_appointment(${l}, ${s}, ${a}, ${b}, ${p}::jsonb)`;
      });
    await expect(call('billing_desk', doctors[6]!.id)).rejects.toThrow(/may not/);
    // The demo expert can see only leads assigned to them, so the new lead is invisible.
    await expect(call('specialist_doctor', doctors[6]!.id)).rejects.toThrow(/may not|not found/);
    await call('care_coordinator', doctors[6]!.id);
    const [row] = await sql`select staff_id, booked_via from public.appointments where lead_id = ${leadId}`;
    expect(row).toEqual({ staff_id: doctors[6]!.id, booked_via: 'staff' });
  });

  it('marks attended, and turns overdue appointments into no-shows that start recovery', async () => {
    const doctor = doctors[1]!;
    const attended = await newLead();
    const missed = await newLead();
    for (const [leadId, hoursAgo] of [
      [attended, 30],
      [missed, 50],
    ] as const) {
      await sql`
        insert into public.appointments (lead_id, staff_id, industry, starts_at, ends_at, booked_via, previous_stage)
        values (${leadId}, ${doctor.id}, 'clinic', now() - make_interval(hours => ${hoursAgo}),
                now() - make_interval(hours => ${hoursAgo}) + interval '30 minutes', 'staff', 'new')`;
      await sql`update public.leads set stage = ${booking.bookedStageId}, assigned_staff_id = ${doctor.id} where id = ${leadId}`;
    }
    const [visit] = await sql`select id from public.appointments where lead_id = ${attended}`;
    await asUser(
      sql,
      demoAuthUserId(user('care_coordinator').staffId),
      (tx) =>
        tx`select public.mark_appointment(${visit!.id}, 'attended', ${JSON.stringify(plan(booking.attendedStageId))}::jsonb)`,
    );
    const [a] = await sql`select stage from public.leads where id = ${attended}`;
    expect(a!.stage).toBe(booking.attendedStageId);

    const overdue = await sql<{ appointment_id: string; lead_id: string; industry: string }[]>`
      select * from public.overdue_appointments(interval '2 hours', 200)`;
    const due = overdue.find((o) => o.lead_id === missed);
    expect(due?.industry).toBe('clinic');
    expect(overdue.some((o) => o.lead_id === attended)).toBe(false);
    await sql`select public.record_no_show(${due!.appointment_id}, ${sql.json(plan(booking.noShowStageId) as never)})`;
    const [m] = await sql`select stage from public.leads where id = ${missed}`;
    expect(m!.stage).toBe(booking.noShowStageId);
    const enrolled =
      await sql`select sequence_id from public.sequence_enrollments where lead_id = ${missed} and status = 'active'`;
    const recovery = clinicPack.sequences.find((s) => s.enrolOnStage === booking.noShowStageId)!;
    expect(enrolled.map((e) => e.sequence_id)).toContain(recovery.id);
  });

  it('shows appointments only to staff who can see the lead, and calendars only within an industry', async () => {
    const otherPack = industryPacks.real_estate;
    const coordinator = otherPack.demo.staff.find((m) => m.role === 'care_coordinator')!;
    const seen = await asUser(sql, demoAuthUserId(coordinator.id), async (tx) => ({
      appointments: await tx`select a.id from public.appointments a where a.industry = 'clinic'`,
      rules: await tx`select r.id from public.availability_rules r where r.staff_id = ${doctors[0]!.id}`,
      calendar:
        await tx`select public.staff_calendar(${[doctors[0]!.id]}::uuid[], current_date, current_date + 7) as c`,
    }));
    expect(seen.appointments).toEqual([]);
    expect(seen.rules).toEqual([]);
    expect(seen.calendar[0]!.c).toEqual([]);
  });
});
