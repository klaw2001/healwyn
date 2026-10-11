/**
 * Booking links: `<leadId>.<expiry>.<signature>`, where the signature is an
 * HMAC-SHA256 of "booking:<leadId>.<expiry>" with UNSUBSCRIBE_SECRET (the same
 * secret as unsubscribe links, with a different purpose prefix, so neither link
 * can stand in for the other). The link lets the person who made an enquiry
 * pick, move or cancel their appointment, and nothing else; it expires.
 */

const encoder = new TextEncoder();
const DAY_SECONDS = 24 * 60 * 60;
export const BOOKING_LINK_DAYS = 30;

async function sign(secret: string, value: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(`booking:${value}`));
  return Buffer.from(signature).toString('base64url');
}

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 16) throw new Error('UNSUBSCRIBE_SECRET must be set (16+ characters)');
  return secret;
}

export async function signBookingToken(
  leadId: string,
  secret: string | undefined,
  now: Date = new Date(),
  days: number = BOOKING_LINK_DAYS,
): Promise<string> {
  const expiry = Math.floor(now.getTime() / 1000) + days * DAY_SECONDS;
  return `${leadId}.${expiry}.${await sign(requireSecret(secret), `${leadId}.${expiry}`)}`;
}

/** Returns the lead id when the token is genuine and unexpired, otherwise null. Constant-time comparison. */
export async function verifyBookingToken(
  token: string | null | undefined,
  secret: string | undefined,
  now: Date = new Date(),
): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const [leadId, expiry, signature] = token.split('.');
  if (!leadId || !expiry || !signature || !/^[0-9a-f-]{36}$/i.test(leadId) || !/^\d{9,11}$/.test(expiry)) return null;
  if (Number(expiry) * 1000 < now.getTime()) return null;
  const expected = await sign(requireSecret(secret), `${leadId}.${expiry}`);
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0 ? leadId : null;
}

/** The public booking page for a lead; `industry` makes the page show the lead's own brand. */
export function bookingUrl(siteUrl: string, token: string, industry?: string): string {
  const base = `${siteUrl.replace(/\/$/, '')}/book?t=${encodeURIComponent(token)}`;
  return industry ? `${base}&i=${encodeURIComponent(industry)}` : base;
}
