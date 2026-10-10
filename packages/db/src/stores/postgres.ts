import type { NewLeadPayload } from '@healwyn/core';
import postgres from 'postgres';
import { sslModeFor } from '../sql-target';
import { LeadStoreError, type LeadStore } from './types';

/**
 * Direct Postgres connection. On serverless hosts use Supabase's transaction
 * pooler (port 6543): prepared statements are disabled for that reason.
 */
export function createPostgresLeadStore(url: string): LeadStore {
  const sql = postgres(url, {
    max: 3,
    prepare: false,
    ssl: sslModeFor(url),
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: 'healwyn-web' },
  });

  return {
    kind: 'postgres',
    async submitLead(payload: NewLeadPayload) {
      try {
        const [row] = await sql<{ id: string }[]>`
          select public.submit_lead(${sql.json(payload as unknown as postgres.JSONValue)}) as id`;
        if (!row) throw new Error('submit_lead returned no row');
        return { id: row.id };
      } catch (error) {
        throw new LeadStoreError('Could not store the lead', { cause: error });
      }
    },
    async hitRateLimit(key, limit, windowSeconds) {
      try {
        const [row] = await sql<{ allowed: boolean }[]>`
          select public.hit_rate_limit(${key}, ${limit}, ${windowSeconds}) as allowed`;
        return row?.allowed ?? false;
      } catch (error) {
        throw new LeadStoreError('Could not check the rate limit', { cause: error });
      }
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
