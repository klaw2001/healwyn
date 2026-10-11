/**
 * Unsubscribe links: `<leadId>.<signature>`, where the signature is an
 * HMAC-SHA256 of the lead id with UNSUBSCRIBE_SECRET. No database lookup is
 * needed to check a link, and a link cannot be forged for another lead.
 */

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64url');
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(`unsubscribe:${value}`)));
}

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 16) throw new Error('UNSUBSCRIBE_SECRET must be set (16+ characters)');
  return secret;
}

export async function signUnsubscribeToken(leadId: string, secret: string | undefined): Promise<string> {
  return `${leadId}.${await hmac(requireSecret(secret), leadId)}`;
}

/** Returns the lead id when the token is genuine, otherwise null. Constant-time comparison. */
export async function verifyUnsubscribeToken(token: string, secret: string | undefined): Promise<string | null> {
  const [leadId, signature] = token.split('.');
  if (!leadId || !signature || !/^[0-9a-f-]{36}$/i.test(leadId)) return null;
  const expected = await hmac(requireSecret(secret), leadId);
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0 ? leadId : null;
}

/** The page linked from every message: shows a confirmation button. */
/** The unsubscribe page; `industry` makes the page show the lead's own brand. */
export function unsubscribeUrl(siteUrl: string, token: string, industry?: string): string {
  const base = `${siteUrl.replace(/\/$/, '')}/unsubscribe?token=${encodeURIComponent(token)}`;
  return industry ? `${base}&i=${encodeURIComponent(industry)}` : base;
}

/** RFC 8058 one-click endpoint for the List-Unsubscribe header (mail clients POST to it). */
export function oneClickUnsubscribeUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, '')}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
