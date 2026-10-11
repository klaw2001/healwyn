import 'server-only';
import { getActivePack, getIndustryPack, isIndustryId, type IndustryPack } from '@healwyn/core';
import type { Session } from './session';

/** The CRM shows the signed-in staff member's industry. */
export function packFor(session: Pick<Session, 'industry'>): IndustryPack {
  return isIndustryId(session.industry) ? getIndustryPack(session.industry) : getActivePack();
}

/** Code acting on a lead (the voice webhook, the worker) uses that lead's own pack. */
export function packOf(industry: string): IndustryPack {
  return isIndustryId(industry) ? getIndustryPack(industry) : getActivePack();
}
