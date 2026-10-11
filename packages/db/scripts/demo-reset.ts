/**
 * Restores the demo data of the active industry (INDUSTRY, else the clinic), or
 * of the industry named on the command line, or of every industry with "all".
 * Real leads are never touched.
 *
 *   pnpm demo:reset                 # the active industry
 *   pnpm demo:reset real_estate
 *   pnpm demo:reset all
 */
import { getIndustryPack, industryPacks, isIndustryId, type IndustryPack } from '@healwyn/core';
import { demoResetSql } from '../src/demo-reset';
import { resolveTarget } from '../src/sql-target';

const arg = process.argv.slice(2).find((a) => a !== '--');
const requested = arg ?? process.env.INDUSTRY ?? 'clinic';
if (requested !== 'all' && !isIndustryId(requested)) {
  console.error(`Unknown industry "${requested}". Use one of: ${Object.keys(industryPacks).join(', ')}, or all.`);
  process.exit(1);
}
const packs: IndustryPack[] =
  requested === 'all' ? (Object.values(industryPacks) as IndustryPack[]) : [getIndustryPack(requested)];

const target = resolveTarget();
try {
  for (const pack of packs) {
    console.log(`Resetting ${pack.id} demo data in ${target.label}`);
    await target.transaction(
      await demoResetSql(pack, {
        demoPassword: process.env.DEMO_USER_PASSWORD || undefined,
        siteUrl: process.env.SITE_URL,
      }),
    );
  }
  console.log('Done.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await target.close();
}
