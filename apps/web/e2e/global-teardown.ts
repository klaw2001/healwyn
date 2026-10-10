import postgres from 'postgres';

/** Removes the leads this run created, so a local demo database stays tidy. */
export default async function globalTeardown() {
  const url = process.env.E2E_DB;
  const startedAt = process.env.E2E_STARTED_AT;
  if (!url || !startedAt) return;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`delete from public.leads where not is_demo and phone like '+9170000%' and created_at >= ${startedAt}`;
  } finally {
    await sql.end();
  }
}
