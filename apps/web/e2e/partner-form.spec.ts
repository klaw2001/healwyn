import { expect, test, type Page } from '@playwright/test';
import { databaseUrl, demoPhone, findLeadByReference, useClientIp } from './helpers';

const submit = (page: Page) => page.getByRole('button', { name: 'Send partnership enquiry' }).click();

test.beforeEach(async ({ page }) => {
  await useClientIp(page);
});

test('rejects an incomplete partner enquiry', async ({ page }) => {
  await page.goto('/partners');
  await page.getByLabel('Work email').fill('not-an-email');
  await submit(page);
  const summary = page.getByRole('main').getByRole('alert');
  await expect(summary).toContainText('Please check your enquiry');
  await expect(summary).toContainText('Please enter your organisation name.');
  await expect(summary).toContainText('Please enter a valid email address');
  await expect(summary).toContainText('Please choose a partnership type.');
  await expect(summary).toContainText('Please tell us briefly what you have in mind.');
});

test('a valid partner enquiry creates a partner lead', async ({ page }) => {
  await page.goto('/partners');
  await page.getByLabel('Organisation').fill('Kestrel Labs (demo)');
  await page.getByLabel('Type of partnership').selectOption('diagnostic-lab');
  await page.getByLabel('Your name').fill('Ravi Demo');
  await page.getByLabel('Your role').fill('Partnerships lead');
  await page.getByLabel('Mobile number').fill(demoPhone());
  await page.getByLabel('Work email').fill('ravi.demo@example.com');
  await page.getByLabel('What do you have in mind?').fill('Exploring a synthetic test partnership.');
  await page.getByRole('checkbox', { name: /partnership enquiry/ }).check();
  await submit(page);

  await expect(page.getByRole('heading', { name: 'Thank you. We will be in touch.' })).toBeFocused();
  const reference = (await page.locator('strong.font-mono').textContent())?.trim() ?? '';

  test.skip(!databaseUrl, 'No database: running against the in-memory store.');
  const stored = await findLeadByReference(reference);
  expect(stored?.lead).toMatchObject({
    lead_type: 'partner',
    source: 'partner_form',
    full_name: 'Ravi Demo',
    email: 'ravi.demo@example.com',
    message: 'Exploring a synthetic test partnership.',
  });
  expect(stored?.lead.answers).toEqual({
    organisation: 'Kestrel Labs (demo)',
    role: 'Partnerships lead',
    partner_type: 'diagnostic-lab',
  });
  expect(stored?.consents.map((c) => [c.purpose, c.granted])).toEqual([['partner_contact', true]]);
});
