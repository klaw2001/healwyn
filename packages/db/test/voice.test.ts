import { clinicDemoStaff, DEMO_USERS, demoAuthUserId, type StaffRole } from '@healwyn/core';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { asUser, connect, databaseUrl, samplePayload } from './helpers';

const user = (role: StaffRole) => demoAuthUserId(DEMO_USERS.find((u) => u.role === role)!.staffId);
const RULES = {
  consent_purpose: 'assistant_call',
  max_per_day: 10_000,
  window_start: 0,
  window_end: 24,
  time_zone: 'Asia/Kolkata',
  require_verified: false,
};

describe.skipIf(!databaseUrl)('voice calls in the database', () => {
  const sql = databaseUrl ? connect() : (null as never);
  const store = databaseUrl ? createPostgresLeadStore(databaseUrl) : (null as never);
  afterAll(async () => {
    await store?.close();
    await sql?.end();
  });

  const asRole = <T>(role: string, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    sql.begin(async (tx) => {
      await tx.unsafe(`set local role ${role}`);
      return fn(tx);
    }) as Promise<T>;
  const startWeb = (leadId: string, rules: object = RULES) =>
    asRole('web_submitter', async (tx) => {
      const [row] = await tx<{ r: { allowed: boolean; reason?: string; call_id?: string } }[]>`
        select public.start_web_call(${leadId}, 'browser', ${tx.json(rules as never)}) as r`;
      return row!.r;
    });
  const result = (callId: string, leadId: string, overrides: object = {}) => ({
    version: 1,
    callId,
    leadId,
    channel: 'browser',
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    endedAt: new Date().toISOString(),
    durationSeconds: 120,
    language: 'hi',
    consentToContinue: true,
    outcome: 'completed',
    urgency: 'normal',
    answers: { concern_category: 'dermatology', visit_type: 'first' },
    safetyFlags: [],
    summary: ['Looking for help with Dermatology; First visit.'],
    transcript: [{ speaker: 'caller', text: 'त्वचा', atSeconds: 10 }],
    usage: { llmRequests: 1, sttSeconds: 60, ttsCharacters: 500 },
    agentVersion: 'test',
    ...overrides,
  });
  const record = (call: object, update: object) =>
    asRole('crm_server', async (tx) => {
      const [row] = await tx<{ r: Record<string, unknown> }[]>`
        select public.record_voice_call(${tx.json(call as never)}, ${tx.json(update as never)}) as r`;
      return row!.r;
    });

  it('starts a browser call only with call consent, and logs refusals with a reason', async () => {
    const consenting = await store.submitLead(await samplePayload());
    const started = await startWeb(consenting.id);
    expect(started).toMatchObject({ allowed: true });
    const [session] = await sql`select status, channel from public.call_sessions where id = ${started.call_id!}`;
    expect(session).toEqual({ status: 'started', channel: 'browser' });

    const noConsent = await store.submitLead(await samplePayload({ consent_assistant_call: undefined }));
    expect(await startWeb(noConsent.id)).toMatchObject({ allowed: false, reason: 'no_call_consent' });
    const events = await sql<{ payload: { reason: string } }[]>`
      select payload from public.lead_events where lead_id = ${noConsent.id} and type = 'call.refused'`;
    expect(events.map((e) => e.payload.reason)).toEqual(['no_call_consent']);
  });

  it('enforces the daily cap', async () => {
    const lead = await store.submitLead(await samplePayload());
    const [counted] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.call_sessions
      where started_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`;
    const n = counted!.n;
    expect(await startWeb(lead.id, { ...RULES, max_per_day: n })).toMatchObject({
      allowed: false,
      reason: 'daily_limit',
    });
    expect(await startWeb(lead.id, { ...RULES, max_per_day: n + 1 })).toMatchObject({ allowed: true });
  });

  it('lets only the front desk place outbound calls, inside the call window, to verified numbers when required', async () => {
    const lead = await store.submitLead(await samplePayload());
    const place = (role: StaffRole, rules: object) =>
      asUser(sql, user(role), async (tx) => {
        const [row] = await tx<{ r: { allowed: boolean; reason?: string } }[]>`
          select public.place_assistant_call(${lead.id}, 'simulated', ${tx.json(rules as never)}) as r`;
        return row!.r;
      });
    await expect(place('specialist_doctor', RULES)).rejects.toThrow(/may not do this/);
    expect(await place('care_coordinator', { ...RULES, window_start: 0, window_end: 0 })).toMatchObject({
      allowed: false,
      reason: 'outside_call_window',
    });
    expect(await place('care_coordinator', { ...RULES, require_verified: true })).toMatchObject({
      allowed: false,
      reason: 'number_not_verified',
    });
    const [row] = await sql<{ phone: string }[]>`select phone from public.leads where id = ${lead.id}`;
    const phone = row!.phone;
    await asUser(sql, user('manager'), (tx) => tx`select public.add_verified_number(${phone}, 'Demo phone')`);
    await expect(
      asUser(sql, user('care_coordinator'), (tx) => tx`select public.add_verified_number(${phone}, 'x')`),
    ).rejects.toThrow(/may not do this/);
    expect(await place('care_coordinator', { ...RULES, require_verified: true })).toMatchObject({ allowed: true });
    await asUser(sql, user('manager'), (tx) => tx`select public.remove_verified_number(${phone})`);
  });

  it('records a finished call once, merges what the caller said and keeps the higher urgency', async () => {
    const lead = await store.submitLead(await samplePayload({ concern_category: 'not-sure' }));
    const { call_id } = await startWeb(lead.id);
    await expect(record(result(randomUUID(), lead.id), {})).rejects.toThrow(/unknown call/);

    const update = {
      answers: { concern_category: 'dermatology', visit_type: 'first' },
      specialty_slug: 'dermatology',
      billing_flag: false,
      urgency: 'high',
      preferred_language: 'hi',
      message: 'Rash on the arm',
    };
    expect(await record(result(call_id!, lead.id, { urgency: 'high' }), update)).toMatchObject({ status: 'recorded' });
    expect(await record(result(call_id!, lead.id), update)).toMatchObject({ status: 'duplicate' });

    const [row] = await sql<
      { specialty_slug: string; urgency: string; preferred_language: string; billing_flag: boolean }[]
    >`
      select specialty_slug, urgency, preferred_language, billing_flag from public.leads where id = ${lead.id}`;
    expect(row).toEqual({
      specialty_slug: 'dermatology',
      urgency: 'high',
      preferred_language: 'hi',
      billing_flag: false,
    });
    const events = await sql<{ type: string }[]>`
      select type from public.lead_events where lead_id = ${lead.id} and type like 'call.%' order by created_at, id`;
    expect(events.map((e) => e.type)).toEqual(['call.started', 'call.completed']);
    await expect(
      asUser(sql, user('manager'), (tx) => tx`select public.record_voice_call('{}'::jsonb, '{}'::jsonb)`),
    ).rejects.toThrow(/permission denied/);
  });

  it('after a red flag: triaged by the system (not a human response), routed, and an urgent task', async () => {
    const lead = await store.submitLead(await samplePayload());
    const { call_id } = await startWeb(lead.id);
    await record(
      result(call_id!, lead.id, {
        outcome: 'emergency',
        urgency: 'urgent',
        safetyFlags: [{ kind: 'red_flag', code: 'chest_pain', turn: 3 }],
      }),
      { answers: {}, urgency: 'urgent' },
    );
    const senior = clinicDemoStaff.find((m) => m.fullName === 'Dr. Asha Raman')!.id;
    await asRole(
      'crm_server',
      (tx) =>
        tx`select public.apply_voice_outcome(${lead.id}, ${call_id!}, 'ai_triaged', null, ${senior},
                                            ${tx.json({ method: 'routing', explanation: ['Urgent: test.'] })})`,
    );
    const [row] = await sql<
      { stage: string; urgency: string; first_response_at: Date | null; assigned_staff_id: string }[]
    >`
      select stage, urgency, first_response_at, assigned_staff_id from public.leads where id = ${lead.id}`;
    expect(row).toEqual({ stage: 'ai_triaged', urgency: 'urgent', first_response_at: null, assigned_staff_id: senior });
    const tasks = await sql<{ title: string; assignee_staff_id: string }[]>`
      select title, assignee_staff_id from public.tasks where lead_id = ${lead.id} and title like 'Urgent:%'`;
    expect(tasks).toEqual([{ title: expect.stringMatching(/safety concern/), assignee_staff_id: senior }]);
    const flagged = await sql`select 1 from public.lead_events where lead_id = ${lead.id} and type = 'safety.flagged'`;
    expect(flagged).toHaveLength(1);
  });

  it('withdraws call consent when the caller declines, so the dialer will not call again', async () => {
    const lead = await store.submitLead(await samplePayload());
    const { call_id } = await startWeb(lead.id);
    await record(result(call_id!, lead.id, { outcome: 'consent_declined', consentToContinue: false, answers: {} }), {
      answers: {},
      withdraw_purpose: 'assistant_call',
    });
    expect(await startWeb(lead.id)).toMatchObject({ allowed: false, reason: 'no_call_consent' });
  });

  it('shows call content only to staff who can see the lead, and erasure scrubs it', async () => {
    const lead = await store.submitLead(await samplePayload());
    const { call_id } = await startWeb(lead.id);
    await record(result(call_id!, lead.id), { answers: { concern_category: 'dermatology' } });
    const asDoctor = await asUser(
      sql,
      user('specialist_doctor'),
      (tx) => tx`select id from public.call_sessions where id = ${call_id!}`,
    );
    expect(asDoctor).toHaveLength(0);
    const asCoordinator = await asUser(
      sql,
      user('care_coordinator'),
      (tx) => tx`select id from public.call_sessions where id = ${call_id!}`,
    );
    expect(asCoordinator).toHaveLength(1);

    await sql`select public.erase_lead(${lead.id}, 'test')`;
    const [scrubbed] = await sql`select answers, summary, transcript from public.call_sessions where id = ${call_id!}`;
    expect(scrubbed).toEqual({ answers: {}, summary: [], transcript: [] });
  });
});
