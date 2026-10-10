import { buildIntakeSchema, clinicPack, intakeToLeadPayload, type NewLeadPayload } from '@healwyn/core';
import postgres from 'postgres';
import { inject } from 'vitest';

export const databaseUrl = inject('databaseUrl');

export function connect() {
  if (!databaseUrl) throw new Error('No test database');
  return postgres(databaseUrl, { max: 2, onnotice: () => {} });
}

let counter = 0;

/** A valid payload built through the real schema, with a unique demo phone number. */
export async function samplePayload(overrides: Record<string, unknown> = {}): Promise<NewLeadPayload> {
  counter += 1;
  const submission = buildIntakeSchema(clinicPack).parse({
    full_name: 'Test Person',
    phone: `+91 70000 ${String(10000 + ((process.pid + counter) % 90000)).padStart(5, '0')}`,
    email: 'test.person@example.com',
    preferred_language: 'en',
    concern_category: 'dental',
    description: 'Synthetic test enquiry.',
    preferred_time: 'morning',
    visit_type: 'first',
    has_insurance: 'yes',
    consent_contact: 'on',
    consent_assistant_call: 'on',
    ...overrides,
  });
  return intakeToLeadPayload(submission, clinicPack, { isDemo: true });
}

/** Runs fn inside a transaction as a signed-in Supabase user (RLS applies), like PostgREST does. */
export async function asUser<T>(
  sql: ReturnType<typeof postgres>,
  authUserId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: authUserId, role: 'authenticated' })}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
