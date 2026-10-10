import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * CRM end-to-end tests. Need the local database (`pnpm db:local start`,
 * migrated): it is reseeded before the run. Both apps run from production
 * builds (`pnpm build`), each with its least-privilege database role.
 */
const root = join(import.meta.dirname, '../..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const LOCAL_DB = 'postgresql://postgres@127.0.0.1:54329/healwyn';
const localDb = join(root, 'scripts/local-db.sh');

async function reachable(url: string): Promise<boolean> {
  const { hostname, port } = new URL(url);
  return new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(800);
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
    socket.connect(Number(port), hostname);
  });
}

const hasDb = await reachable(LOCAL_DB);
process.env.E2E_DB = hasDb ? LOCAL_DB : '';
process.env.E2E_STARTED_AT = new Date().toISOString();
const role = (command: string) => (hasDb ? execFileSync('bash', [localDb, command], { encoding: 'utf8' }).trim() : '');

const WEB = 3200;
const CRM = 3201;
process.env.E2E_WEB_URL = `http://127.0.0.1:${WEB}`;
process.env.E2E_CRM_URL = `http://127.0.0.1:${CRM}`;

const shared = {
  RESEND_API_KEY: '',
  LEAD_NOTIFY_EMAIL: '',
  SITE_URL: process.env.E2E_WEB_URL,
  UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? 'e2e-unsubscribe-secret-0123456789abcdef',
  CRON_SECRET: process.env.CRON_SECRET ?? 'e2e-cron-secret-0123456789abcdef0123456789',
  INBOUND_WEBHOOK_SECRET: process.env.INBOUND_WEBHOOK_SECRET ?? 'e2e-inbound-secret-0123456789abcdef012345',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-session-secret-0123456789abcdef0123456789',
};
Object.assign(process.env, shared);

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: process.env.E2E_CRM_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true } },
  ],
  webServer: hasDb
    ? [
        {
          command: `node node_modules/next/dist/bin/next start -p ${WEB}`,
          cwd: join(root, 'apps/web'),
          url: `${process.env.E2E_WEB_URL}/robots.txt`,
          reuseExistingServer: false,
          env: {
            ...shared,
            LEAD_STORE: 'postgres',
            WEB_DATABASE_URL: role('web-url'),
            DATABASE_URL: '',
            RATE_LIMIT_SALT: 'e2e',
          },
        },
        {
          command: `node node_modules/next/dist/bin/next start -p ${CRM}`,
          url: `${process.env.E2E_CRM_URL}/login`,
          reuseExistingServer: false,
          env: {
            ...shared,
            CRM_DATABASE_URL: role('crm-url'),
            DATABASE_URL: '',
            DEMO_LOGIN: 'true',
            AUTH_PROVIDER: 'local',
          },
        },
      ]
    : undefined,
});
