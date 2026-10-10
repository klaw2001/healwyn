import { createMemoryLeadStore } from './stores/memory';
import { createPostgresLeadStore } from './stores/postgres';
import { createSupabaseLeadStore } from './stores/supabase';
import type { LeadStore, LeadStoreKind } from './stores/types';
import { createUnconfiguredLeadStore } from './stores/unconfigured';

export { createMemoryLeadStore, type MemoryLeadStore } from './stores/memory';
export { createPostgresLeadStore } from './stores/postgres';
export { createSupabaseLeadStore } from './stores/supabase';
export { LeadStoreError, type LeadStore, type LeadStoreKind } from './stores/types';
export type { Database, Json } from './database.types';

export interface LeadStoreEnv {
  [key: string]: string | undefined;
  /** auto (default) | supabase | postgres | memory */
  LEAD_STORE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Least-privilege connection for the website (a login role in web_submitter). Preferred over DATABASE_URL. */
  WEB_DATABASE_URL?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
}

/**
 * Which store `auto` picks: Supabase (HTTPS, service role) when its key is
 * set, else Postgres (WEB_DATABASE_URL, falling back to DATABASE_URL), else
 * memory outside production.
 */
export function resolveLeadStoreKind(env: LeadStoreEnv): LeadStoreKind {
  const requested = (env.LEAD_STORE ?? 'auto').trim().toLowerCase();
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const hasPostgres = Boolean(env.WEB_DATABASE_URL || env.DATABASE_URL);
  const isProduction = env.NODE_ENV === 'production';

  switch (requested) {
    case 'supabase':
      return hasSupabase ? 'supabase' : 'unconfigured';
    case 'postgres':
      return hasPostgres ? 'postgres' : 'unconfigured';
    case 'memory':
      return 'memory';
    case 'auto':
      if (hasSupabase) return 'supabase';
      if (hasPostgres) return 'postgres';
      return isProduction ? 'unconfigured' : 'memory';
    default:
      throw new Error(`Unknown LEAD_STORE "${requested}". Use auto, supabase, postgres or memory.`);
  }
}

export function createLeadStore(env: LeadStoreEnv = process.env): LeadStore {
  switch (resolveLeadStoreKind(env)) {
    case 'supabase':
      return createSupabaseLeadStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
    case 'postgres':
      return createPostgresLeadStore((env.WEB_DATABASE_URL || env.DATABASE_URL)!);
    case 'memory':
      return createMemoryLeadStore();
    case 'unconfigured':
      return createUnconfiguredLeadStore();
  }
}
