import { clinicPack } from '@healwyn/core';
import { type Page } from '@playwright/test';
import postgres from 'postgres';

export const databaseUrl = process.env.E2E_DB || '';

export const group = (page: Page, name: RegExp | string) => page.getByRole('radiogroup', { name });

export async function fillValid(page: Page, phone: string) {
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

/** Every page of the default (clinic) site; the demo-bar suite covers the other packs. */
export const ROUTES = [
  '/',
  '/services',
  ...clinicPack.offerings.map((offering) => `/services/${offering.slug}`),
  '/team',
  '/plans',
  '/locations',
  '/partners',
  '/contact',
  '/privacy',
  '/terms',
  '/disclaimer',
];

/** A fresh client IP per test, so the per-IP rate limit does not leak between tests. */
export function uniqueIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

export async function useClientIp(page: Page, ip = uniqueIp()) {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip });
  return ip;
}

/** A unique demo-range mobile number (+91 70000 xxxxx). */
export function demoPhone(): string {
  return `70000 ${String(Math.floor(Math.random() * 90000) + 10000)}`;
}

export function db() {
  return postgres(databaseUrl, { max: 1, onnotice: () => {} });
}

/** Finds a lead by the reference shown to the person (last 8 hex digits of its id). */
export async function findLeadByReference(reference: string) {
  const sql = db();
  try {
    const suffix = reference.replace('-', '').toLowerCase();
    const leads = await sql`
      select * from public.leads where replace(id::text, '-', '') like ${'%' + suffix} and created_at > now() - interval '1 hour'`;
    const lead = leads[0];
    if (!lead) return null;
    const consents = await sql`
      select purpose, granted, text_version, text_hash from public.consent_records where lead_id = ${lead.id} order by purpose`;
    const events = await sql`select type from public.lead_events where lead_id = ${lead.id} order by id`;
    return { lead, consents, events };
  } finally {
    await sql.end();
  }
}

export async function countLeadsWithPhone(e164: string): Promise<number> {
  const sql = db();
  try {
    const [row] = await sql`select count(*)::int as n from public.leads where phone = ${e164}`;
    return row?.n ?? 0;
  } finally {
    await sql.end();
  }
}
