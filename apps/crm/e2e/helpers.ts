import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import postgres from 'postgres';

export const hasDb = Boolean(process.env.E2E_DB);
export const WEB_URL = process.env.E2E_WEB_URL!;
export const CRM_URL = process.env.E2E_CRM_URL!;

export function requireDb() {
  test.skip(!hasDb, 'CRM tests need the local database: pnpm db:local start && pnpm db:migrate');
}

export const ROLE_BUTTONS = {
  manager: /^Manager/,
  care_coordinator: /^Care coordinator/,
  specialist_doctor: /^Specialist doctor/,
  billing_desk: /^Insurance and billing desk/,
} as const;

export async function signInAs(page: Page, role: keyof typeof ROLE_BUTTONS) {
  await page.goto('/login');
  await page.getByRole('button', { name: ROLE_BUTTONS[role] }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** On narrow screens the navigation and account controls sit behind the Menu button. */
export async function openMenuIfCollapsed(page: Page) {
  const summary = page.locator('summary', { hasText: 'Menu' });
  if (await summary.isVisible()) {
    const details = summary.locator('xpath=..');
    if (!(await details.getAttribute('open'))) await summary.click();
  }
}

export function db() {
  return postgres(process.env.E2E_DB!, { max: 1, onnotice: () => {} });
}

export async function query<T extends object>(fn: (sql: ReturnType<typeof db>) => Promise<T>): Promise<T> {
  const sql = db();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

export function uniqueName(prefix: string) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const tag = Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * 26)]).join('');
  return `${prefix} ${tag[0]!.toUpperCase()}${tag.slice(1)}`;
}

export function uniquePhone() {
  return `70000 ${String(Math.floor(Math.random() * 90000) + 10000)}`;
}

/** Submits the patient form on the public website and returns the lead's name. */
export async function submitWebsiteEnquiry(
  page: Page,
  overrides: { name?: string; email?: string; assistantCall?: boolean } = {},
) {
  const name = overrides.name ?? uniqueName('Tara');
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
  });
  await page.goto(`${WEB_URL}/contact`);
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Mobile number').fill(uniquePhone());
  if (overrides.email) await page.getByLabel('Email (optional)').fill(overrides.email);
  await page
    .getByRole('radiogroup', { name: /which language/i })
    .getByRole('radio', { name: /English/ })
    .check();
  await page.getByLabel('What would you like help with?').selectOption('dermatology');
  await page
    .getByRole('radiogroup', { name: 'When should we get in touch?' })
    .getByRole('radio', { name: /Morning/ })
    .check();
  await page
    .getByRole('radiogroup', { name: 'Is this your first visit?' })
    .getByRole('radio', { name: 'First visit' })
    .check();
  await page
    .getByRole('radiogroup', { name: /health insurance/ })
    .getByRole('radio', { name: 'Yes', exact: true })
    .check();
  await page.getByRole('checkbox', { name: /store and use the details/ }).check();
  if (overrides.assistantCall) await page.getByRole('checkbox', { name: /AI assistant between 9am/ }).check();
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you. We have your enquiry.' })).toBeVisible();
  await page.context().setExtraHTTPHeaders({});
  return name;
}

export async function runWorker(request: APIRequestContext) {
  const response = await request.post(`${CRM_URL}/api/cron/nurture`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as { claimed: number };
}
