import 'server-only';
import { randomBytes } from 'node:crypto';
import { sha256Hex } from '@healwyn/core';

/**
 * The header that carries the real client IP. Netlify sets
 * x-nf-client-connection-ip itself (clients cannot spoof it there); elsewhere
 * the first x-forwarded-for hop is used. Override with TRUSTED_IP_HEADER.
 */
export function trustedIpHeader(env: NodeJS.ProcessEnv = process.env): string {
  if (env.TRUSTED_IP_HEADER) return env.TRUSTED_IP_HEADER.toLowerCase();
  return env.NETLIFY === 'true' ? 'x-nf-client-connection-ip' : 'x-forwarded-for';
}

/** The caller's IP, or null when the host does not say. */
export function clientIp(headers: Headers, env: NodeJS.ProcessEnv = process.env): string | null {
  const value = headers.get(trustedIpHeader(env));
  const ip = value?.split(',')[0]?.trim();
  return ip ? ip : null;
}

/**
 * IPv6 clients usually control a whole /64, so limit per /64 rather than per
 * address. IPv4 (and IPv4-mapped IPv6) addresses are used as they are.
 */
export function rateLimitSubject(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1]!;
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...headGroups, ...Array<string>(8 - headGroups.length - tailGroups.length).fill('0'), ...tailGroups]
    : headGroups;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

// Without a configured salt, use a random one per server process: hashes then
// cannot be reversed by brute force, at the cost of limits resetting on restart.
const processSalt = randomBytes(32).toString('hex');

/** A salted hash, so raw IP addresses are never stored. */
export async function rateLimitKey(scope: string, ip: string, salt = process.env.RATE_LIMIT_SALT): Promise<string> {
  const digest = await sha256Hex(`${salt || processSalt}:${scope}:${rateLimitSubject(ip)}`);
  return `${scope}:${digest.slice(0, 40)}`;
}
