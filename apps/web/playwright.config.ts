import { execFileSync } from 'node:child_process';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a production build (`pnpm build` first).
 *
 * Database: E2E_DATABASE_URL if set, otherwise the local cluster from
 * `pnpm db:local start` if it is running (migrated and seeded). The server
 * then connects as the least-privilege website role. With no database the
 * server uses the in-memory store and database assertions are skipped.
 * Email: always disabled, so tests never send real mail.
 */
const LOCAL_DB = 'postgresql://postgres@127.0.0.1:54329/healwyn';

async function reachable(url: string): Promise<boolean> {
  const { hostname, port } = new URL(url);
  return new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(800);
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
    socket.connect(Number(port || 5432), hostname);
  });
}

const useLocal = !process.env.E2E_DATABASE_URL && (await reachable(LOCAL_DB));
const databaseUrl = process.env.E2E_DATABASE_URL ?? (useLocal ? LOCAL_DB : '');
process.env.E2E_DB = databaseUrl;
process.env.E2E_STARTED_AT = new Date().toISOString();

// Against the local cluster, the site connects as the least-privilege website
// role (it may only run submit_lead and hit_rate_limit), as in production.
const webDatabaseUrl = useLocal
  ? execFileSync('bash', [join(import.meta.dirname, '../../scripts/local-db.sh'), 'web-url'], {
      encoding: 'utf8',
    }).trim()
  : databaseUrl;

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      LEAD_STORE: databaseUrl ? 'postgres' : 'memory',
      WEB_DATABASE_URL: webDatabaseUrl,
      DATABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      RESEND_API_KEY: '',
      LEAD_NOTIFY_EMAIL: '',
      RATE_LIMIT_SALT: 'e2e-salt',
      // Signs unsubscribe and booking links (the root .env's value wins when set).
      UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET || 'e2e-link-secret-0123456789',
    },
  },
});
