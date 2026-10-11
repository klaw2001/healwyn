import { callPolicies, clinicDemoStaff, clinicPack, DEMO_USERS, demoAuthUserId, type StaffRole } from '@healwyn/core';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { callPolicySql } from '../src/seed';
import { asUser, connect, databaseUrl, samplePayload } from './helpers';

const user = (role: StaffRole) => demoAuthUserId(DEMO_USERS.find((u) => u.role === role)!.staffId);
const callPolicyRows = async () => callPolicies(clinicPack).map(callPolicySql).join('\n');

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
  const startWeb = (leadId: string, channel: 'browser' | 'text' = 'browser') =>
    asRole('web_submitter', async (tx) => {
      const [row] = await tx<{ r: { allowed: boolean; reason?: string; call_id?: string } }[]>`
        select public.start_web_call(${leadId}, ${channel}) as r`;
      return row!.r;
    });
  /** The call rules live in SQL (written from the pack by the seed); a test changes one and restores it. */
  const withPolicy = async <T>(channel: string, changes: Record<string, unknown>, fn: () => Promise<T>) => {
    const [before] = await sql`select * from public.call_policies where industry = 'clinic' and channel = ${channel}`;
    await sql`update public.call_policies set ${sql(changes)} where industry = 'clinic' and channel = ${channel}`;
    try {
      return await fn();
    } finally {
      const restore = Object.fromEntries(Object.keys(changes).map((k) => [k, before![k]]));
      await sql`update public.call_policies set ${sql(restore)} where industry = 'clinic' and channel = ${channel}`;
    }
  };
  const callsToday = async (channels: string[]) => {
    const [counted] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.call_sessions
      where channel in ${sql(channels)}
        and started_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`;
    return counted!.n;
  };
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

  it('enforces a daily cap per group, so website calls cannot use up the dialer', async () => {
    const lead = await store.submitLead(await samplePayload());
    const n = await callsToday(['browser', 'text']);
    await withPolicy('browser', { max_per_day: n }, async () => {
      expect(await startWeb(lead.id)).toMatchObject({ allowed: false, reason: 'daily_limit' });
      // The simulated dialer has its own cap.
      const placed = await asUser(sql, user('care_coordinator'), async (tx) => {
        const [row] = await tx<{ r: { allowed: boolean } }[]>`
          select public.place_assistant_call(${lead.id}, 'simulated') as r`;
        return row!.r;
      });
      expect(placed).toMatchObject({ allowed: true });
    });
    await withPolicy('browser', { max_per_day: n + 1 }, async () => {
      expect(await startWeb(lead.id)).toMatchObject({ allowed: true });
    });
  });

  it('caps website calls per phone number, across leads', async () => {
    const phone = `98${String(Date.now()).slice(-8)}`;
    const first = await store.submitLead(await samplePayload({ phone }));
    const second = await store.submitLead(await samplePayload({ phone }));
    await withPolicy('browser', { max_per_phone_per_day: 2 }, async () => {
      expect(await startWeb(first.id)).toMatchObject({ allowed: true });
      expect(await startWeb(second.id)).toMatchObject({ allowed: true });
      expect(await startWeb(second.id)).toMatchObject({ allowed: false, reason: 'phone_daily_limit' });
    });
  });

  it('refuses calls on channels with no policy', async () => {
    const lead = await store.submitLead(await samplePayload());
    await sql`delete from public.call_policies where industry = 'clinic' and channel = 'text'`;
    try {
      expect(await startWeb(lead.id, 'text')).toMatchObject({ allowed: false, reason: 'not_configured' });
    } finally {
      await sql.unsafe(await callPolicyRows());
    }
  });

  it('lets only the front desk place outbound calls, inside the call window, to verified numbers when required', async () => {
    const lead = await store.submitLead(await samplePayload());
    const place = (role: StaffRole) =>
      asUser(sql, user(role), async (tx) => {
        const [row] = await tx<{ r: { allowed: boolean; reason?: string } }[]>`
          select public.place_assistant_call(${lead.id}, 'phone') as r`;
        return row!.r;
      });
    // Rules come from call_policies, not from the caller: the old signature with rules is gone.
    await expect(
      asUser(sql, user('care_coordinator'), (tx) => tx`select public.place_assistant_call(${lead.id}, 'phone', '{}')`),
    ).rejects.toThrow(/does not exist/);
    await expect(place('specialist_doctor')).rejects.toThrow(/may not do this/);
    await withPolicy('phone', { window_start: 0, window_end: 1, time_zone: 'Pacific/Kiritimati' }, async () => {
      const [hour] = await sql<
        { h: number }[]
      >`select extract(hour from now() at time zone 'Pacific/Kiritimati')::int as h`;
      if (hour!.h !== 0) expect(await place('care_coordinator')).toMatchObject({ reason: 'outside_call_window' });
    });
    // Any hour: the window is checked first, so open it for the rest of the test.
    const open = { window_start: 0, window_end: 24 };
    await withPolicy('phone', open, async () => {
      expect(await place('care_coordinator')).toMatchObject({ allowed: false, reason: 'number_not_verified' });
    });
    const [row] = await sql<{ phone: string }[]>`select phone from public.leads where id = ${lead.id}`;
    const phone = row!.phone;
    await asUser(sql, user('manager'), (tx) => tx`select public.add_verified_number(${phone}, 'Demo phone')`);
    await expect(
      asUser(sql, user('care_coordinator'), (tx) => tx`select public.add_verified_number(${phone}, 'x')`),
    ).rejects.toThrow(/may not do this/);
    await withPolicy('phone', open, async () => {
      expect(await place('care_coordinator')).toMatchObject({ allowed: true });
    });
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
    const flagged = await sql<{ payload: object }[]>`
      select payload from public.lead_events where lead_id = ${lead.id} and type = 'safety.flagged'`;
    // The audit trail (which outlives erasure) says a red flag happened, not which one.
    expect(flagged.map((f) => f.payload)).toEqual([{ call_id: call_id!, kind: 'red_flag' }]);
    const [completed] = await sql<{ payload: Record<string, unknown> }[]>`
      select payload from public.lead_events where lead_id = ${lead.id} and type = 'call.completed'`;
    expect(completed!.payload).toMatchObject({ flag_count: 1 });
    expect(JSON.stringify(completed!.payload)).not.toContain('chest_pain');
  });

  it('continues a browser call by typing once, and ignores the voice agent’s late result', async () => {
    const lead = await store.submitLead(await samplePayload());
    const { call_id } = await startWeb(lead.id);
    const fallback = await createPostgresLeadStore(databaseUrl!);
    try {
      expect(await fallback.useTextFallback(call_id!, randomUUID())).toBe(false);
      expect(await fallback.useTextFallback(call_id!, lead.id)).toBe(true);
      expect(await fallback.useTextFallback(call_id!, lead.id)).toBe(false); // once per call
    } finally {
      await fallback.close();
    }
    expect(
      await record(result(call_id!, lead.id, { outcome: 'caller_ended', consentToContinue: false }), {}),
    ).toMatchObject({ status: 'superseded' });
    expect(await record(result(call_id!, lead.id, { channel: 'text' }), { answers: {} })).toMatchObject({
      status: 'recorded',
    });
    await expect(record(result(call_id!, lead.id, { channel: 'phone' }), {})).resolves.toMatchObject({
      status: 'duplicate',
    });
    const typed = await startWeb(lead.id, 'text');
    expect(
      await asRole('web_submitter', (tx) => tx`select public.use_text_fallback(${typed.call_id!}, ${lead.id}) as ok`),
    ).toEqual([{ ok: false }]);
    await expect(record(result(typed.call_id!, lead.id, { channel: 'phone' }), {})).rejects.toThrow(/channel/);
  });

  it('closes a call the CRM cannot use as failed', async () => {
    const lead = await store.submitLead(await samplePayload());
    const { call_id } = await startWeb(lead.id);
    const fail = () =>
      asRole('crm_server', async (tx) => {
        const [row] = await tx<
          { ok: boolean }[]
        >`select public.fail_voice_call(${call_id!}, ${lead.id}, 'invalid_result') as ok`;
        return row!.ok;
      });
    expect(await fail()).toBe(true);
    expect(await fail()).toBe(false);
    const [session] = await sql`select status, outcome from public.call_sessions where id = ${call_id!}`;
    expect(session).toEqual({ status: 'failed', outcome: 'error' });
    expect(await record(result(call_id!, lead.id), {})).toMatchObject({ status: 'duplicate' });
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
    const [scrubbed] = await sql`
      select answers, summary, transcript, safety_flags from public.call_sessions where id = ${call_id!}`;
    expect(scrubbed).toEqual({ answers: {}, summary: [], transcript: [], safety_flags: [] });
  });
});
