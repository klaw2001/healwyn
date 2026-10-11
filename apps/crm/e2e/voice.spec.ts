import { expect, test, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { CRM_URL, query, requireDb, signInAs, submitWebsiteEnquiry, uniqueName, uniquePhone, WEB_URL } from './helpers';

test.beforeEach(() => requireDb());

async function openLead(page: Page, name: string) {
  await page.goto(`/pipeline?view=list&q=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

test('form, then a simulated assistant call, then the lead is triaged, routed and summarised', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page, { assistantCall: true });
  await signInAs(page, 'care_coordinator');
  await openLead(page, name);

  await page.getByRole('button', { name: 'Simulated assistant call' }).click();
  await expect(page.getByRole('status', { name: 'Notification' })).toContainText('Simulated call finished: completed.');

  const summary = page.getByRole('region', { name: 'AI summary' });
  await expect(summary).toContainText('Qualified');
  await expect(summary).toContainText('Looking for help with Dermatology (skin, hair, nails); First visit.');
  await expect(summary).toContainText('How it was routed');
  await expect(summary).toContainText('Specialty: Dermatology team');
  await expect(summary.getByText(/Transcript \(\d+ turns\)/)).toBeVisible();
  await expect(page.getByRole('main').getByText('AI-triaged', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: /^Routed to Dr\. (Meera Kulkarni|Sana Mirza)/ }),
  ).toBeVisible();
  await expect(page.getByText('Assistant call ended: qualified')).toBeVisible();

  const [lead] = await query(
    (sql) => sql<{ stage: string; assigned_staff_id: string | null }[]>`
    select stage, assigned_staff_id from public.leads where full_name = ${name}`,
  );
  expect(lead).toMatchObject({ stage: 'ai_triaged' });
  expect(lead!.assigned_staff_id).not.toBeNull();
});

test('the dialer refuses a lead without call consent, and says why on the timeline', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  await signInAs(page, 'care_coordinator');
  await openLead(page, name);
  await expect(page.getByText('The lead has not agreed to assistant calls')).toBeVisible();
  await page.getByRole('button', { name: 'Simulated assistant call' }).click();
  await expect(page.getByRole('alert', { name: 'Notification' })).toContainText('has not agreed to calls');
  await expect(page.getByText('Assistant call not placed: no consent for assistant calls')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phone call' })).toBeDisabled();
});

test('the website assistant (typed chat) stops at a red flag and the CRM flags the lead urgent', async ({ page }) => {
  const name = uniqueName('Ravi');
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.7` });
  await page.goto(WEB_URL);
  await page.getByRole('button', { name: 'Talk to our assistant' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Talk to our AI assistant' });
  await expect(dialog.getByText('AI assistant · not a person')).toBeVisible();
  await dialog.getByLabel('Your name').fill(name);
  await dialog.getByLabel('Mobile number').fill(uniquePhone());
  await dialog.getByRole('checkbox', { name: /store and use the details/ }).check();
  await dialog.getByRole('checkbox', { name: /AI assistant between 9am/ }).check();
  await dialog.getByRole('button', { name: 'Type instead' }).click();

  const chat = page.getByRole('dialog');
  const conversation = chat.getByRole('list', { name: 'Conversation' });
  await expect(conversation).toContainText('automated assistant, not a person');
  for (const text of ['yes', 'actually I have chest pain and my left arm feels heavy']) {
    await chat.getByLabel('Your message').fill(text);
    await chat.getByRole('button', { name: 'Send' }).click();
  }
  await expect(chat.getByRole('heading', { name: 'Thank you' })).toBeVisible();
  await expect(chat).toContainText('Please call 112 now');
  await page.context().setExtraHTTPHeaders({});

  await signInAs(page, 'care_coordinator');
  await openLead(page, name);
  const summary = page.getByRole('region', { name: 'AI summary' });
  await expect(summary).toContainText('Safety: Chest pain or pressure');
  await expect(summary).toContainText('Emergency advice given');
  await expect(page.getByRole('main').getByText('Urgent', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Tasks' }).getByRole('button', { name: /Mark “Urgent: safety concern/ }),
  ).toBeVisible();
});

test('a manager sees assistant usage and manages verified numbers; a coordinator cannot', async ({ page }) => {
  await signInAs(page, 'care_coordinator');
  const forbidden = await page.goto('/assistant');
  expect(forbidden?.status()).toBe(403);

  await page.context().clearCookies();
  await signInAs(page, 'manager');
  await page.goto('/assistant');
  await expect(page.getByRole('heading', { name: 'AI assistant', level: 1 })).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Daily call cap' })).toBeVisible();
  await expect(page.getByRole('meter', { name: 'LiveKit agent minutes' })).toBeVisible();
  await page.getByLabel('Mobile number').fill('98765 00011');
  await page.getByLabel('Label').fill('Demo phone');
  await page.getByRole('button', { name: 'Add number' }).click();
  await expect(page.getByText('+91 98765 00011')).toBeVisible();
  await page.getByRole('button', { name: 'Remove Demo phone' }).click();
  await expect(page.getByText('+91 98765 00011')).toHaveCount(0);
});

test('the voice webhook accepts only signed, fresh, well-formed results for calls it started', async ({ request }) => {
  const secret = process.env.VOICE_WEBHOOK_SECRET!;
  const post = (body: string, timestamp = Math.floor(Date.now() / 1000), key = secret) =>
    request.post(`${CRM_URL}/api/voice/complete`, {
      data: body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-timestamp': String(timestamp),
        'x-webhook-signature': `sha256=${createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')}`,
      },
    });
  const result = JSON.stringify({
    version: 1,
    callId: '0f8f5d2e-6b1c-4c1e-9a4b-2d3c4b5a6f70',
    leadId: '1ead0000-0000-4000-8000-000000000001',
    channel: 'browser',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationSeconds: 10,
    language: 'en',
    consentToContinue: true,
    outcome: 'completed',
    urgency: 'normal',
    answers: {},
    safetyFlags: [],
    summary: [],
    transcript: [],
    usage: { llmRequests: 0, sttSeconds: 0, ttsCharacters: 0 },
    agentVersion: 'e2e',
  });
  expect((await request.post(`${CRM_URL}/api/voice/complete`, { data: result })).status()).toBe(401);
  expect((await post(result, Math.floor(Date.now() / 1000) - 600)).status()).toBe(401);
  expect((await post(result, undefined, 'x'.repeat(40))).status()).toBe(401);
  expect((await post('{"not":"a result"}')).status()).toBe(400);
  expect((await post(result)).status()).toBe(404); // a call nobody started
  expect((await post('x'.repeat(300 * 1024))).status()).toBe(413);
});
