import { expect, test } from '@playwright/test';
import { query, requireDb, signInAs, submitWebsiteEnquiry } from './helpers';

test.beforeEach(() => requireDb());

test('a website enquiry appears in the CRM and moves through stages, with undo', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);

  await signInAs(page, 'care_coordinator');
  await page.goto(`/pipeline?view=list&q=${encodeURIComponent(name)}`);
  await expect(page.getByRole('link', { name })).toBeVisible();
  await page.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(page.getByText('Enquiry received from the website')).toBeVisible();
  await expect(page.getByText('Started “New lead welcome”')).toBeVisible();

  // Move with the keyboard-friendly stage control.
  await page.getByLabel('Stage').selectOption('appointment_booked');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Notification' })).toContainText(
    `Moved ${name} to Appointment booked.`,
  );
  await expect(page.getByText('Moved from New to Appointment booked')).toBeVisible();
  await expect(page.getByText('Started “Appointment reminder”')).toBeVisible();

  // Undo restores the stage and records both moves.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('status', { name: 'Notification' })).toContainText(`Moved ${name} back to New.`);
  await expect(page.getByText('Moved from Appointment booked to New (undo)')).toBeVisible();

  const [lead] = await query(
    (sql) => sql<{ stage: string; first_response_at: Date | null }[]>`
    select stage, first_response_at from public.leads where full_name = ${name}`,
  );
  expect(lead?.stage).toBe('new');
  expect(lead?.first_response_at).not.toBeNull();
});

test('moves a card on the board with the Move menu, using only the keyboard', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  await signInAs(page, 'care_coordinator');
  await page.goto(`/pipeline?q=${encodeURIComponent(name)}`);

  const summary = page.locator('summary', { hasText: `Move ${name}` });
  // React reveals streamed Suspense content in batches; focus only once the card is on screen.
  await expect(summary).toBeVisible();
  await summary.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'AI-triaged', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Notification' })).toContainText(`Moved ${name} to AI-triaged.`);
  await expect(page.getByRole('region', { name: 'AI-triaged' }).getByRole('link', { name })).toBeVisible();
});

test('moves a card by keyboard drag-and-drop', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  await signInAs(page, 'care_coordinator');
  await page.goto(`/pipeline?q=${encodeURIComponent(name)}`);
  const handle = page.getByRole('button', { name: `Drag ${name} to another stage` });
  await expect(handle).toBeVisible();
  await handle.focus();
  for (const key of ['Space', 'ArrowRight', 'ArrowRight', 'Space']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250); // dnd-kit applies each move on the next animation frame
  }
  await expect(page.getByRole('status', { name: 'Notification' })).toContainText(
    `Moved ${name} to Appointment booked.`,
  );
  await expect(page.getByRole('region', { name: 'Appointment booked' }).getByRole('link', { name })).toBeVisible();
});

test('filters and sorts the list view', async ({ page }) => {
  await signInAs(page, 'manager');
  await page.goto('/pipeline?view=list&urgency=urgent');
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all()) await expect(row.getByText('Urgent')).toBeVisible();

  await page.goto('/pipeline?view=list&sort=score&dir=desc');
  await expect(page.getByRole('columnheader', { name: /Score/ })).toHaveAttribute('aria-sort', 'descending');
  const scores = await page.locator('tbody tr td:nth-child(5)').allInnerTexts();
  const numbers = scores.map((s) => Number(s.replace(/\D/g, '')) || 0);
  expect([...numbers].sort((a, b) => b - a)).toEqual(numbers);
});

test('adds a note from a template and a task, then completes the task', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  await signInAs(page, 'care_coordinator');
  await page.goto(`/pipeline?view=list&q=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name }).click();

  await page.getByLabel('Template').selectOption({ label: 'Called, no answer' });
  await expect(page.getByLabel('Add a note')).toHaveValue(/No answer/);
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Note added').first()).toBeVisible();
  await expect(page.getByText('Called at the preferred time. No answer.').first()).toBeVisible();

  await page.getByLabel('New task').fill('Call back after lunch');
  await page.getByRole('button', { name: 'Add task' }).click();
  const tasks = page.getByRole('region', { name: 'Tasks' });
  await expect(tasks.getByText('Call back after lunch').first()).toBeVisible();
  await page.getByRole('button', { name: 'Mark “Call back after lunch” done' }).click();
  await expect(page.getByText('Task completed')).toBeVisible();
});

test('accepts the routing suggestion, which explains itself and copies in the billing desk', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  await signInAs(page, 'care_coordinator');
  await page.goto(`/pipeline?view=list&q=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name }).click();

  const panel = page.getByRole('region', { name: /Routing suggestion/ });
  await expect(panel).toContainText('Specialty: Dermatology team');
  const suggested = (await panel.getByRole('heading').innerText()).replace(/^Routing suggestion:\s*/, '').trim();
  expect(['Dr. Meera Kulkarni', 'Dr. Sana Mirza']).toContain(suggested);
  await panel.getByText('Score breakdown').click();
  await expect(panel.getByRole('table', { name: 'Routing scores for each candidate' })).toBeVisible();

  await panel.getByRole('button', { name: `Assign to ${suggested}` }).click();
  await expect(page.getByRole('status', { name: 'Notification' })).toContainText(`Assigned to ${suggested}.`);
  const event = page.getByRole('listitem').filter({ hasText: `Routed to ${suggested}` });
  await expect(event).toContainText('Specialty: Dermatology team');
  await expect(event).toContainText(`Chose ${suggested}`);
  await expect(event).toContainText('Copied in Deepa Menon (billing desk) to check insurance.');
  await expect(
    page.getByRole('region', { name: 'Tasks' }).getByRole('button', { name: 'Mark “Check insurance cover” done' }),
  ).toBeVisible();
});

test('overriding the suggestion with the keyboard needs a reason, which is recorded', async ({ page }) => {
  const name = await submitWebsiteEnquiry(page);
  await signInAs(page, 'care_coordinator');
  await page.goto(`/pipeline?view=list&q=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

  const select = page.getByLabel('Assigned to');
  await select.focus();
  await select.selectOption({ label: 'Neha Joshi (Care coordinator)' });
  await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeDisabled();
  await page.keyboard.press('Tab'); // the disabled button is skipped
  const reason = page.getByLabel('Reason for not following the routing suggestion');
  await expect(reason).toBeFocused();
  await reason.selectOption({ label: 'The patient asked for this person' });
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status', { name: 'Notification' })).toContainText('Lead assigned.');
  const event = page.getByRole('listitem').filter({ hasText: 'Assigned to Neha Joshi (overriding the suggestion)' });
  await expect(event).toContainText('Overrode the routing suggestion: The patient asked for this person.');
});
