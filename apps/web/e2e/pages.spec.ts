import { BRAND } from '@healwyn/core';
import { expect, test } from '@playwright/test';
import { ROUTES } from './helpers';

for (const route of ROUTES) {
  test(`${route} renders, carries the notices and fits the screen`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1')).toHaveCount(1);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText(BRAND.emergencyNotice);
    await expect(footer).toContainText(BRAND.demoNotice);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'horizontal scroll').toBeLessThanOrEqual(0);

    // Every image has alt text; every inline SVG is either hidden from assistive tech or labelled.
    const unlabelled = await page.evaluate(() => [
      ...[...document.querySelectorAll('img:not([alt])')].map((el) => el.outerHTML.slice(0, 80)),
      ...[...document.querySelectorAll('svg')]
        .filter((svg) => !svg.closest('[aria-hidden="true"]') && svg.getAttribute('role') !== 'img')
        .map((svg) => svg.outerHTML.slice(0, 80)),
    ]);
    expect(unlabelled).toEqual([]);
  });
}

test('unknown pages return 404 with a way back', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
});

test('form pages show the emergency notice above the form', async ({ page }) => {
  for (const route of ['/contact', '/partners']) {
    await page.goto(route);
    await expect(page.getByRole('main').getByText(BRAND.emergencyNotice).first()).toBeVisible();
  }
});

test('a skip link reaches the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('pages are not indexable while the brand is a demo', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
});

test('security headers allow the microphone only for this site (the assistant) and nothing else', async ({
  request,
}) => {
  const response = await request.get('/');
  const headers = response.headers();
  expect(headers['permissions-policy']).toContain('microphone=(self)');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['permissions-policy']).toContain('geolocation=()');
  expect(headers['x-frame-options']).toBe('DENY');
});

test('the home page offers the AI assistant, clearly labelled as an AI', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Talk to our assistant' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Talk to our AI assistant' });
  await expect(dialog.getByText('AI assistant · not a person')).toBeVisible();
  await expect(dialog.getByText('It cannot give medical advice.', { exact: false })).toBeVisible();
  await expect(dialog.getByText('Not for emergencies.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close the assistant' }).click();
  await expect(dialog).toBeHidden();
});
