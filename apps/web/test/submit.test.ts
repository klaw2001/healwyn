import { clinicPack, consentFieldName, HONEYPOT_FIELD } from '@healwyn/core';
import { createMemoryLeadStore, type LeadStore } from '@healwyn/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLeadEmail, sendLeadNotification, type LeadNotification } from '@/lib/server/notify';
import { handlePartnerEnquiry, handlePatientEnquiry, RATE_LIMIT, type SubmissionDeps } from '@/lib/server/submit';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = {
  full_name: 'Asha Demo',
  phone: '98765 43210',
  preferred_language: 'en',
  concern_category: 'dermatology',
  description: 'SECRET-FREE-TEXT about my skin',
  preferred_time: 'evening',
  visit_type: 'first',
  has_insurance: 'yes',
  [consentFieldName('contact')]: 'on',
};

function deps(overrides: Partial<SubmissionDeps> = {}) {
  const store = createMemoryLeadStore();
  const tasks: (() => Promise<unknown>)[] = [];
  const notify = vi.fn(async (_n: LeadNotification) => 'logged');
  return {
    store,
    tasks,
    notify,
    deps: {
      store,
      pack: clinicPack,
      notify,
      schedule: (task: () => Promise<unknown>) => tasks.push(task),
      ...overrides,
    },
  };
}

const headers = (ip = '203.0.113.9') => new Headers({ 'x-forwarded-for': ip });

afterEach(() => vi.restoreAllMocks());

describe('handlePatientEnquiry', () => {
  it('stores a valid enquiry and schedules a notification', async () => {
    const { store, tasks, notify, deps: d } = deps();
    const state = await handlePatientEnquiry(form(valid), headers(), d);

    expect(state.status).toBe('success');
    expect(store.leads.size).toBe(1);
    const [lead] = [...store.leads.values()];
    expect(lead).toMatchObject({ fullName: 'Asha Demo', phone: '+919876543210', specialtySlug: 'dermatology' });

    expect(tasks).toHaveLength(1);
    await tasks[0]!();
    expect(notify).toHaveBeenCalledOnce();
  });

  it('returns field errors and the typed values when invalid', async () => {
    const { store, deps: d } = deps();
    const state = await handlePatientEnquiry(form({ ...valid, phone: '123' }), headers(), d);
    expect(state.status).toBe('invalid');
    if (state.status === 'invalid') {
      expect(Object.keys(state.fieldErrors)).toEqual(['phone']);
      expect(state.values.full_name).toBe('Asha Demo');
    }
    expect(store.leads.size).toBe(0);
  });

  it('silently drops honeypot submissions', async () => {
    const { store, tasks, deps: d } = deps();
    const state = await handlePatientEnquiry(form({ ...valid, [HONEYPOT_FIELD]: 'http://spam.example' }), headers(), d);
    expect(state.status).toBe('success');
    expect(store.leads.size).toBe(0);
    expect(tasks).toHaveLength(0);
  });

  it('rate-limits per client IP', async () => {
    const { deps: d } = deps();
    const results = [];
    for (let i = 0; i <= RATE_LIMIT.limit; i += 1) {
      results.push(
        (await handlePatientEnquiry(form({ ...valid, phone: '9876543210' }), headers('198.51.100.1'), d)).status,
      );
    }
    expect(results.at(-1)).toBe('error');
    expect(results.slice(0, -1).every((s) => s === 'success')).toBe(true);
    // A different connection is unaffected.
    expect((await handlePatientEnquiry(form(valid), headers('198.51.100.2'), d)).status).toBe('success');
  });

  it('reports a storage failure without leaking details, and never notifies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing: LeadStore = {
      ...createMemoryLeadStore(),
      kind: 'postgres',
      submitLead: async () => {
        throw new Error('row (Asha Demo, +919876543210) violates check');
      },
    };
    const { tasks, deps: d } = deps({ store: failing });
    const state = await handlePatientEnquiry(form(valid), headers(), d);
    expect(state.status).toBe('error');
    if (state.status === 'error') expect(state.message).toMatch(/could not send your enquiry/);
    expect(tasks).toHaveLength(0);
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(logged).not.toContain('Asha');
    expect(logged).not.toContain('9876543210');
  });

  it('keeps going if the rate-limit check itself fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createMemoryLeadStore();
    const { deps: d } = deps({
      store: { ...store, hitRateLimit: async () => Promise.reject(new Error('db down')), submitLead: store.submitLead },
    });
    expect((await handlePatientEnquiry(form(valid), headers(), d)).status).toBe('success');
  });

  it('never logs personal data or free text on success', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deps: d } = deps();
    await handlePatientEnquiry(form(valid), headers(), d);
    const logged = info.mock.calls.flat().join(' ');
    expect(logged).toContain('lead.submitted');
    for (const secret of ['Asha', '9876543210', 'SECRET-FREE-TEXT', '203.0.113.9'])
      expect(logged).not.toContain(secret);
  });
});

