import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  return safeEqual(header.slice('Bearer '.length), secret);
}

export const REPLAY_WINDOW_SECONDS = 300;

/**
 * Checks `x-webhook-signature: sha256=<hex>` over `${timestamp}.${rawBody}`,
 * with `x-webhook-timestamp` (Unix seconds) no older than five minutes.
 */
export function verifySignedRequest(
  rawBody: string,
  headers: Headers,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): { ok: true } | { ok: false; reason: string } {
  if (!secret || secret.length < 32) return { ok: false, reason: 'not_configured' };
  const timestamp = headers.get('x-webhook-timestamp');
  const signature = headers.get('x-webhook-signature');
  if (!timestamp || !signature || !/^\d{9,11}$/.test(timestamp)) return { ok: false, reason: 'missing_signature' };
  if (Math.abs(nowSeconds - Number(timestamp)) > REPLAY_WINDOW_SECONDS) return { ok: false, reason: 'stale' };
  const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  return safeEqual(signature, expected) ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

export function signRequest(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return {
    'x-webhook-timestamp': String(timestamp),
    'x-webhook-signature': `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`,
  };
}
