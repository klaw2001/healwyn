import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

// One .env at the repo root serves every package. Variables already set in the
// environment (CI, hosting dashboard) win over the file. (Next's own loader
// only reads the app folder, and caches its first result.)
const repoRoot = join(import.meta.dirname, '../..');
const rootEnv = join(repoRoot, '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

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
