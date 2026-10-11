import type { IndustryPack } from '@healwyn/core';
import { buildSeedSql } from './seed';

/**
 * Restores one industry's demo data: its seeded staff, calendars and 40 demo
 * leads, and removes every other demo lead of that industry (enquiries sent
 * while DEMO_MODE=true are demo data too). Real leads are never touched. Also
 * clears the rate-limit counters, which demos trip quickly.
 *
 * Returns the SQL for one transaction; run it with an owner connection.
 */
export async function demoResetSql(
  pack: IndustryPack,
  options: { demoPassword?: string; siteUrl?: string; now?: Date } = {},
): Promise<string> {
  return [await buildSeedSql({ packs: [pack], ...options }), 'delete from public.rate_limits;'].join('\n');
}
