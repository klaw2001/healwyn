import {
  assignLead,
  assignmentRecord,
  clinicPack,
  DEMO_USERS,
  demoAuthUserId,
  type RosterMember,
  type StaffRole,
} from '@healwyn/core';
import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { asUser, connect, databaseUrl, samplePayload } from './helpers';

const user = (role: StaffRole) => demoAuthUserId(DEMO_USERS.find((u) => u.role === role)!.staffId);
const OPEN = clinicPack.stages.filter((s) => s.kind === 'open').map((s) => s.id);

interface Context {
  lead: { id: string; specialty_slug: string | null; urgency: string; billing_flag: boolean };
  previous_staff_id: string | null;
  roster: {
    id: string;
    full_name: string;
    role: StaffRole;
    level: string;
    active: boolean;
    specialties: string[];
    languages: string[];
    capacity: number;
    open_leads: number;
    last_assigned_at: string | null;
  }[];
}

describe.skipIf(!databaseUrl)('routing in the database', () => {
  const sql = databaseUrl ? connect() : (null as never);
  const store = databaseUrl ? createPostgresLeadStore(databaseUrl) : (null as never);
  afterAll(async () => {
    await store?.close();
    await sql?.end();
  });

  const contextAs = (role: StaffRole, leadId: string) =>
    asUser(sql, user(role), async (tx) => {
      const [row] = await tx<{ c: Context }[]>`select public.routing_context(${leadId}, ${OPEN}) as c`;
      return row!.c;
    });

  it('gives the front desk the roster with live load, and refuses everyone else', async () => {
    const { id: leadId } = await store.submitLead(await samplePayload());
    const context = await contextAs('care_coordinator', leadId);
    expect(context.lead).toMatchObject({ id: leadId, specialty_slug: 'dental', billing_flag: true });
    const counts = await sql<{ id: string; n: number }[]>`
      select s.id, count(l.id)::int as n from public.staff s
      left join public.leads l on l.assigned_staff_id = s.id and l.erased_at is null and l.stage = any (${OPEN})
      where s.active group by s.id`;
    for (const member of context.roster) {
      expect(member.open_leads).toBe(counts.find((c) => c.id === member.id)!.n);
    }
    await expect(contextAs('specialist_doctor', leadId)).rejects.toThrow(/may not do this/);
    await expect(
      asUser(sql, user('manager'), (tx) => tx`select public.system_routing_context(${leadId}, ${OPEN})`),
    ).rejects.toThrow(/permission denied/);
  });

  it('finds a returning patient’s previous clinician by phone', async () => {
    const payload = await samplePayload();
    const first = await store.submitLead(payload);
    const doctor = DEMO_USERS.find((u) => u.role === 'specialist_doctor')!.staffId;
    await asUser(sql, user('care_coordinator'), (tx) => tx`select public.assign_lead(${first.id}, ${doctor})`);
    const second = await store.submitLead({ ...payload });
    const context = await contextAs('care_coordinator', second.id);
    expect(context.previous_staff_id).toBe(doctor);
  });

  it('applies a routing decision: assignee, method, explanation and a single billing copy-in task', async () => {
    const { id: leadId } = await store.submitLead(await samplePayload({ concern_category: 'dermatology' }));
    const context = await contextAs('care_coordinator', leadId);
    const roster: RosterMember[] = context.roster.map((m) => ({
      id: m.id,
      fullName: m.full_name,
      role: m.role,
      level: m.level,
      active: m.active,
      specialties: m.specialties,
      languages: m.languages,
      capacity: m.capacity,
      openLeads: m.open_leads,
      lastAssignedAt: m.last_assigned_at ? new Date(m.last_assigned_at) : null,
    }));
    const decision = assignLead(
      {
        id: leadId,
        specialtySlug: 'dermatology',
        urgency: 'normal',
        preferredLanguage: 'en',
        assignedStaffId: null,
        billingFlag: context.lead.billing_flag,
        previousStaffId: context.previous_staff_id,
      },
      { mode: 'auto', roster, config: clinicPack.routing, staffLevels: clinicPack.staffLevels },
    );
    expect(decision.routing?.copyIn).toHaveLength(1);
    const record = assignmentRecord(decision);
    for (let i = 0; i < 2; i += 1) {
      await asUser(
        sql,
        user('care_coordinator'),
        (tx) => tx`select public.assign_lead(${leadId}, ${decision.staffId}, 'routing', ${tx.json(record as never)})`,
      );
    }
    const [lead] = await sql<
      { assigned_staff_id: string }[]
    >`select assigned_staff_id from public.leads where id = ${leadId}`;
    expect(lead!.assigned_staff_id).toBe(decision.staffId);
    const events = await sql<{ id: string; payload: { method: string; routing: Record<string, unknown> } }[]>`
      select id, payload from public.lead_events where lead_id = ${leadId} and type = 'lead.assigned'`;
    expect(events).toHaveLength(1);
    expect(events[0]!.payload.method).toBe('routing');
    // The audit trail keeps codes, ids and scores; the words live beside it and go with erasure.
    expect(events[0]!.payload.routing).not.toHaveProperty('explanation');
    expect(events[0]!.payload.routing).toMatchObject({ pool: 'specialty' });
    const [explained] = await sql<{ lines: string[] }[]>`
      select lines from public.assignment_explanations where event_id = ${events[0]!.id}`;
    expect(explained!.lines.join(' ')).toMatch(/dermatology team/i);
    const tasks = await sql<{ title: string; assignee_staff_id: string }[]>`
      select title, assignee_staff_id from public.tasks where lead_id = ${leadId}`;
    expect(tasks).toEqual([
      { title: 'Check insurance cover', assignee_staff_id: decision.routing!.copyIn[0]!.staffId },
    ]);
    await sql`select public.erase_lead(${leadId}, 'test')`;
    expect(await sql`select 1 from public.assignment_explanations where lead_id = ${leadId}`).toHaveLength(0);
  });

  it('rejects unknown methods, free-text reasons and oversized routing payloads', async () => {
    const { id: leadId } = await store.submitLead(await samplePayload());
    const staffId = DEMO_USERS.find((u) => u.role === 'care_coordinator')!.staffId;
    const attempt = (reason: string, routing: unknown) =>
      asUser(
        sql,
        user('manager'),
        (tx) => tx`select public.assign_lead(${leadId}, ${staffId}, ${reason}, ${tx.json(routing as never)})`,
      );
    await expect(attempt('manual', { method: 'magic', explanation: [] })).rejects.toThrow(/unknown assignment method/);
    await expect(attempt('because the patient said so', { method: 'manual' })).rejects.toThrow(/short code/);
    await expect(attempt('manual', { method: 'manual', explanation: ['x'.repeat(20_000)] })).rejects.toThrow(
      /small object/,
    );
    await expect(
      attempt('manual', { method: 'manual', copy_in: [{ staff_id: staffId, reason: 'free text here' }] }),
    ).rejects.toThrow(/short code/);
    // Only known fields, and nothing but codes, ids and numbers outside the explanation.
    await expect(attempt('manual', { method: 'manual', note: 'the patient said…' })).rejects.toThrow(/unexpected/);
    await expect(
      attempt('manual', { method: 'manual', candidates: [{ staff_id: staffId, total: 1, why: 'free text' }] }),
    ).rejects.toThrow(/unexpected/);
    await expect(attempt('manual', { method: 'manual', explanation: ['x'.repeat(400)] })).rejects.toThrow(
      /short lines/,
    );
  });
});
