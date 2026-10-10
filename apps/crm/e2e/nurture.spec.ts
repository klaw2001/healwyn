import { signUnsubscribeToken } from '@healwyn/messaging';
import { expect, test } from '@playwright/test';
import { CRM_URL, query, requireDb, runWorker, signInAs, submitWebsiteEnquiry, WEB_URL } from './helpers';
import { createHmac } from 'node:crypto';

test.beforeEach(() => requireDb());

test('a sequence enrols, sends its first message, and stops when the lead replies', async ({ page, request }) => {
  const name = await submitWebsiteEnquiry(page, { email: 'nurture.e2e@example.com' });
  await runWorker(request);

  await signInAs(page, 'care_coordinator');
  await page.goto(`/pipeline?view=list&q=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name }).click();

  const messages = page.getByRole('region', { name: 'Messages' });
  await expect(messages.getByText(/We have your enquiry/).first()).toBeVisible();
  await expect(messages.getByText('Logged, not sent')).toBeVisible(); // no Resend key in tests
  await expect(page.getByText('Email logged (no provider)')).toBeVisible();

  await page.getByRole('button', { name: 'Mark as replied' }).click();
  await expect(page.getByRole('status', { name: 'Notification' })).toContainText('1 sequence stopped');
  await expect(page.getByText(/Stopped “New lead welcome”: lead replied/)).toBeVisible();

  const [pending] = await query(
    (sql) => sql<{ n: number }[]>`
    select count(*)::int as n from public.scheduled_messages s join public.leads l on l.id = s.lead_id
    where l.full_name = ${name} and s.status = 'pending'`,
  );
  expect(pending?.n).toBe(0);
});

test('the unsubscribe link in a message works and takes effect at once', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  const [lead] = await query((sql) => sql<{ id: string }[]>`select id from public.leads where full_name = ${name}`);
  const token = await signUnsubscribeToken(lead!.id, process.env.UNSUBSCRIBE_SECRET);

  await page.goto(`${WEB_URL}/unsubscribe?token=${encodeURIComponent(token)}`);
  await page.getByRole('button', { name: 'Unsubscribe' }).click();
  await expect(page.getByRole('heading', { name: 'You are unsubscribed' })).toBeVisible();

  const [after] = await query(
    (sql) => sql<{ opted_out: boolean; active: number }[]>`
    select opted_out_at is not null as opted_out,
           (select count(*)::int from public.sequence_enrollments e where e.lead_id = l.id and e.status = 'active') as active
    from public.leads l where id = ${lead!.id}`,
  );
  expect(after).toEqual({ opted_out: true, active: 0 });

  // A forged token changes nothing.
  await page.goto(`${WEB_URL}/unsubscribe?token=${encodeURIComponent(`${lead!.id}.forged`)}`);
  await page.getByRole('button', { name: 'Unsubscribe' }).click();
  await expect(page.getByText('This unsubscribe link is not valid')).toBeVisible();
});

test('the inbound webhook accepts only signed, fresh requests', async ({ page, request }) => {
  const name = await submitWebsiteEnquiry(page);
  const [lead] = await query((sql) => sql<{ id: string }[]>`select id from public.leads where full_name = ${name}`);
  const body = JSON.stringify({ leadId: lead!.id, channel: 'email', body: 'Yes please, Tuesday works.' });
  const sign = (timestamp: number) => ({
    'content-type': 'application/json',
    'x-webhook-timestamp': String(timestamp),
    'x-webhook-signature': `sha256=${createHmac('sha256', process.env.INBOUND_WEBHOOK_SECRET!).update(`${timestamp}.${body}`).digest('hex')}`,
  });
  const now = Math.floor(Date.now() / 1000);

  expect(
    (
      await request.post(`${CRM_URL}/api/messages/inbound`, {
        data: body,
        headers: { 'content-type': 'application/json' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (await request.post(`${CRM_URL}/api/messages/inbound`, { data: body, headers: sign(now - 600) })).status(),
  ).toBe(401);
  const ok = await request.post(`${CRM_URL}/api/messages/inbound`, { data: body, headers: sign(now) });
  expect(ok.status()).toBe(200);

  const [after] = await query(
    (sql) => sql<{ replied: boolean; active: number }[]>`
    select last_inbound_at is not null as replied,
           (select count(*)::int from public.sequence_enrollments e where e.lead_id = l.id and e.status = 'active') as active
    from public.leads l where id = ${lead!.id}`,
  );
  expect(after).toEqual({ replied: true, active: 0 });
});

test('the worker endpoint refuses callers without the cron secret', async ({ request }) => {
  const response = await request.post(`${CRM_URL}/api/cron/nurture`, { headers: { authorization: 'Bearer wrong' } });
  expect(response.status()).toBe(401);
});

test('a manager can pause and resume a sequence', async ({ page }) => {
  await signInAs(page, 'manager');
  await page.goto('/sequences');
  const card = page.getByRole('article', { name: 'Package renewal' });
  await card.getByRole('button', { name: 'Pause Package renewal' }).click();
  await expect(card.getByText('Paused', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Resume Package renewal' }).click();
  await expect(card.getByText('Running', { exact: true })).toBeVisible();
});
