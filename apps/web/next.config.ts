import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// One .env at the repo root serves every package. Variables already set in the
// environment (CI, hosting dashboard) win over the file.
const repoRoot = join(import.meta.dirname, '../..');
loadEnvConfig(repoRoot, process.env.NODE_ENV !== 'production');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@healwyn/core', '@healwyn/db', '@healwyn/messaging', '@healwyn/ui'],
  serverExternalPackages: ['postgres'],
  turbopack: { root: repoRoot },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
