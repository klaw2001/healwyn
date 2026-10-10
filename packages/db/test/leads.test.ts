import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { buildSeedSql } from '../src/seed';
import { connect, databaseUrl, samplePayload } from './helpers';

describe.skipIf(!databaseUrl)('lead storage (Postgres store)', () => {
  const sql = databaseUrl ? connect() : (null as never);
  const store = databaseUrl ? createPostgresLeadStore(databaseUrl) : (null as never);
  afterAll(async () => {
    await store?.close();
    await sql?.end();
  });

  it('stores a lead with consent evidence and audit events in one call', async () => {
    const payload = await samplePayload();
    const { id } = await store.submitLead(payload);

    const [lead] = await sql`select * from public.leads where id = ${id}`;
    expect(lead).toMatchObject({
      industry: 'clinic',
      lead_type: 'individual',
      source: 'web_form',
      stage: 'new',
      full_name: 'Test Person',
      phone: payload.phone,
      specialty_slug: 'dental',
      message: 'Synthetic test enquiry.',
      is_demo: true,
      erased_at: null,
    });
    expect(lead?.answers).toEqual({
      concern_category: 'dental',
      preferred_time: 'morning',
      visit_type: 'first',
      has_insurance: 'yes',
    });

    const consents = await sql`
      select purpose, granted, text_version, text_hash, source from public.consent_records
      where lead_id = ${id} order by purpose`;
    expect(consents).toEqual([
      expect.objectContaining({
        purpose: 'assistant_call',
        granted: true,
        text_version: 'clinic-assistant-call-v1',
        source: 'web_form',
      }),
      expect.objectContaining({
        purpose: 'contact',
        granted: true,
        text_version: 'clinic-contact-v1',
        source: 'web_form',
      }),
    ]);
    for (const consent of consents) expect(consent.text_hash).toMatch(/^[0-9a-f]{64}$/);

    const events = await sql`select type, payload from public.lead_events where lead_id = ${id} order by id`;
    expect(events.map((e) => e.type)).toEqual(['lead.created', 'consent.recorded']);
    // Audit payloads never contain personal data or free text.
    const eventText = JSON.stringify(events);
    expect(eventText).not.toContain('Test Person');
    expect(eventText).not.toContain(payload.phone);
    expect(eventText).not.toContain('Synthetic test enquiry');
  });

  it('rejects a lead without any granted consent and stores nothing', async () => {
    // Counts are scoped to this test's phone number: other test files share the database.
    const payload = await samplePayload();
    await expect(
      store.submitLead({ ...payload, consents: payload.consents.map((c) => ({ ...c, granted: false })) }),
    ).rejects.toThrow(/Could not store the lead/);
    const [row] = await sql`select count(*)::int as n from public.leads where phone = ${payload.phone}`;
    expect(row?.n).toBe(0);
  });

  it('rejects a lead whose required consent is missing, even if another consent was granted', async () => {
    const payload = await samplePayload();
    const consents = payload.consents.map((c) => ({ ...c, granted: !c.required }));
    expect(consents.some((c) => c.granted)).toBe(true);
    await expect(store.submitLead({ ...payload, consents })).rejects.toThrow(/Could not store the lead/);
    // Evidence that does not say which consent is required is rejected too.
    const unmarked = payload.consents.map((c) => ({ ...c, required: false }));
    await expect(store.submitLead({ ...payload, consents: unmarked })).rejects.toThrow(/Could not store the lead/);
  });

  it('accepts only short codes as erasure reasons and withdrawal sources', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await expect(sql`select public.erase_lead(${id}, 'Patient Asha asked by phone')`).rejects.toThrow(/short code/);
    await expect(sql`select public.withdraw_consent(${id}, 'contact', 'called on 98765', true)`).rejects.toThrow(
      /short code/,
    );
  });

  it('prunes rate-limit rows older than a day on every call', async () => {
    await sql`insert into public.rate_limits (key, window_start, hits) values ('old-key', now() - interval '2 days', 3)`;
    await store.hitRateLimit(`prune-${Date.now()}`, 5, 60);
    const [row] = await sql`select count(*)::int as n from public.rate_limits where key = 'old-key'`;
    expect(row?.n).toBe(0);
  });

  it('rolls back everything if any part fails (invalid phone)', async () => {
    const payload = await samplePayload();
    const marker = `rollback-${Date.now()}`;
    await expect(
      store.submitLead({ ...payload, phone: '12345', answers: { ...payload.answers, marker } }),
    ).rejects.toThrow();
    const [row] = await sql`select count(*)::int as n from public.leads where answers ->> 'marker' = ${marker}`;
    expect(row?.n).toBe(0);
  });

  it('keeps lead_events and consent_records append-only', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await expect(sql`update public.lead_events set type = 'lead.hacked' where lead_id = ${id}`).rejects.toThrow(
      /append-only/,
    );
    await expect(sql`delete from public.lead_events where lead_id = ${id}`).rejects.toThrow(/append-only/);
    await expect(sql`update public.consent_records set granted = false where lead_id = ${id}`).rejects.toThrow(
      /append-only/,
    );
    await expect(sql`delete from public.consent_records where lead_id = ${id}`).rejects.toThrow(/append-only/);
  });

  it('withdrawing the call consent keeps the lead but records the change', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await sql`select public.withdraw_consent(${id}, 'assistant_call', 'test', false)`;
    const current =
      await sql`select purpose, granted from public.current_consents where lead_id = ${id} order by purpose`;
    expect(current).toEqual([
      { purpose: 'assistant_call', granted: false },
      { purpose: 'contact', granted: true },
    ]);
    const [lead] = await sql`select full_name, erased_at from public.leads where id = ${id}`;
    expect(lead).toEqual({ full_name: 'Test Person', erased_at: null });
  });

  it('withdrawing the contact consent erases personal data in place', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await sql`select public.withdraw_consent(${id}, 'contact', 'test', true)`;
    const [lead] =
      await sql`select full_name, phone, email, message, answers, erased_at, erasure_reason, stage, specialty_slug
                             from public.leads where id = ${id}`;
    expect(lead).toMatchObject({
      full_name: null,
      phone: null,
      email: null,
      message: null,
      answers: {},
      erasure_reason: 'consent_withdrawn:contact',
      stage: 'new',
      specialty_slug: 'dental',
    });
    expect(lead?.erased_at).toBeInstanceOf(Date);
    const events = await sql`select type from public.lead_events where lead_id = ${id} order by id`;
    expect(events.map((e) => e.type)).toEqual(['lead.created', 'consent.recorded', 'consent.withdrawn', 'lead.erased']);
    // Erasing twice is a no-op.
    const [again] = await sql`select public.erase_lead(${id}, 'again') as erased`;
    expect(again?.erased).toBe(false);
  });

  it('refuses to un-erase a lead with half its data', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await sql`select public.erase_lead(${id}, 'test')`;
    await expect(sql`update public.leads set full_name = 'Back Again' where id = ${id}`).rejects.toThrow(
      /leads_erased_rows_hold_no_personal_data/,
    );
  });

  it('deleting a lead removes its history with it', async () => {
    const { id } = await store.submitLead(await samplePayload());
    await sql`delete from public.leads where id = ${id}`;
    const [events] = await sql`select count(*)::int as n from public.lead_events where lead_id = ${id}`;
    const [consents] = await sql`select count(*)::int as n from public.consent_records where lead_id = ${id}`;
    expect([events?.n, consents?.n]).toEqual([0, 0]);
  });

  it('rate-limits per key within a window', async () => {
    const key = `test-${Date.now()}`;
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await store.hitRateLimit(key, 3, 600));
    expect(results).toEqual([true, true, true, false]);
    expect(await store.hitRateLimit(`${key}-other`, 3, 600)).toBe(true);
  });

  it('counts concurrent hits exactly', async () => {
    const key = `burst-${Date.now()}`;
    const results = await Promise.all(Array.from({ length: 10 }, () => store.hitRateLimit(key, 5, 600)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it('seeds idempotently without touching real leads', async () => {
    const { id } = await store.submitLead({ ...(await samplePayload()), isDemo: false });
    await sql.begin(async (tx) => tx.unsafe(await buildSeedSql()));
    await sql.begin(async (tx) => tx.unsafe(await buildSeedSql()));
    const [counts] = await sql`
      select (select count(*)::int from public.staff where is_demo) as staff,
             (select count(*)::int from public.specialties) as specialties,
             (select count(*)::int from public.leads where is_demo and source = 'seed') as demo_leads,
             (select count(*)::int from public.leads where id = ${id}) as real_lead`;
    expect(counts).toEqual({ staff: 11, specialties: 6, demo_leads: 8, real_lead: 1 });
    const stages = await sql`select distinct stage from public.leads where source = 'seed' order by stage`;
    expect(stages.map((s) => s.stage)).toHaveLength(7);
  });
});