describe('handlePartnerEnquiry', () => {
  it('stores a partner lead', async () => {
    const { store, deps: d } = deps();
    const state = await handlePartnerEnquiry(
      form({
        organisation: 'Kestrel Labs',
        contact_name: 'Ravi Demo',
        role: 'Partnerships',
        phone: '7000000010',
        email: 'ravi@example.com',
        partner_type: 'diagnostic-lab',
        message: 'Hello',
        [consentFieldName('partner_contact')]: 'on',
      }),
      headers(),
      d,
    );
    expect(state.status).toBe('success');
    expect([...store.leads.values()][0]?.leadType).toBe('partner');
  });
});

describe('lead notification email', () => {
  async function notificationFor(values = valid) {
    const { tasks, notify, deps: d } = deps();
    await handlePatientEnquiry(form(values), headers(), d);
    await tasks[0]!();
    return notify.mock.calls[0]![0];
  }

  it('contains no name, full phone number or free text', async () => {
    const email = buildLeadEmail(await notificationFor(), { LEAD_NOTIFY_EMAIL: 'team@example.com' });
    const everything = `${email.subject}\n${email.text}`;
    expect(everything).toContain('Dermatology');
    expect(everything).toContain('+91 ••••• •3210');
    for (const secret of ['Asha', '9876543210', 'SECRET-FREE-TEXT']) expect(everything).not.toContain(secret);
  });

  it('logs to the console when Resend is not configured', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchMock = vi.fn();
    const result = await sendLeadNotification(await notificationFor(), {}, fetchMock as unknown as typeof fetch);
    expect(result).toBe('logged');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info.mock.calls.flat().join(' ')).toContain('[email:console]');
  });

  it('sends through Resend with an idempotency key', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
    const notification = await notificationFor();
    const result = await sendLeadNotification(
      notification,
      { RESEND_API_KEY: 're_test', LEAD_NOTIFY_EMAIL: 'team@example.com' },
      fetchMock as unknown as typeof fetch,
    );
    expect(result).toBe('sent');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const sent = new Headers(init.headers);
    expect(sent.get('authorization')).toBe('Bearer re_test');
    expect(sent.get('idempotency-key')).toBe(`lead-${notification.leadId}`);
    expect(JSON.parse(String(init.body))).toMatchObject({ from: 'onboarding@resend.dev', to: ['team@example.com'] });
  });

  it('never throws when Resend fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = { RESEND_API_KEY: 're_test', LEAD_NOTIFY_EMAIL: 'team@example.com' };
    const notification = await notificationFor();
    await expect(
      sendLeadNotification(notification, env, (async () => new Response('nope', { status: 500 })) as typeof fetch),
    ).resolves.toBe('failed');
    await expect(
      sendLeadNotification(notification, env, (async () => Promise.reject(new Error('network'))) as typeof fetch),
    ).resolves.toBe('failed');
  });
});
