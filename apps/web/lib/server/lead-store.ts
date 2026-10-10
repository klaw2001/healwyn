import 'server-only';
import { createLeadStore, type LeadStore } from '@healwyn/db';

const cache = globalThis as unknown as { __healwynLeadStore?: LeadStore };

/** One store per server process (survives dev hot reloads). */
export function getLeadStore(): LeadStore {
  cache.__healwynLeadStore ??= createLeadStore(process.env);
  return cache.__healwynLeadStore;
}
