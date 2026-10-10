/**
 * Applies pending migrations in supabase/migrations.
 *
 *   pnpm db:migrate                                    uses DATABASE_URL from .env
 *   DATABASE_URL="$(pnpm -s db:local url)" pnpm db:migrate
 *   SUPABASE_ACCESS_TOKEN=sbp_... pnpm db:migrate      over HTTPS (no DATABASE_URL set)
 */
import { applyMigrations } from '../src/migrations';
import { resolveTarget } from '../src/sql-target';

const target = resolveTarget();
console.log(`Migrating ${target.label}`);
try {
  const applied = await applyMigrations(target, { log: (line) => console.log(`  ${line}`) });
  console.log(applied.length ? `Applied ${applied.length} migration(s).` : 'Already up to date.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await target.close();
}
