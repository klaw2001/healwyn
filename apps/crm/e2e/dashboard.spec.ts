import { clinicPack } from '@healwyn/core';
import { expect, test, type Page } from '@playwright/test';
import { query, requireDb, signInAs } from './helpers';

test.beforeEach(() => requireDb());

const wonLabel = clinicPack.stages.find((s) => s.kind === 'won')!.label;

function kpi(page: Page, label: string) {
  return page
    .getByRole('region', { name: 'Key numbers' })
    .locator('div', { has: page.getByText(label, { exact: true }) })
    .locator('dd')
    .first();
}

test('the manager sees numbers computed from the data', async ({ page }) => {
  // The default range: the last 30 days in India time, clinic individual leads (RLS limits the manager to clinic).
  const [row] = await query(
    (sql) => sql<{ leads: number; won: number }[]>`
      with scope as (
        select l.id, l.stage from public.leads l
        where l.industry = 'clinic' and l.lead_type = 'individual'
          and l.created_at >= (((now() at time zone 'Asia/Kolkata')::date - 29)::timestamp at time zone 'Asia/Kolkata')
          and l.created_at < (((now() at time zone 'Asia/Kolkata')::date + 1)::timestamp at time zone 'Asia/Kolkata')
      )
      select count(*)::int as leads,
             count(*) filter (where stage = 'package_active' or exists (
               select 1 from public.lead_events e where e.lead_id = scope.id and e.type = 'stage.changed'
                 and e.payload ->> 'to' = 'package_active'))::int as won
      from scope`,
  );
  expect(row!.leads).toBeGreaterThan(0); // the seed spreads demo leads over the last weeks

  await signInAs(page, 'manager');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(kpi(page, 'Leads created')).toHaveText(row!.leads.toLocaleString('en-IN'));
  await expect(kpi(page, `Reached ${wonLabel}`)).toHaveText(row!.won.toLocaleString('en-IN'));

  for (const name of [
    'Funnel by stage',
    'First response against target',
    `Missed ${clinicPack.booking.noun}s`,
    'AI assistant call outcomes',
    'Team load',
    'Lead sources',
    'Conversion over time',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  await expect(page.getByTestId('funnel-takeaway')).toContainText(`of ${row!.leads} leads`);
  await expect(page.getByRole('img', { name: /^Funnel: New \d+/ })).toBeVisible();

  // Every chart has its numbers in a table, and nothing reads NaN or undefined.
  const funnel = page.getByRole('region', { name: 'Funnel by stage' });
  await funnel.getByText('Show the numbers').click();
  await expect(funnel.getByRole('rowheader', { name: 'New', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/NaN|undefined|Infinity/);
});

test('filters live in the URL and narrow every number', async ({ page }) => {
  await signInAs(page, 'manager');
  await page.goto('/dashboard');

  const form = page.getByRole('form', { name: 'Dashboard filters' });
  await form.getByRole('textbox', { name: 'From', exact: true }).fill('2026-01-05');
  await form.getByRole('textbox', { name: 'To', exact: true }).fill('2026-01-11');
  await form.getByRole('combobox', { name: /^Specialty/ }).selectOption('dermatology');
  await form.getByRole('button', { name: 'Apply' }).click();

  await expect(page).toHaveURL(/from=2026-01-05/);
  await expect(page).toHaveURL(/to=2026-01-11/);
  await expect(page).toHaveURL(/offering=dermatology/);
  await expect(page.getByTestId('dashboard-scope')).toContainText('Dermatology');
  // No demo leads that early: empty states, never NaN.
  await expect(kpi(page, 'Leads created')).toHaveText('0');
  await expect(kpi(page, 'No-show rate')).toHaveText('—');
  await expect(page.getByTestId('funnel-takeaway')).toHaveText('No leads were created in this period.');
  await expect(page.getByRole('main')).not.toContainText(/NaN|undefined|Infinity/);

  // A reversed range is swapped, and the presets keep the specialty.
  await page.goto('/dashboard?from=2026-01-11&to=2026-01-05');
  await expect(page.getByRole('status').filter({ hasText: 'swapped' })).toBeVisible();
  await page.goto('/dashboard?offering=dermatology');
  await page.getByRole('link', { name: 'Last 7 days' }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&offering=dermatology/);
});

test('keeps the dashboard from a care coordinator, even by URL', async ({ page }) => {
  await signInAs(page, 'care_coordinator');
  const response = await page.goto('/dashboard');
  expect(response?.status()).toBe(403);
  await expect(page.getByRole('heading', { name: 'This screen is not part of your role' })).toBeVisible();
  await expect(page.getByText('Funnel by stage')).toHaveCount(0);
});
