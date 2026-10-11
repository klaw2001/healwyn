/**
 * The single source of brand values: one fictional brand per industry pack.
 * Renaming a brand is a one-line change here. Never hardcode a brand name
 * anywhere else: read `pack.brand` (or BRAND, the default clinic brand).
 * A test fails if a capitalised brand name appears in any other source file.
 */

export interface Brand {
  readonly name: string;
  readonly shortName: string;
  /** Lowercase, for placeholder email domains (`.example`). */
  readonly slug: string;
  readonly tagline: string;
  /** The phrase in the tagline the home page underlines. */
  readonly taglineHighlight: string;
  /** Placeholder addresses. `.example` is reserved (RFC 2606), so these never reach a real inbox. */
  readonly contactEmail: string;
  readonly privacyEmail: string;
  readonly partnersEmail: string;
  readonly country: string;
  readonly timeZone: string;
  readonly demoNotice: string;
  readonly demoDisclaimer: string;
  /** Shown in the footer and on form pages: what to do in an emergency, or when this is not the right place. */
  readonly emergencyNotice: string;
  /** What this brand never does (medical, investment or legal advice). */
  readonly noAdviceNotice: string;
  /** A regulatory-style disclaimer shown on every page, for regulated industries. */
  readonly regulatoryNotice: string | null;
}

function makeBrand(fields: {
  name: string;
  tagline: string;
  taglineHighlight: string;
  what: string;
  /** Who an enquiry is matched with. */
  expert: string;
  emergencyNotice: string;
  noAdviceNotice: string;
  regulatoryNotice?: string;
}): Brand {
  const shortName = fields.name.split(' ')[0] ?? fields.name;
  const slug = shortName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return {
    name: fields.name,
    shortName,
    slug,
    tagline: fields.tagline,
    taglineHighlight: fields.taglineHighlight,
    contactEmail: `hello@${slug}.example`,
    privacyEmail: `privacy@${slug}.example`,
    partnersEmail: `partners@${slug}.example`,
    country: 'India',
    timeZone: 'Asia/Kolkata',
    demoNotice: 'Demo brand, all content fictional',
    demoDisclaimer: `${fields.name} is a fictional ${fields.what}, built to show how an enquiry reaches the right ${fields.expert}. Every person, place, offer, partner and enquiry shown here is synthetic. ${fields.noAdviceNotice}`,
    emergencyNotice: fields.emergencyNotice,
    noAdviceNotice: fields.noAdviceNotice,
    regulatoryNotice: fields.regulatoryNotice ?? null,
  };
}

export const BRANDS = {
  clinic: makeBrand({
    name: 'Healwyn Clinics',
    tagline: 'The right doctor, from the first call.',
    taglineHighlight: 'right doctor',
    what: 'multi-specialty clinic brand',
    expert: 'doctor',
    emergencyNotice:
      'If this is an emergency, call your local emergency number or go to the nearest hospital. This form is not for urgent care.',
    noAdviceNotice:
      'This site does not give medical advice. Only a doctor who has examined you can advise on your health.',
  }),
  real_estate: makeBrand({
    name: 'Nestwyn Realty',
    tagline: 'The right home, from the first call.',
    taglineHighlight: 'right home',
    what: 'residential real estate brand',
    expert: 'property advisor',
    emergencyNotice:
      'If you are in danger or a building is unsafe, leave and call 112. This form is for property enquiries only.',
    noAdviceNotice:
      'This site does not give legal, tax or financial advice. Check every property, title and loan with a qualified professional.',
    regulatoryNotice:
      'Fictional developer and projects: not registered with any real estate regulatory authority. No real project, price or registration number is shown.',
  }),
  wealth_advisory: makeBrand({
    name: 'Ledgerwyn Wealth',
    tagline: 'The right advisor, from the first call.',
    taglineHighlight: 'right advisor',
    what: 'wealth advisory brand',
    expert: 'advisor',
    emergencyNotice:
      'If someone is pressing you to pay, share an OTP or move money right now, stop and call your bank. This form is not for urgent help.',
    noAdviceNotice:
      'This site does not give investment, tax or legal advice. Only a registered advisor who knows your situation can advise you.',
    regulatoryNotice:
      'Fictional firm: not registered with SEBI, IRDAI, PFRDA or any regulator. No real fund, product or return is shown, and nothing here is an offer.',
  }),
  home_interiors: makeBrand({
    name: 'Loomwyn Interiors',
    tagline: 'The right designer, from the first call.',
    taglineHighlight: 'right designer',
    what: 'home interiors brand',
    expert: 'designer',
    emergencyNotice:
      'If you smell gas, see sparks or smoke, or water is near the wiring, leave the area and call 112. This form is not for emergencies.',
    noAdviceNotice:
      'This site does not give structural, electrical or legal advice. A qualified engineer or electrician must check any safety concern.',
  }),
} as const satisfies Record<string, Brand>;

export type BrandId = keyof typeof BRANDS;

/** The default (clinic) brand, for code that has no pack in hand. */
export const BRAND: Brand = BRANDS.clinic;
export const BRAND_NAME = BRAND.name;
export const BRAND_TAGLINE = BRAND.tagline;
