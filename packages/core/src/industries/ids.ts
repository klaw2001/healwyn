/**
 * The industry pack ids, without the packs themselves, for code that only needs
 * to recognise an id (the website's proxy runs on every request and should not
 * load every pack). `industryPacks` in index.ts must have exactly these keys.
 */
export const INDUSTRY_IDS = ['clinic', 'real_estate', 'wealth_advisory', 'home_interiors'] as const;
export type KnownIndustryId = (typeof INDUSTRY_IDS)[number];

export function isKnownIndustryId(value: unknown): value is KnownIndustryId {
  return typeof value === 'string' && (INDUSTRY_IDS as readonly string[]).includes(value);
}
