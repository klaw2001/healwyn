import { clinicPack, formatRupees } from '@healwyn/core';
import { expect, test } from '@playwright/test';
import { databaseUrl, db, demoPhone, fillValid, useClientIp } from './helpers';

test.beforeEach(async ({ page }) => {
  await useClientIp(page);
});

test('payments are clearly test mode and need the person’s own link', async ({ page }) => {
  await page.goto('/pay');
  await expect(page.getByRole('note').filter({ hasText: 'no real money moves' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send an enquiry' })).toBeVisible();
});

test('a declined test payment can be retried, and a paid one moves the lead to Package active', async ({ page }) => {
  test.skip(!databaseUrl, 'Payments need the database');
  const product = clinicPack.payments.products[0]!;
  await page.goto('/contact');
  await fillValid(page, demoPhone());
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  const bookingLink = await page
    .getByRole('link', { name: 'Choose a time for your consultation' })
    .getAttribute('href');
  await page.goto(bookingLink!.replace('/book?', '/pay?'));
  const leadId = new URL(page.url()).searchParams.get('t')!.split('.')[0]!;

  await expect(page.getByText('Test payment', { exact: true }).first()).toBeVisible();
  await page.getByRole('radio', { name: new RegExp(product.name) }).check();
  await page.getByRole('button', { name: 'Continue to test payment' }).click();
  await page.getByRole('button', { name: /^Decline/ }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'The test payment did not go through. Nothing was charged.',
  );

  await page.getByRole('button', { name: 'Try the test payment again' }).click();
  await page.getByRole('button', { name: `Pay ${formatRupees(product.amountPaise)} (test payment)` }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Test payment received');
  await expect(page.getByRole('heading', { name: 'Paid (test)' })).toBeVisible();

  const sql = db();
  try {
    const payments = await sql`select status, mode from public.payments where lead_id = ${leadId} order by created_at`;
    expect(payments).toEqual([
      { status: 'failed', mode: 'test' },
      { status: 'paid', mode: 'test' },
    ]);
    const [lead] = await sql`select stage from public.leads where id = ${leadId}`;
    expect(lead!.stage).toBe(clinicPack.payments.paidStageId);
  } finally {
    await sql.end();
  }
});

test('the Razorpay webhook is closed while payments are simulated', async ({ request }) => {
  const response = await request.post('/api/payments/razorpay', { data: { event: 'payment.captured' } });
  expect(response.status()).toBe(404);
});
