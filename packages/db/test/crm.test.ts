import {
  canSeeLead,
  clinicDemoStaff,
  clinicPack,
  DEMO_USERS,
  demoAuthUserId,
  planStageEntry,
  type StaffRole,
} from '@healwyn/core';
import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { asUser, connect, databaseUrl, samplePayload } from './helpers';

const user = (role: StaffRole) => demoAuthUserId(DEMO_USERS.find((u) => u.role === role)!.staffId);
const staffIdOf = (role: StaffRole) => DEMO_USERS.find((u) => u.role === role)!.staffId;
const asha = clinicDemoStaff.find((m) => m.fullName === 'Dr. Asha Raman')!;
const vikram = clinicDemoStaff.find((m) => m.fullName === 'Dr. Vikram Sethi')!;

describe.skipIf(!databaseUrl)('CRM access control (RLS and staff functions)', () => {
  const sql = databaseUrl ? connect() : (null as never);
  const store = databaseUrl ? createPostgresLeadStore(databaseUrl) : (null as never);
  afterAll(async () => {
    await store?.close();
    await sql?.end();
  });

  it('shows every staff member exactly the leads canSeeLead allows', async () => {
    const leads = await sql<{ id: string; assigned_staff_id: string | null; billing_flag: boolean; stage: string }[]>`
      select id, assigned_staff_id, billing_flag, stage from public.leads`;
    expect(leads.length).toBeGreaterThan(30);
    for (const member of clinicDemoStaff) {
      const visible = await asUser(
        sql,
        demoAuthUserId(member.id),
        (tx) => tx<{ id: string }[]>`select id from public.leads`,
      );
      const expected = leads
        .filter((l) =>
          canSeeLead(member.role, member.id, {
            assignedStaffId: l.assigned_staff_id,
            hasInsurance: l.billing_flag,
            stage: l.stage,
          }),
        )
        .map((l) => l.id)
        .sort();
      expect({ who: member.fullName, ids: visible.map((v) => v.id).sort() }).toEqual({
        who: member.fullName,
        ids: expected,
      });
    }
  });

  it('never lets a doctor read another doctor’s lead, or its history and notes', async () => {
    const [lead] = await sql<{ id: string }[]>`
      select id from public.leads where assigned_staff_id = ${vikram.id} limit 1`;
    expect(lead).toBeDefined();
    const seen = await asUser(sql, demoAuthUserId(asha.id), async (tx) => ({
      lead: await tx`select id from public.leads where id = ${lead!.id}`,
      events: await tx`select id from public.lead_events where lead_id = ${lead!.id}`,
      notes: await tx`select id from public.notes where lead_id = ${lead!.id}`,
      messages: await tx`select id from public.messages where lead_id = ${lead!.id}`,
    }));
    expect(seen).toEqual({ lead: [], events: [], notes: [], messages: [] });
    await expect(
      asUser(sql, demoAuthUserId(asha.id), (tx) => tx`select public.add_note(${lead!.id}, 'peeking', null)`),
    ).rejects.toThrow(/lead not found/);
  });

  it('allows no direct writes to CRM tables, only the audited functions', async () => {
    const [lead] = await sql<{ id: string }[]>`select id from public.leads where is_demo limit 1`;
    for (const statement of [
      `insert into public.notes (lead_id, body) values ('${lead!.id}', 'x')`,
      `update public.leads set stage = 'lost' where id = '${lead!.id}'`,
      `delete from public.tasks`,
      `insert into public.lead_events (lead_id, type) values ('${lead!.id}', 'lead.hacked')`,
    ]) {
      await expect(asUser(sql, user('manager'), (tx) => tx.unsafe(statement))).rejects.toThrow(/permission denied/);
    }
  });

  it('lets only managers and coordinators assign leads, and records who did it', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await expect(
      asUser(sql, user('specialist_doctor'), (tx) => tx`select public.assign_lead(${id}, ${asha.id}, 'manual', null)`),
    ).rejects.toThrow(/may not do this|lead not found/);
    await expect(
      asUser(sql, user('billing_desk'), (tx) => tx`select public.assign_lead(${id}, ${asha.id}, 'manual', null)`),
    ).rejects.toThrow(/may not do this/);
    await asUser(
      sql,
      user('care_coordinator'),
      (tx) => tx`select public.assign_lead(${id}, ${asha.id}, 'manual', null)`,
    );
    const [lead] = await sql`select assigned_staff_id from public.leads where id = ${id}`;
    expect(lead?.assigned_staff_id).toBe(asha.id);
    const [event] =
      await sql`select actor_type, actor_id, payload from public.lead_events where lead_id = ${id} and type = 'lead.assigned'`;
    expect(event).toMatchObject({ actor_type: 'staff', actor_id: staffIdOf('care_coordinator') });
    expect(event?.payload).toMatchObject({ to_staff_id: asha.id, reason: 'manual', method: 'manual' });
    // Now assigned, Dr. Asha can see it.
    const visible = await asUser(
      sql,
      demoAuthUserId(asha.id),
      (tx) => tx`select id from public.leads where id = ${id}`,
    );
    expect(visible).toHaveLength(1);
  });

  it('changes stage, applies the nurture plan and starts the SLA clock in one call', async () => {
    const { id } = await store.submitLead(await samplePayload());
    const active = (
      await sql<{ sequence_id: string }[]>`
      select sequence_id from public.sequence_enrollments where lead_id = ${id} and status = 'active'`
    ).map((r) => r.sequence_id);
    expect(active).toEqual(['new-lead-welcome']);

    const plan = planStageEntry(clinicPack.sequences, 'appointment_booked', active);
    const [result] = await asUser(
      sql,
      user('care_coordinator'),
      (tx) =>
        tx`select public.change_lead_stage(${id}, 'appointment_booked', ${tx.json(plan as never)}, 'manual') as r`,
    );
    expect(result?.r).toMatchObject({
      from: 'new',
      to: 'appointment_booked',
      changed: true,
      enrolled: 1,
      cancelled: 1,
    });

    const enrollments =
      await sql`select sequence_id, status, stop_reason from public.sequence_enrollments where lead_id = ${id} order by enrolled_at, sequence_id`;
    expect(enrollments).toEqual([
      { sequence_id: 'new-lead-welcome', status: 'stopped', stop_reason: 'stage_changed' },
      { sequence_id: 'appointment-reminder', status: 'active', stop_reason: null },
    ]);
    const [cancelledSteps] = await sql`
      select count(*)::int as n from public.scheduled_messages s join public.sequence_enrollments e on e.id = s.enrollment_id
      where e.lead_id = ${id} and e.sequence_id = 'new-lead-welcome' and s.status = 'pending'`;
    expect(cancelledSteps?.n).toBe(0);
    const [lead] = await sql`select stage, first_response_at from public.leads where id = ${id}`;
    expect(lead?.stage).toBe('appointment_booked');
    expect(lead?.first_response_at).toBeInstanceOf(Date);
    const types = (await sql`select type from public.lead_events where lead_id = ${id} order by id`).map((e) => e.type);
    expect(types).toEqual([
      'lead.created',
      'consent.recorded',
      'sequence.enrolled',
      'stage.changed',
      'sequence.stopped',
      'sequence.enrolled',
    ]);
  });

  it('marks a reply, which stops every running sequence', async () => {
    const { id } = await store.submitLead(await samplePayload());
    const [row] = await asUser(sql, user('care_coordinator'), (tx) => tx`select public.mark_replied(${id}) as stopped`);
    expect(row?.stopped).toBe(1);
    const [pending] =
      await sql`select count(*)::int as n from public.scheduled_messages where lead_id = ${id} and status = 'pending'`;
    expect(pending?.n).toBe(0);
  });

  it('records notes and tasks under the acting staff member', async () => {
    const { id } = await store.submitLead(await samplePayload());
    const [note] = await asUser(
      sql,
      user('care_coordinator'),
      (tx) => tx`select public.add_note(${id}, '  Called, no answer.  ', 'call-no-answer') as id`,
    );
    const [task] = await asUser(
      sql,
      user('care_coordinator'),
      (tx) => tx`select public.create_task(${id}, 'Call back', now() + interval '1 day', null, null) as id`,
    );
    await asUser(sql, user('care_coordinator'), (tx) => tx`select public.complete_task(${task!.id})`);
    const [stored] = await sql`select body, author_staff_id from public.notes where id = ${note!.id}`;
    expect(stored).toEqual({ body: 'Called, no answer.', author_staff_id: staffIdOf('care_coordinator') });
    const [done] =
      await sql`select assignee_staff_id, completed_by_staff_id, completed_at from public.tasks where id = ${task!.id}`;
    expect(done?.assignee_staff_id).toBe(staffIdOf('care_coordinator'));
    expect(done?.completed_by_staff_id).toBe(staffIdOf('care_coordinator'));
    expect(done?.completed_at).toBeInstanceOf(Date);
  });

  it('lets only the front desk record a withdrawal, which erases notes and message bodies', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await asUser(sql, user('care_coordinator'), (tx) => tx`select public.add_note(${id}, 'Personal detail', null)`);
    await sql`update public.messages set body = body where lead_id = ${id}`;
    await expect(
      asUser(sql, user('billing_desk'), (tx) => tx`select public.record_consent_withdrawal(${id}, 'contact', true)`),
    ).rejects.toThrow(/may not do this/);
    await asUser(sql, user('manager'), (tx) => tx`select public.record_consent_withdrawal(${id}, 'contact', true)`);
    const [lead] = await sql`select full_name, erased_at from public.leads where id = ${id}`;
    expect(lead?.full_name).toBeNull();
    const [notes] = await sql`select count(*)::int as n from public.notes where lead_id = ${id}`;
    expect(notes?.n).toBe(0);
    const [active] =
      await sql`select count(*)::int as n from public.sequence_enrollments where lead_id = ${id} and status = 'active'`;
    expect(active?.n).toBe(0);
  });

  it('lets only managers pause a sequence', async () => {
    await expect(
      asUser(
        sql,
        user('care_coordinator'),
        (tx) => tx`select public.set_sequence_paused('clinic', 'package-renewal', true)`,
      ),
    ).rejects.toThrow(/may not do this/);
    await asUser(
      sql,
      user('manager'),
      (tx) => tx`select public.set_sequence_paused('clinic', 'package-renewal', true)`,
    );
    await asUser(
      sql,
      user('manager'),
      (tx) => tx`select public.set_sequence_paused('clinic', 'package-renewal', false)`,
    );
    const [setting] =
      await sql`select paused, updated_by_staff_id from public.sequence_settings where sequence_id = 'package-renewal'`;
    expect(setting).toEqual({ paused: false, updated_by_staff_id: staffIdOf('manager') });
  });

  it('checks staff passwords against Supabase Auth users', async () => {
    const email = (await sql`select email from auth.users where id = ${user('manager')}`)[0]?.email as string;
    const [ok] = await sql`select public.verify_staff_password(${email.toUpperCase()}, 'demo-pass-2026') as id`;
    expect(ok?.id).toBe(user('manager'));
    const [bad] = await sql`select public.verify_staff_password(${email}, 'wrong') as id`;
    expect(bad?.id).toBeNull();
    const [who] = await sql`select * from public.staff_for_auth_user(${user('manager')})`;
    expect(who).toMatchObject({ role: 'manager', full_name: 'Anita Kapoor' });
  });

  it('lets the website unsubscribe a lead, which stops its sequences', async () => {
    const { id } = await store.submitLead(await samplePayload());
    const [first] = await sql`select public.opt_out_lead(${id}, 'email_link') as changed`;
    const [again] = await sql`select public.opt_out_lead(${id}, 'email_link') as changed`;
    expect([first?.changed, again?.changed]).toEqual([true, false]);
    const [active] =
      await sql`select count(*)::int as n from public.sequence_enrollments where lead_id = ${id} and status = 'active'`;
    expect(active?.n).toBe(0);
  });
});
