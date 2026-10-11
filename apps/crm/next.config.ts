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
