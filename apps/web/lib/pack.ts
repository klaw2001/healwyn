import { getIndustryPack, industryPacks, isIndustryId, type IndustryPack } from '@healwyn/core';
import { notFound } from 'next/navigation';

/**
 * Every public page lives under app/[industry]/. The proxy (proxy.ts) rewrites
 * each request to the industry it should show, so URLs stay clean (/contact)
 * while each industry's pages are generated statically.
 */
export type IndustryParams = { industry: string };

export function industryParams(): IndustryParams[] {
  return Object.keys(industryPacks).map((industry) => ({ industry }));
}

export function packFor(industry: string): IndustryPack {
  if (!isIndustryId(industry)) notFound();
  return getIndustryPack(industry);
}

export async function pagePack(props: { params: Promise<IndustryParams> }): Promise<IndustryPack> {
  return packFor((await props.params).industry);
}

/** The pack a form or API request names (a hidden field or JSON property), or null. */
export function packFromValue(value: unknown): IndustryPack | null {
  return typeof value === 'string' && isIndustryId(value) ? getIndustryPack(value) : null;
}
