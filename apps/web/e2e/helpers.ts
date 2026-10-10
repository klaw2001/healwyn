import { type Page } from '@playwright/test';
import postgres from 'postgres';

export const databaseUrl = process.env.E2E_DB || '';

export const ROUTES = [
  '/',
  '/specialties',
  '/specialties/general-medicine',
  '/specialties/dermatology',
  '/specialties/dental',
  '/specialties/physiotherapy',
  '/specialties/womens-health',
  '/specialties/diagnostics',
  '/doctors',
  '/health-packages',
  '/locations',
  '/partners',
  '/contact',
  '/privacy',
  '/terms',
  '/disclaimer',
] as const;

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

/** Finds a lead by the reference shown to the person (first 8 hex digits of its id). */
export async function findLeadByReference(reference: string) {
  const sql = db();
  try {
    const prefix = reference.replace('-', '').toLowerCase();
    const leads = await sql`
      select * from public.leads where replace(id::text, '-', '') like ${prefix + '%'}`;
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
