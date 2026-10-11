import { expect, test } from '@playwright/test';
import { databaseUrl, db, demoPhone, fillValid, useClientIp } from './helpers';

test.beforeEach(async ({ page }) => {
  await useClientIp(page);
});

test('without a link, booking starts with an enquiry', async ({ page }) => {
  await page.goto('/book');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose a time for your consultation');
  await expect(page.getByRole('heading', { name: 'Start with a short enquiry' })).toBeVisible();
  await page.goto('/book?t=not-a-real-link');
  await expect(page.getByText('This booking link is not valid or has expired.')).toBeVisible();
});

test('after an enquiry, the person books, moves and cancels a real slot', async ({ page }) => {
  test.skip(!databaseUrl, 'Booking needs the database');
  await page.goto('/contact');
  await fillValid(page, demoPhone());
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.getByRole('link', { name: 'Choose a time for your consultation' }).click();

  await expect(page).toHaveURL(/\/book\?t=/);
  await expect(page.getByText('Times are shown in India time.', { exact: false })).toBeVisible();
  const times = page.getByRole('radiogroup', { name: /Times on/ });
  await times.getByRole('radio').first().check();
  const chosen = await times.getByRole('radio').first().getAttribute('value');
  await page.getByRole('button', { name: 'Book this consultation' }).click();

  await expect(page.getByRole('status')).toContainText('Your consultation is booked.');
  await expect(page.getByRole('heading', { name: 'Your consultation', exact: true })).toBeVisible();
  const leadId = new URL(page.url()).searchParams.get('t')!.split('.')[0]!;
  const sql = db();
  try {
    const [booked] = await sql`
      select a.starts_at, l.stage from public.appointments a join public.leads l on l.id = a.lead_id
      where a.lead_id = ${leadId} and a.status = 'booked'`;
    expect(new Date(booked!.starts_at).toISOString()).toBe(chosen);
    expect(booked!.stage).toBe('appointment_booked');

    // Move it to another time.
    await page.getByRole('link', { name: 'Change the time' }).click();
    await page
      .getByRole('radiogroup', { name: /Times on/ })
      .getByRole('radio')
      .nth(1)
      .check();
    await page.getByRole('button', { name: 'Move my booking to this time' }).click();
    await expect(page.getByRole('status')).toContainText('Your consultation is booked.');
    const rows = await sql`select status from public.appointments where lead_id = ${leadId} order by created_at`;
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'booked']);

    // Cancel: the lead goes back to where it was.
    await page.getByRole('button', { name: 'Cancel this consultation' }).click();
    await expect(page.getByRole('status')).toContainText('Your consultation is cancelled.');
    const [lead] = await sql`select stage from public.leads where id = ${leadId}`;
    expect(lead!.stage).toBe('new');
  } finally {
    await sql.end();
  }
});
