import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** A known starting point: reseed the demo data (real leads are left alone). */
export default function globalSetup() {
  if (!process.env.E2E_DB) return;
  execFileSync('pnpm', ['-s', 'db:seed'], {
    cwd: join(import.meta.dirname, '../../..'),
    env: { ...process.env, DATABASE_URL: process.env.E2E_DB, SITE_URL: process.env.E2E_WEB_URL },
    stdio: 'pipe',
  });
  // Repeated local runs would otherwise trip the sign-in rate limit.
  execFileSync('psql', [process.env.E2E_DB, '-qc', `delete from public.rate_limits where key like 'login:%'`], {
    stdio: 'pipe',
  });
}
