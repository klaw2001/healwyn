'use server';

import { isIndustryId } from '@healwyn/core';
import { demoResetSql } from '@healwyn/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
import { DEMO_FLASH_COOKIE } from '@/lib/demo';
import { system } from '@/lib/server/db';
import { packFor } from '@/lib/server/pack';
import { clearSessionCookie, readSession } from '@/lib/server/session';

const demoMode = () => process.env.DEMO_MODE === 'true';

/** Demo bar: switch the CRM to another industry (staff belong to one, so sign in again as one of its demo users). */
export async function switchIndustry(formData: FormData) {
  if (!demoMode()) redirect('/login');
  const industry = formData.get('industry');
  await clearSessionCookie();
  redirect(typeof industry === 'string' && isIndustryId(industry) ? `/login?industry=${industry}` : '/login');
}

/**
 * Demo bar: restores the signed-in staff member's industry to its seeded demo
 * data (and clears rate limits). Real leads are never touched. Needs the owner
 * connection (DATABASE_URL); demo mode only.
 */
export async function resetDemo() {
  const session = await readSession();
  if (!demoMode() || !session) redirect('/login');
  const [allowed] = await system()<{ ok: boolean }[]>`
    select public.hit_rate_limit(${`demo-reset:${session.staffId}`}, 3, 600) as ok`;
  const store = await cookies();
  if (!allowed?.ok) {
    store.set(DEMO_FLASH_COOKIE, 'busy', { path: '/', maxAge: 15, httpOnly: true, sameSite: 'lax' });
    redirect('/workspace');
  }
  const url = process.env.DATABASE_URL;
  let outcome = 'reset';
  if (!url) {
    outcome = 'unavailable';
  } else {
    const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
    try {
      const script = await demoResetSql(packFor(session), {
        demoPassword: process.env.DEMO_USER_PASSWORD || undefined,
        siteUrl: process.env.SITE_URL,
      });
      await sql.begin((tx) => tx.unsafe(script));
      console.info(JSON.stringify({ level: 'info', event: 'demo.reset', industry: session.industry }));
    } catch (error) {
      outcome = 'failed';
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'demo.reset_failed',
          error: error instanceof Error ? error.name : 'unknown',
        }),
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
  store.set(DEMO_FLASH_COOKIE, outcome, { path: '/', maxAge: 15, httpOnly: true, sameSite: 'lax' });
  redirect('/workspace');
}
