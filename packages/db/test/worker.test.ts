import { buildIntakeSchema, clinicPack, intakeToLeadPayload } from '@healwyn/core';
import type { DeliveryResult, OutgoingEmail } from '@healwyn/messaging';
import { runNurtureWorker } from '@healwyn/messaging/worker';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { connect, databaseUrl } from './helpers';

const env = { UNSUBSCRIBE_SECRET: 'test-unsubscribe-secret-0123456789', SITE_URL: 'https://site.example' };
let counter = 0;

describe.skipIf(!databaseUrl)('nurture worker', () => {
  const sql = databaseUrl ? connect() : (null as never);
  const store = databaseUrl ? createPostgresLeadStore(databaseUrl) : (null as never);
  afterAll(async () => {
    await store?.close();
    await sql?.end();
  });

  /** A lead whose welcome email and WhatsApp were due ten minutes ago. */
  async function leadWithDueSteps(overrides: Record<string, string> = {}) {
    counter += 1;
    const submission = buildIntakeSchema(clinicPack).parse({
      full_name: 'Worker Test',
      phone: `+91 70001 ${String(10000 + ((process.pid + counter) % 90000)).padStart(5, '0')}`,
      email: `worker.${counter}@example.com`,
      preferred_language: 'en',
      concern_category: 'dental',
      preferred_time: 'any',
      visit_type: 'first',
      has_insurance: 'no',
      consent_contact: 'on',
      ...overrides,
    });
    const payload = await intakeToLeadPayload(submission, clinicPack, {
      isDemo: true,
      now: new Date(Date.now() - 10 * 60_000),
    });
    return (await store.submitLead(payload)).id;
  }

  const recorder = () => {
    const calls: OutgoingEmail[] = [];
    const deliverEmail = vi.fn(async (email: OutgoingEmail): Promise<DeliveryResult> => {
      calls.push(email);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { status: 'sent', providerMessageId: `prov-${email.idempotencyKey}` };
    });
    return { calls, deliverEmail };
  };

  beforeEach(async () => {
    // Drain anything other tests left due, so each test sees only its own steps.
    await sql`update public.scheduled_messages set status = 'cancelled' where status in ('pending', 'processing')`;
    await sql`delete from public.sequence_settings`;
  });

  it('sends each due step once and records a message with an unsubscribe link', async () => {
    const id = await leadWithDueSteps();
    const { calls, deliverEmail } = recorder();
    const first = await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 });
    expect(first).toMatchObject({ claimed: 2, sent: 1, simulated: 1, skipped: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.to).toBe(`worker.${counter}@example.com`);
    expect(calls[0]!.unsubscribeUrl).toMatch(/^https:\/\/site\.example\/api\/unsubscribe\?token=/);
    expect(calls[0]!.text).toMatch(/Unsubscribe from these emails: https:\/\/site\.example\/unsubscribe\?token=/);

    const second = await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 });
    expect(second.claimed).toBe(0);
    expect(calls).toHaveLength(1);

    const messages =
      await sql`select channel, status, provider_message_id from public.messages where lead_id = ${id} order by channel`;
    expect(messages).toEqual([
      { channel: 'email', status: 'sent', provider_message_id: `prov-${calls[0]!.idempotencyKey}` },
      { channel: 'whatsapp', status: 'simulated', provider_message_id: null },
    ]);
  });

  it('never sends twice when several workers run at once', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 12; i += 1) ids.push(await leadWithDueSteps());
    const { calls, deliverEmail } = recorder();
    const workers = Array.from({ length: 4 }, () => postgres(databaseUrl!, { max: 1, onnotice: () => {} }));
    try {
      const runAll = () =>
        Promise.all(workers.map((w) => runNurtureWorker({ sql: w, env, deliverEmail, limit: 4, retentionMonths: 0 })));
      let claimed = 0;
      for (let round = 0; round < 10; round += 1) {
        const results = await runAll();
        const roundClaimed = results.reduce((sum, r) => sum + r.claimed, 0);
        claimed += roundClaimed;
        if (roundClaimed === 0) break;
      }
      expect(claimed).toBe(24);
    } finally {
      await Promise.all(workers.map((w) => w.end()));
    }
    const keys = calls.map((c) => c.idempotencyKey);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    const [row] = await sql`
      select count(*)::int as messages, count(distinct scheduled_message_id)::int as steps
      from public.messages where lead_id = any(${ids})`;
    expect(row).toEqual({ messages: 24, steps: 24 });
  });

  it('re-checks stop conditions at send time (a reply that arrived after scheduling)', async () => {
    const id = await leadWithDueSteps();
    // The reply lands without anything cancelling the schedule (as in a race).
    await sql`update public.leads set last_inbound_at = now() where id = ${id}`;
    const { calls, deliverEmail } = recorder();
    const result = await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 });
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(calls).toHaveLength(0);
    const [enrollment] = await sql`select status, stop_reason from public.sequence_enrollments where lead_id = ${id}`;
    expect(enrollment).toEqual({ status: 'stopped', stop_reason: 'replied' });
  });

  it('honours an unsubscribe immediately, even for steps already due', async () => {
    const id = await leadWithDueSteps();
    await sql`select public.opt_out_lead(${id}, 'email_link')`;
    const { calls, deliverEmail } = recorder();
    await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 });
    expect(calls).toHaveLength(0);
    const [sent] = await sql`select count(*)::int as n from public.messages where lead_id = ${id}`;
    expect(sent?.n).toBe(0);
  });

  it('holds a paused sequence and sends once it resumes', async () => {
    const id = await leadWithDueSteps();
    await sql`insert into public.sequence_settings (industry, sequence_id, paused) values ('clinic', 'new-lead-welcome', true)`;
    const { calls, deliverEmail } = recorder();
    expect((await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 })).claimed).toBe(0);
    await sql`update public.sequence_settings set paused = false`;
    expect((await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 })).claimed).toBe(2);
    expect(calls).toHaveLength(1);
    const [n] = await sql`select count(*)::int as n from public.messages where lead_id = ${id}`;
    expect(n?.n).toBe(2);
  });

  it('retries a failed email, then gives up after three attempts', async () => {
    const id = await leadWithDueSteps();
    const deliverEmail = vi.fn(async (): Promise<DeliveryResult> => ({ status: 'failed', error: 'resend_500' }));
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 });
      await sql`update public.scheduled_messages set due_at = now() - interval '1 minute' where lead_id = ${id} and step_index = 0 and status = 'pending'`;
    }
    expect(deliverEmail).toHaveBeenCalledTimes(3);
    const [step] =
      await sql`select status, attempts, last_error from public.scheduled_messages where lead_id = ${id} and step_index = 0`;
    expect(step).toEqual({ status: 'failed', attempts: 3, last_error: 'resend_500' });
    const [event] =
      await sql`select count(*)::int as n from public.lead_events where lead_id = ${id} and type = 'message.failed'`;
    expect(event?.n).toBe(1);
  });

  it('recovers steps left in processing by a crashed worker, without double recording', async () => {
    const id = await leadWithDueSteps();
    await sql`select * from public.claim_due_messages(10)`; // a worker claims, then "crashes"
    await sql`update public.scheduled_messages set locked_at = now() - interval '20 minutes' where lead_id = ${id}`;
    const { calls, deliverEmail } = recorder();
    const result = await runNurtureWorker({ sql, env, deliverEmail, retentionMonths: 0 });
    expect(result.claimed).toBe(2);
    expect(calls).toHaveLength(1);
    const [n] = await sql`select count(*)::int as n from public.messages where lead_id = ${id}`;
    expect(n?.n).toBe(2);
  });

  it('erases leads idle for longer than the retention period', async () => {
    const id = await leadWithDueSteps();
    // Nothing scheduled: sending would itself count as fresh activity.
    await sql`update public.scheduled_messages set status = 'cancelled' where lead_id = ${id}`;
    await sql`alter table public.lead_events disable trigger lead_events_append_only`;
    await sql`update public.lead_events set created_at = now() - interval '13 months' where lead_id = ${id}`;
    await sql`alter table public.lead_events enable trigger lead_events_append_only`;
    await sql`update public.leads set created_at = now() - interval '13 months' where id = ${id}`;
    await sql`alter table public.leads disable trigger leads_set_updated_at`;
    await sql`update public.leads set updated_at = now() - interval '13 months' where id = ${id}`;
    await sql`alter table public.leads enable trigger leads_set_updated_at`;
    const result = await runNurtureWorker({ sql, env, deliverEmail: recorder().deliverEmail, retentionMonths: 12 });
    expect(result.erased).toBeGreaterThanOrEqual(1);
    const [lead] = await sql`select full_name, erasure_reason from public.leads where id = ${id}`;
    expect(lead).toEqual({ full_name: null, erasure_reason: 'retention_expired' });
  });

  it('refuses to run without an unsubscribe secret', async () => {
    await expect(runNurtureWorker({ sql, env: {}, retentionMonths: 0 })).rejects.toThrow(/UNSUBSCRIBE_SECRET/);
  });
});
