import { describe, expect, it } from 'vitest';
import { bookingUrl, signBookingToken, signUnsubscribeToken, verifyBookingToken } from '../src';

const secret = 'test-secret-0123456789';
const leadId = '1ead0000-0000-4000-8000-000000000001';

describe('booking links', () => {
  it('round-trips and expires', async () => {
    const now = new Date('2026-10-11T10:00:00Z');
    const token = await signBookingToken(leadId, secret, now, 30);
    expect(await verifyBookingToken(token, secret, now)).toBe(leadId);
    expect(await verifyBookingToken(token, secret, new Date('2026-11-09T10:00:00Z'))).toBe(leadId);
    expect(await verifyBookingToken(token, secret, new Date('2026-11-11T10:00:00Z'))).toBeNull();
  });

  it('rejects tampering, other secrets and unsubscribe tokens', async () => {
    const token = await signBookingToken(leadId, secret);
    const [, expiry, signature] = token.split('.');
    const other = '1ead0000-0000-4000-8000-000000000002';
    expect(await verifyBookingToken(`${other}.${expiry}.${signature}`, secret)).toBeNull();
    expect(await verifyBookingToken(`${leadId}.${Number(expiry) + 999}.${signature}`, secret)).toBeNull();
    expect(await verifyBookingToken(token, 'another-secret-0123456789')).toBeNull();
    const unsubscribe = await signUnsubscribeToken(leadId, secret);
    expect(await verifyBookingToken(unsubscribe, secret)).toBeNull();
    expect(await verifyBookingToken('', secret)).toBeNull();
    expect(await verifyBookingToken(null, secret)).toBeNull();
  });

  it('builds the page address with the lead’s industry', () => {
    expect(bookingUrl('https://site.example/', 'a.b.c', 'real_estate')).toBe(
      'https://site.example/book?t=a.b.c&i=real_estate',
    );
  });
});
