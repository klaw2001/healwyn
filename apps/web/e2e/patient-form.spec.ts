import { expect, test, type Page } from '@playwright/test';
import { countLeadsWithPhone, databaseUrl, demoPhone, findLeadByReference, uniqueIp, useClientIp } from './helpers';

const group = (page: Page, name: RegExp | string) => page.getByRole('radiogroup', { name });

async function fillValid(page: Page, phone: string) {
  await page.getByLabel('Full name').fill('Asha Demo');
  await page.getByLabel('Mobile number').fill(phone);
  await group(page, /which language/i)
    .getByRole('radio', { name: /English/ })
    .check();
  await page.getByLabel('What would you like help with?').selectOption('dermatology');
  await page.getByLabel('Tell us a little more (optional)').fill('Synthetic end-to-end enquiry.');
  await group(page, 'When should we get in touch?')
    .getByRole('radio', { name: /Evening/ })
    .check();
  await group(page, 'Is this your first visit?').getByRole('radio', { name: 'First visit' }).check();
  await group(page, /health insurance/)
    .getByRole('radio', { name: 'No', exact: true })
    .check();
  await page.getByRole('checkbox', { name: /store and use the details/ }).check();
}

const submit = (page: Page) => page.getByRole('button', { name: 'Send enquiry' }).click();

test.beforeEach(async ({ page }) => {
  await useClientIp(page);
});

test('rejects an empty enquiry in the browser and explains every problem', async ({ page }) => {
  await page.goto('/contact');
  await submit(page);

  const summary = page.getByRole('main').getByRole('alert');
  await expect(summary).toContainText('Please check your enquiry');
  for (const message of [
    'Please enter a full name.',
    'Please enter a mobile number.',
    'Please choose a language.',
    'We need this consent to respond to your enquiry.',
  ]) {
    await expect(summary.getByRole('link', { name: message })).toBeVisible();
  }
  await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('div[tabindex="-1"]:has([role="alert"])')).toBeFocused();

  // Following a summary link moves focus to the field.
  await summary.getByRole('link', { name: 'Please enter a mobile number.' }).click();
  await expect(page.getByLabel('Mobile number')).toBeFocused();
});

test('clears an error as soon as it is fixed', async ({ page }) => {
  await page.goto('/contact');
  await submit(page);
  await expect(page.getByText('Please enter a full name.').first()).toBeVisible();
  await page.getByLabel('Full name').fill('Asha Demo');
  await expect(page.getByText('Please enter a full name.')).toHaveCount(0);
});

test('rejects bad input on the server too (JavaScript off)', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() },
  });
  const page = await context.newPage();
  await page.goto('/contact');
  await fillValid(page, '12345');
  await page.getByLabel('Full name').fill('A');
  await submit(page);

  await expect(page.getByRole('main').getByRole('alert')).toContainText('Please check your enquiry');
  await expect(page.getByText('Please enter a 10-digit Indian mobile number', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Please enter a full name.').first()).toBeVisible();
  // What the person typed is kept.
  await expect(page.getByLabel('Mobile number')).toHaveValue('12345');
  await expect(page.getByLabel('Tell us a little more (optional)')).toHaveValue('Synthetic end-to-end enquiry.');
  await context.close();
});

test('a valid enquiry creates a lead with its consent records', async ({ page }) => {
  const phone = demoPhone();
  await page.goto('/contact');
  await fillValid(page, phone);
  await submit(page);

  const heading = page.getByRole('heading', { name: 'Thank you. We have your enquiry.' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  const reference = (await page.locator('strong.font-mono').textContent())?.trim() ?? '';
  expect(reference).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);

  test.skip(!databaseUrl, 'No database: running against the in-memory store.');
  const stored = await findLeadByReference(reference);
  expect(stored?.lead).toMatchObject({
    full_name: 'Asha Demo',
    phone: `+91${phone.replace(' ', '')}`,
    email: null,
    preferred_language: 'en',
    specialty_slug: 'dermatology',
    message: 'Synthetic end-to-end enquiry.',
    stage: 'new',
    source: 'web_form',
    lead_type: 'individual',
  });
  expect(stored?.lead.answers).toEqual({
    concern_category: 'dermatology',
    preferred_time: 'evening',
    visit_type: 'first',
    has_insurance: 'no',
  });
  expect(stored?.consents.map((c) => [c.purpose, c.granted])).toEqual([
    ['assistant_call', false],
    ['contact', true],
  ]);
  for (const consent of stored?.consents ?? []) expect(consent.text_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(stored?.events.map((e) => e.type)).toEqual(['lead.created', 'consent.recorded']);
});

test('can be completed with the keyboard alone', async ({ page }) => {
  const phone = demoPhone();
  await page.goto('/contact');

  const tabTo = async (name: string, role: Parameters<Page['getByRole']>[0] = 'textbox') => {
    const target = page.getByRole(role, { name }).first();
    for (let i = 0; i < 60; i += 1) {
      if (await target.evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press('Tab');
    }
    throw new Error(`Could not reach "${name}" with the Tab key`);
  };

  await tabTo('Full name');
  await page.keyboard.type('Ravi Keyboard');
  await tabTo('Mobile number');
  await page.keyboard.type(phone);
  await tabTo('English', 'radio');
  await page.keyboard.press('Space');
  await tabTo('What would you like help with?', 'combobox');
  await page.keyboard.press('ArrowDown');
  await tabTo('Morning', 'radio');
  await page.keyboard.press('Space');
  await tabTo('First visit', 'radio');
  await page.keyboard.press('Space');
  await tabTo('Yes', 'radio');
  await page.keyboard.press('Space');
  await tabTo('store and use the details', 'checkbox');
  await page.keyboard.press('Space');
  await tabTo('Send enquiry', 'button');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Thank you. We have your enquiry.' })).toBeFocused();
});

test('pretends to accept a bot that fills the honeypot, but stores nothing', async ({ page }) => {
  const phone = demoPhone();
  await page.goto('/contact');
  await fillValid(page, phone);
  await page.locator('#hw_trap_x7').evaluate((input: HTMLInputElement) => (input.value = 'http://spam.example'));
  await submit(page);
  await expect(page.getByRole('heading', { name: 'Thank you. We have your enquiry.' })).toBeVisible();

  test.skip(!databaseUrl, 'No database: running against the in-memory store.');
  expect(await countLeadsWithPhone(`+91${phone.replace(' ', '')}`)).toBe(0);
});

test('rate-limits repeated enquiries from one connection, but not mistakes', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { 'x-forwarded-for': uniqueIp() },
  });
  const page = await context.newPage();
  // Mistakes do not count.
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await page.goto('/contact');
    await submit(page);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Please check your enquiry');
  }
  // Five real enquiries go through; the sixth is limited.
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await page.goto('/contact');
    await fillValid(page, demoPhone());
    await submit(page);
    if (attempt <= 5) {
      await expect(page.getByRole('heading', { name: 'Thank you. We have your enquiry.' })).toBeVisible();
    }
  }
  await expect(page.getByRole('main').getByRole('alert')).toContainText('several enquiries in a short time');
  await context.close();
});

test('pre-selects a specialty linked from another page', async ({ page }) => {
  await page.goto('/specialties/dental');
  await page.getByRole('link', { name: 'Ask about dental' }).click();
  await expect(page).toHaveURL(/\/contact\?specialty=dental/);
  await expect(page.getByLabel('What would you like help with?')).toHaveValue('dental');
});

test('counts characters in the free-text field', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Tell us a little more (optional)').fill('Hello');
  await expect(page.getByText('5 of 500 characters')).toBeVisible();
});
