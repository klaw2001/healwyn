import { clinicPack, consentFieldName, HONEYPOT_FIELD } from '@healwyn/core';
import { createMemoryLeadStore, type LeadStore } from '@healwyn/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callCookieValue,
  readCallCookie,
  startAssistant,
  type AssistantDeps,
  type TextService,
} from '@/lib/server/assistant';

const valid = {
  full_name: 'Asha Demo',
  phone: '98765 43210',
  preferred_language: 'hi',
  mode: 'text',
  [consentFieldName('contact')]: 'on',
  [consentFieldName('assistant_call')]: 'on',
};
const headers = (ip = '203.0.113.9') => new Headers({ 'x-forwarded-for': ip });

function deps(overrides: Partial<AssistantDeps> = {}) {
  const store = createMemoryLeadStore();
  const text: TextService = {
    start: vi.fn(async ({ language }) => ({ reply: 'Hello, I am the AI assistant.', language })),
    turn: vi.fn(),
    end: vi.fn(),
  };
  return {
    store,
    text,
    deps: { store, pack: clinicPack, text, voiceToken: null, ...overrides } satisfies AssistantDeps,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('startAssistant', () => {
  it('creates a voice-sourced lead and starts a typed chat in the caller’s language', async () => {
    const { store, text, deps: d } = deps();
    const result = await startAssistant(valid, headers(), d);
    expect(result).toMatchObject({ status: 'text', reply: 'Hello, I am the AI assistant.', language: 'hi' });
    expect(text.start).toHaveBeenCalledWith(expect.objectContaining({ channel: 'text', language: 'hi' }));
    const [lead] = [...store.leads.values()];
    expect(lead).toMatchObject({ source: 'voice', answers: {}, fullName: 'Asha Demo' });
  });

  it('prepares a LiveKit room for a voice call when LiveKit is configured', async () => {
    const voiceToken = vi.fn(async () => ({ serverUrl: 'wss://example.livekit.cloud', token: 'jwt' }));
    const { text, deps: d } = deps({ voiceToken });
    const result = await startAssistant({ ...valid, mode: 'voice' }, headers(), d);
    expect(result).toMatchObject({ status: 'voice', serverUrl: 'wss://example.livekit.cloud', token: 'jwt' });
    expect(voiceToken).toHaveBeenCalledWith(expect.objectContaining({ language: 'hi' }));
    expect(text.start).not.toHaveBeenCalled();
  });

  it('falls back to typed chat when voice is not configured', async () => {
    const { deps: d } = deps();
    expect((await startAssistant({ ...valid, mode: 'voice' }, headers(), d)).status).toBe('text');
  });

  it('requires the call consent and valid details, and stores nothing otherwise', async () => {
    const { store, deps: d } = deps();
    const result = await startAssistant({ ...valid, [consentFieldName('assistant_call')]: undefined }, headers(), d);
    expect(result).toMatchObject({ status: 'invalid', fieldErrors: { consent_assistant_call: expect.any(String) } });
    expect((await startAssistant({ ...valid, phone: '123' }, headers(), d)).status).toBe('invalid');
    expect(store.leads.size).toBe(0);
  });

  it('refuses to start when the rate limiter is unavailable (calls cost money)', async () => {
    const failing: LeadStore = {
      ...createMemoryLeadStore(),
      hitRateLimit: async () => Promise.reject(new Error('db down')),
    };
    const { deps: d } = deps({ store: failing });
    expect(await startAssistant(valid, headers(), d)).toMatchObject({ status: 'error' });
    // Without a client IP, requests share one bucket rather than skipping the limit.
    const { deps: shared } = deps();
    for (let i = 0; i < 5; i += 1) await startAssistant(valid, new Headers(), shared);
    expect(await startAssistant(valid, new Headers(), shared)).toMatchObject({
      message: expect.stringContaining('several calls'),
    });
  });

  it('ignores bots (honeypot) and rate-limits repeated starts', async () => {
    const { store, deps: d } = deps();
    expect((await startAssistant({ ...valid, [HONEYPOT_FIELD]: 'spam' }, headers(), d)).status).toBe('error');
    expect(store.leads.size).toBe(0);
    for (let i = 0; i < 5; i += 1) await startAssistant(valid, headers('198.51.100.4'), d);
    expect(await startAssistant(valid, headers('198.51.100.4'), d)).toMatchObject({
      status: 'error',
      message: expect.stringContaining('several calls'),
    });
  });

  it('explains a refused call (daily limit) and when the agent is unavailable', async () => {
    const refusing: LeadStore = {
      ...createMemoryLeadStore(),
      startWebCall: async () => ({ allowed: false, reason: 'daily_limit' }),
    };
    const { deps: d } = deps({ store: refusing });
    expect(await startAssistant(valid, headers(), d)).toMatchObject({
      message: expect.stringContaining("today's limit"),
    });

    const { deps: down } = deps({
      text: { start: async () => Promise.reject(new Error('down')), turn: vi.fn(), end: vi.fn() },
    });
    expect(await startAssistant(valid, headers('192.0.2.1'), down)).toMatchObject({
      status: 'error',
      message: expect.stringContaining('not available right now'),
    });
  });
});

describe('call cookie', () => {
  it('only accepts cookies this server signed', () => {
    vi.stubEnv('VOICE_AGENT_SECRET', 'x'.repeat(40));
    const value = callCookieValue('call-1', 'lead-1');
    expect(readCallCookie(value)).toEqual({ callId: 'call-1', leadId: 'lead-1' });
    expect(readCallCookie(value.replace('lead-1', 'lead-2'))).toBeNull();
    expect(readCallCookie('call-1.lead-1.1700000000.forged')).toBeNull();
    expect(readCallCookie(undefined)).toBeNull();
    vi.unstubAllEnvs();
  });

  it('expires after 20 minutes, and the issue time is signed', () => {
    vi.stubEnv('VOICE_AGENT_SECRET', 'x'.repeat(40));
    const issued = Date.UTC(2026, 9, 11, 10, 0, 0);
    const value = callCookieValue('call-1', 'lead-1', issued);
    expect(readCallCookie(value, issued + 19 * 60_000)).not.toBeNull();
    expect(readCallCookie(value, issued + 21 * 60_000)).toBeNull();
    const [callId, leadId, at, mac] = value.split('.');
    const later = String(Number(at) + 3600);
    expect(readCallCookie([callId, leadId, later, mac].join('.'), issued + 61 * 60_000)).toBeNull();
    vi.unstubAllEnvs();
  });
});
