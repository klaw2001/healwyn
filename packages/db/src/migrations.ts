import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlTarget } from './sql-target';

export const MIGRATIONS_DIR = join(import.meta.dirname, '../supabase/migrations');
export const LOCAL_SHIM_PATH = join(import.meta.dirname, '../supabase/local-shim.sql');

export interface Migration {
  version: string;
  name: string;
  sql: string;
}

/** Supabase CLI layout: <version>_<name>.sql, applied in version order. */
export function listMigrations(dir = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file))
    .sort()
    .map((file) => {
      const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
      return { version: version!, name: rest.join('_'), sql: readFileSync(join(dir, file), 'utf8') };
    });
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

/**
 * Applies pending migrations, recording them in the same table the Supabase
 * CLI uses, so `supabase db push` and this runner agree on what is applied.
 */
export async function applyMigrations(
  target: SqlTarget,
  options: { dir?: string; log?: (line: string) => void } = {},
): Promise<string[]> {
  const log = options.log ?? (() => {});
  const roles = await target.query<{ ok: boolean }>(
    "select exists (select 1 from pg_roles where rolname = 'service_role') as ok",
  );
  if (!roles[0]?.ok) {
    throw new Error(
      'This database has no Supabase roles (anon, authenticated, service_role). ' +
        'For local Postgres run `pnpm db:local start`, which applies supabase/local-shim.sql.',
    );
  }

  await target.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);
  const applied = new Set(
    (await target.query<{ version: string }>('select version from supabase_migrations.schema_migrations')).map(
      (row) => row.version,
    ),
  );

  const done: string[] = [];
  for (const migration of listMigrations(options.dir)) {
    if (applied.has(migration.version)) continue;
    log(`applying ${migration.version}_${migration.name}`);
    await target.transaction(
      `${migration.sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name) values (${quote(
        migration.version,
      )}, ${quote(migration.name)});`,
    );
    done.push(migration.version);
  }
  return done;
}
