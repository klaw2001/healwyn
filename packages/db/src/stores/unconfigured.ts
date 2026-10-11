import { LeadStoreError, type LeadStore } from './types';

/** Used in production when no database is configured: every call fails safely. */
export function createUnconfiguredLeadStore(): LeadStore {
  const fail = async (): Promise<never> => {
    throw new LeadStoreError(
      'No lead store configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL.',
    );
  };
  return {
    kind: 'unconfigured',
    submitLead: fail,
    hitRateLimit: fail,
    optOut: fail,
    startWebCall: fail,
    async close() {},
  };
}
