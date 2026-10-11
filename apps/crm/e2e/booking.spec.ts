import { expect, test } from '@playwright/test';
import { query, requireDb, signInAs, submitWebsiteEnquiry } from './helpers';

test.beforeEach(() => requireDb());

test('the front desk books a lead into a real slot, sees it on Bookings and marks it attended', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  const [lead] = await query((sql) => sql<{ id: string }[]>`select id from public.leads where full_name = ${name}`);

  await signInAs(page, 'care_coordinator');
  await page.goto(`/leads/${lead!.id}`);
  const panel = page.getByRole('region', { name: 'consultation', exact: true });
  await expect(panel.getByText('No upcoming consultation.')).toBeVisible();
  await panel.getByRole('group', { name: /Time/ }).getByRole('button').first().click();
  await panel.getByRole('button', { name: /^Book consultation:/ }).click();
  await expect(panel.getByRole('status')).toContainText('Booked for');
  await expect(page.getByText(/^Booked with /)).toBeVisible();

  const [booked] = await query(
    (sql) => sql<{ id: string; starts_at: Date; stage: string }[]>`
      select a.id, a.starts_at, l.stage from public.appointments a join public.leads l on l.id = a.lead_id
      where a.lead_id = ${lead!.id} and a.status = 'booked'`,
  );
  expect(booked!.stage).toBe('appointment_booked');

  // The bookings screen lists it in its week.
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(booked!.starts_at);
  await page.goto(`/bookings?from=${day}`);
  await expect(page.getByRole('link', { name })).toBeVisible();

  // Once it has started, it can be marked attended, which moves the lead on.
  // (Pick a free past time: the database refuses overlapping appointments.)
  await query(
    (sql) => sql`
      update public.appointments a set starts_at = t.at, ends_at = t.at + interval '30 minutes'
      from (
        select g.at from generate_series(now() - interval '6 days', now() - interval '1 hour', interval '5 minutes') g(at)
        where not exists (
          select 1 from public.appointments b
          where b.staff_id = (select staff_id from public.appointments where id = ${booked!.id})
            and b.id <> ${booked!.id} and b.status <> 'cancelled'
            and tstzrange(b.starts_at, b.ends_at) && tstzrange(g.at, g.at + interval '30 minutes'))
        order by random() limit 1
      ) t
      where a.id = ${booked!.id}`,
  );
  await page.goto(`/leads/${lead!.id}`);
  await panel.getByRole('button', { name: 'Attended' }).click();
  await expect(panel.getByRole('status')).toContainText('Marked as attended.');
  const [after] = await query((sql) => sql<{ stage: string }[]>`select stage from public.leads where id = ${lead!.id}`);
  expect(after!.stage).toBe('visited');
});

test('an expert edits their own weekly hours and time off', async ({ page }) => {
  await signInAs(page, 'specialist_doctor');
  await page.goto('/availability');
  await expect(page.getByRole('heading', { name: 'My hours', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'People who take bookings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save weekly hours' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Weekly hours saved.' })).toBeVisible();

  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + 20 * 86_400_000),
  );
  await page.getByLabel('Date').fill(date);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const removal = page.getByRole('button', { name: /^Remove Time off on/ });
  await expect(removal).toBeVisible();
  await removal.click();
  await expect(removal).toHaveCount(0);
});

test('the billing desk sees bookings but cannot change hours', async ({ page }) => {
  await signInAs(page, 'billing_desk');
  await page.goto('/bookings');
  await expect(page.getByRole('heading', { name: 'Bookings', level: 1 })).toBeVisible();
  const response = await page.goto('/availability');
  expect(response?.status()).toBe(403);
});
