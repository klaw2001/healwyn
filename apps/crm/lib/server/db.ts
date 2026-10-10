import 'server-only';
import postgres from 'postgres';
import type { Session } from './session';

/**
 * The CRM's database connection. Use CRM_DATABASE_URL for a login role in
 * crm_server that is also a member of `authenticated` (see README); locally
 * DATABASE_URL (the owner) works too.
 */
function connectionUrl(): string {
  const url = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set CRM_DATABASE_URL (or DATABASE_URL) for the CRM.');
  return url;
}

function ssl(url: string): false | 'require' {
  const host = new URL(url).hostname;
  return ['localhost', '127.0.0.1', '::1'].includes(host) ? false : 'require';
}

const cache = globalThis as unknown as { __healwynCrmSql?: postgres.Sql };

export function db(): postgres.Sql {
  if (!cache.__healwynCrmSql) {
    const url = connectionUrl();
    cache.__healwynCrmSql = postgres(url, {
      max: 5,
      prepare: false,
      ssl: ssl(url),
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
      connection: { application_name: 'healwyn-crm' },
    });
  }
  return cache.__healwynCrmSql;
}

export type Tx = postgres.TransactionSql;

/**
 * Runs queries as the signed-in staff member, exactly as Supabase's API would:
 * role `authenticated` with the user's JWT claims, so row level security
 * decides what they can see and the CRM functions know who is acting.
 */
export async function asStaff<T>(session: Pick<Session, 'userId'>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: session.userId, role: 'authenticated' })}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

/** System operations (sign-in lookup, webhooks, the worker) with the server's own rights. */
export function system(): postgres.Sql {
  return db();
}
