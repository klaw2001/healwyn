import { formQuestions, formatRupees, industryPacks, type IndustryPack } from '@healwyn/core';
import { expect, test, type Page } from '@playwright/test';
import { query, requireDb, uniqueName, uniquePhone, WEB_URL } from './helpers';

/**
 * The whole journey once per industry pack: the website (re-skinned by the demo
 * bar's cookie), the enquiry form, a simulated assistant call, routing, the
 * CRM, a booking on the person's own link, and a test payment that moves the
 * lead to the pack's won stage.
 */

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const packs = Object.values(industryPacks) as IndustryPack[];

test.beforeEach(({ browserName: _ }, testInfo) => {
  requireDb();
  test.skip(
    testInfo.project.name !== 'laptop',
    'One run per industry is enough; the steps are covered on tablet elsewhere.',
  );
});

async function sendEnquiry(page: Page, pack: IndustryPack, name: string) {
  await page.context().addCookies([{ name: 'hw_industry', value: pack.id, url: WEB_URL }]);
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 250)}.9` });
  await page.goto(`${WEB_URL}/contact`);
  await expect(page.getByRole('contentinfo')).toContainText(pack.brand.name);

  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Mobile number').fill(uniquePhone());
  await page
    .getByRole('radiogroup', { name: /which language/i })
    .getByRole('radio', { name: /English/ })
    .check();
  for (const question of formQuestions(pack)) {
    const label = new RegExp(`^${escape(question.label)}`);
    if (question.kind === 'select') {
      const option = question.options.find((o) => o.value !== pack.intake.offeringUnsureValue) ?? question.options[0]!;
      await page.getByLabel(label).selectOption(option.value);
    } else if (question.kind === 'radio') {
      await page.getByRole('radiogroup', { name: label }).getByRole('radio').first().check();
    } else {
      await page.getByLabel(label).fill('Synthetic journey test.');
    }
  }
  await page.getByRole('checkbox', { name: /store and use the details/ }).check();
  await page.getByRole('checkbox', { name: /AI assistant between 9am/ }).check();
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  const booking = page.getByRole('link', { name: `Choose a time for your ${pack.booking.noun}` });
  await expect(booking).toBeVisible();
  await page.context().setExtraHTTPHeaders({});
  const href = (await booking.getAttribute('href'))!;
  return { bookingPath: href, leadId: new URL(href, WEB_URL).searchParams.get('t')!.split('.')[0]! };
}

for (const pack of packs) {
  test(`${pack.brand.name}: site, form, assistant, routing, CRM, booking and test payment`, async ({ page }) => {
    test.setTimeout(120_000);
    const name = uniqueName('Journey');
    const { bookingPath, leadId } = await sendEnquiry(page, pack, name);

    // The front desk of this industry signs in and runs a simulated assistant call.
    await page.goto(`/login?industry=${pack.id}`);
    await page.getByRole('button', { name: new RegExp(`^${escape(pack.roleLabels.care_coordinator)}`) }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto(`/leads/${leadId}`);
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Simulated assistant call' }).click();
    await expect(page.getByRole('status', { name: 'Notification' })).toContainText(
      'Simulated call finished: completed.',
    );
    await expect(page.getByRole('region', { name: 'AI summary' })).toContainText('Qualified');

    const [triaged] = await query(
      (sql) => sql<{ stage: string; assigned_staff_id: string | null; industry: string }[]>`
        select stage, assigned_staff_id, industry from public.leads where id = ${leadId}`,
    );
    expect(triaged).toMatchObject({ stage: pack.voice.triagedStageId, industry: pack.id });
    expect(triaged!.assigned_staff_id, 'routed to someone').not.toBeNull();

    // The person books a slot with the routed expert from their own link.
    await page.goto(`${WEB_URL}${bookingPath}`);
    await expect(page.getByRole('contentinfo')).toContainText(pack.brand.name);
    await page
      .getByRole('radiogroup', { name: /Times on/ })
      .getByRole('radio')
      .first()
      .check();
    await page.getByRole('button', { name: `Book this ${pack.booking.noun}` }).click();
    await expect(page.getByRole('main').getByRole('status')).toContainText(`Your ${pack.booking.noun} is booked.`);

    // …and pays a test fee.
    const product = pack.payments.products[0]!;
    await page.getByRole('link', { name: 'Pay online (test payment)' }).click();
    await page.getByRole('radio', { name: new RegExp(escape(product.name)) }).check();
    await page.getByRole('button', { name: 'Continue to test payment' }).click();
    await page.getByRole('button', { name: `Pay ${formatRupees(product.amountPaise)} (test payment)` }).click();
    await expect(page.getByRole('main').getByRole('status')).toContainText('Test payment received');

    // Back in the CRM: the won stage, the booking and the payment are on the lead.
    await page.goto(`/leads/${leadId}`);
    const wonLabel = pack.stages.find((s) => s.id === pack.payments.paidStageId)!.label;
    await expect(page.getByRole('main').getByText(wonLabel, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Test payment received', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/^Booked with /).first()).toBeVisible();
    const [done] = await query(
      (sql) => sql<{ stage: string; appointments: number; paid: number }[]>`
        select l.stage,
               (select count(*)::int from public.appointments a where a.lead_id = l.id and a.status = 'booked') as appointments,
               (select count(*)::int from public.payments p where p.lead_id = l.id and p.status = 'paid') as paid
        from public.leads l where l.id = ${leadId}`,
    );
    expect(done).toEqual({ stage: pack.payments.paidStageId, appointments: 1, paid: 1 });
  });
}
