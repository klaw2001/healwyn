import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

// One .env at the repo root serves every package. Variables already set in the
// environment (CI, hosting dashboard) win over the file. (Next's own loader
// only reads the app folder, and caches its first result.)
const repoRoot = join(import.meta.dirname, '../..');
const rootEnv = join(repoRoot, '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Payments are test mode only: refuse to start with live Razorpay keys.
if (
  /^rzp_live_/i.test(process.env.RAZORPAY_KEY_ID ?? '') ||
  /^rzp_live_/i.test(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '')
) {
  throw new Error('Live Razorpay keys detected (rzp_live_…). This demo runs payments in test mode only.');
}

// The CRM loads nothing from other origins. Inline scripts are Next's own (no nonces without per-request rendering
// of every page); everything else is this origin only.
const dev = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${dev ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Staff data: never cache pages in shared caches.
  { key: 'Cache-Control', value: 'private, no-store' },
];

const config: NextConfig = {
  // `next dev` would otherwise write an AGENTS.md into the app; CLAUDE.md is the guide here.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@healwyn/core', '@healwyn/db', '@healwyn/messaging', '@healwyn/ui'],
  serverExternalPackages: ['postgres'],
  turbopack: { root: repoRoot },
  // forbidden() renders app/forbidden.tsx with a 403 status.
  experimental: { authInterrupts: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
