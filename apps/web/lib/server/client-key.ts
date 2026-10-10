import 'server-only';
import { sha256Hex } from '@healwyn/core';

/** The caller's IP as reported by the host. Netlify sets x-nf-client-connection-ip. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-nf-client-connection-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}

/** A salted hash, so raw IP addresses are never stored. */
export async function rateLimitKey(scope: string, ip: string, salt = process.env.RATE_LIMIT_SALT): Promise<string> {
  const digest = await sha256Hex(`${salt ?? 'local-development-salt'}:${scope}:${ip}`);
  return `${scope}:${digest.slice(0, 40)}`;
}
