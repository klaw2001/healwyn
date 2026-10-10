/**
 * Loads synthetic specialties, staff and demo leads. Safe to re-run: demo
 * rows are replaced, real leads are never touched.
 *
 *   DATABASE_URL="$(pnpm -s db:local url)" pnpm db:seed
 */
import { buildSeedSql } from '../src/seed';
import { resolveTarget } from '../src/sql-target';

const target = resolveTarget();
console.log(`Seeding ${target.label}`);
try {
  await target.transaction(
    await buildSeedSql({ demoPassword: process.env.DEMO_USER_PASSWORD || undefined, siteUrl: process.env.SITE_URL }),
  );
  const [counts] = await target.query<{ staff: number; leads: number; pending: number }>(
    'select (select count(*)::int from public.staff) as staff, (select count(*)::int from public.leads where is_demo) as leads, (select count(*)::int from public.scheduled_messages where status = $$pending$$) as pending',
  );
  console.log(
    `Done: ${counts?.staff} staff, ${counts?.leads} demo leads, ${counts?.pending} scheduled messages pending.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await target.close();
}
