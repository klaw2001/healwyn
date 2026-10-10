import { describe, expect, it, vi } from 'vitest';
import { sendEmail, signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from '../src';

const SECRET = 'a-test-secret-that-is-long-enough';
const LEAD = '1ead0000-0000-4000-8000-000000000001';

describe('unsubscribe tokens', () => {
  it('round-trips a genuine token', async () => {
    const token = await signUnsubscribeToken(LEAD, SECRET);
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe(LEAD);
    expect(unsubscribeUrl('https://site.example/', token)).toBe(
      `https://site.example/unsubscribe?token=${encodeURIComponent(token)}`,
    );
  });

  it('rejects tampering, other leads and other secrets', async () => {
    const token = await signUnsubscribeToken(LEAD, SECRET);
    const other = '1ead0000-0000-4000-8000-000000000002';
    expect(await verifyUnsubscribeToken(`${other}.${token.split('.')[1]}`, SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken(token, `${SECRET}-rotated`)).toBeNull();
    expect(await verifyUnsubscribeToken('garbage', SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken(`${LEAD}.`, SECRET)).toBeNull();
  });

  it('requires a real secret', async () => {
    await expect(signUnsubscribeToken(LEAD, 'short')).rejects.toThrow(/UNSUBSCRIBE_SECRET/);
  });
});

describe('sendEmail', () => {
  const email = {
    to: 'a@example.com',
    subject: 'Hi',
    text: 'Body with Name',
    idempotencyKey: 'step-1',
    unsubscribeUrl: 'https://u',
  };

  it('logs instead of sending without a key, redacting when asked', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(await sendEmail(email, {}, vi.fn(), { consoleMode: 'redacted', redactedLabel: 'step-1' })).toEqual({
      status: 'logged',
    });
    expect(info.mock.calls.flat().join(' ')).not.toContain('Body with Name');
    info.mockRestore();
  });

  it('sends with idempotency key and one-click unsubscribe headers', async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"em_1"}', { status: 200 }));
    const result = await sendEmail(
      email,
      { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Clinic <hi@clinic.example>' },
      fetchMock as unknown as typeof fetch,
    );
    expect(result).toEqual({ status: 'sent', providerMessageId: 'em_1' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('idempotency-key')).toBe('step-1');
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: 'Clinic <hi@clinic.example>',
      headers: { 'List-Unsubscribe': '<https://u>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
  });

  it('reports failures without throwing', async () => {
    const failing = vi.fn(async () => new Response('{"name":"validation_error"}', { status: 403 }));
    expect(await sendEmail(email, { RESEND_API_KEY: 're_test' }, failing as unknown as typeof fetch)).toEqual({
      status: 'failed',
      error: 'resend_403_validation_error',
    });
    const broken = vi.fn(async () => Promise.reject(new TypeError('network')));
    expect((await sendEmail(email, { RESEND_API_KEY: 're_test' }, broken as unknown as typeof fetch)).status).toBe(
      'failed',
    );
  });
});
