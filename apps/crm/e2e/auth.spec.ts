import { canSeeLead, clinicPack, DEMO_USERS, ROLE_LABELS, type StaffRole } from '@healwyn/core';
import { expect, test } from '@playwright/test';
import { openMenuIfCollapsed, query, requireDb, signInAs } from './helpers';

test.beforeEach(() => requireDb());

test('sends visitors without a session to sign in', async ({ page }) => {
  await page.goto('/pipeline');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
});

for (const { role, staffId } of DEMO_USERS) {
  test(`signs in as ${role} and sees exactly what the role allows`, async ({ page }) => {
    await signInAs(page, role);
    await openMenuIfCollapsed(page);
    await expect(page.getByText(ROLE_LABELS[role], { exact: true }).locator('visible=true').first()).toBeVisible();

    // The pipeline count matches the permission matrix applied to the database.
    const leads = await query(
      (sql) => sql<{ industry: string; assigned_staff_id: string | null; billing_flag: boolean; stage: string }[]>`
      select industry, assigned_staff_id, billing_flag, stage from public.leads
      where erased_at is null and lead_type = 'individual'`,
    );
    const won = new Set<string>(clinicPack.stages.filter((s) => s.kind === 'won').map((s) => s.id));
    const expected = leads.filter((l) =>
      canSeeLead(
        role as StaffRole,
        { id: staffId, industry: 'clinic' },
        {
          industry: l.industry,
          assignedStaffId: l.assigned_staff_id,
          hasInsurance: l.billing_flag,
          stageIsWon: l.industry === 'clinic' && won.has(l.stage),
        },
      ),
    ).length;
    await page.goto('/pipeline');
    await expect(page.getByText(new RegExp(`^${expected} leads? you can see`))).toBeVisible();

    await openMenuIfCollapsed(page);
    const sequencesLink = page.getByRole('link', { name: 'Sequences' });
    await expect(page.getByRole('link', { name: 'Pipeline' }).first()).toBeVisible();
    if (role === 'manager') await expect(sequencesLink.first()).toBeAttached();
    else await expect(sequencesLink).toHaveCount(0);
  });
}

test('keeps manager-only screens from a care coordinator, even by URL', async ({ page }) => {
  await signInAs(page, 'care_coordinator');
  const response = await page.goto('/sequences');
  expect(response?.status()).toBe(403);
  await expect(page.getByRole('heading', { name: 'This screen is not part of your role' })).toBeVisible();
  await expect(page.getByText('New lead welcome')).toHaveCount(0);
});

test('never shows a doctor another doctor’s lead, even by URL', async ({ page }) => {
  const me = DEMO_USERS.find((u) => u.role === 'specialist_doctor')!;
  const [lead] = await query(
    (sql) => sql<{ id: string }[]>`
      select l.id from public.leads l join public.staff s on s.id = l.assigned_staff_id
      where l.industry = 'clinic' and s.role = 'specialist_doctor' and s.id <> ${me.staffId} limit 1`,
  );
  await signInAs(page, 'specialist_doctor');
  await page.goto(`/leads/${lead!.id}`);
  await expect(page.getByRole('heading', { name: 'This lead is not available to you' })).toBeVisible();
});

test('signs in with a password, rejects a wrong one, and signs out', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('neha.joshi@healwyn.example');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('do not match');

  await page.getByLabel('Password').fill(process.env.DEMO_USER_PASSWORD ?? 'demo-pass-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole('heading', { name: /Good to see you, Neha/ })).toBeVisible();

  await openMenuIfCollapsed(page);
  await page.getByRole('button', { name: 'Sign out' }).locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/workspace');
  await expect(page).toHaveURL(/\/login$/);
});

test('the workspace link counts tasks whose reminder is due', async ({ page }) => {
  const coordinator = DEMO_USERS.find((u) => u.role === 'care_coordinator')!;
  const [row] = await query(
    (sql) => sql<{ n: number }[]>`
    select count(*)::int as n from public.tasks
    where assignee_staff_id = ${coordinator.staffId} and completed_at is null and coalesce(remind_at, due_at) <= now()`,
  );
  expect(row!.n).toBeGreaterThan(0); // the seed includes overdue tasks for coordinators

  await signInAs(page, 'care_coordinator');
  await openMenuIfCollapsed(page);
  await expect(
    page
      .getByRole('link', { name: `My workspace ${row!.n} task${row!.n === 1 ? '' : 's'} due soon or overdue` })
      .locator('visible=true'),
  ).toBeVisible();
});
