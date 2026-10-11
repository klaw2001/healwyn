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

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // The assistant's voice calls need the microphone, for this site only (no embedded frames).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()' },
];

const config: NextConfig = {
  // `next dev` would otherwise write an AGENTS.md into the app; CLAUDE.md is the guide here.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@healwyn/core', '@healwyn/db', '@healwyn/messaging', '@healwyn/ui'],
  serverExternalPackages: ['postgres'],
  turbopack: { root: repoRoot },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Phase 4 moved the clinic-only routes to names every industry shares.
  async redirects() {
    return [
      { source: '/specialties', destination: '/services', permanent: true },
      { source: '/specialties/:slug', destination: '/services/:slug', permanent: true },
      { source: '/doctors', destination: '/team', permanent: true },
      { source: '/health-packages', destination: '/plans', permanent: true },
    ];
  },
};

export default config;
