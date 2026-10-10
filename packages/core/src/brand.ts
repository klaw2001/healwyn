/**
 * The single source of brand values. Renaming the brand is a one-line change to
 * BRAND_NAME (plus the tagline if it should change too). Never hardcode the brand
 * name anywhere else: import BRAND instead.
 */
export const BRAND_NAME = 'Healwyn Clinics';
export const BRAND_TAGLINE = 'The right doctor, from the first call.';

const shortName = BRAND_NAME.split(' ')[0] ?? BRAND_NAME;
const slug = shortName.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const BRAND = {
  name: BRAND_NAME,
  shortName,
  slug,
  tagline: BRAND_TAGLINE,
  /** Placeholder addresses. `.example` is reserved (RFC 2606), so these never reach a real inbox. */
  contactEmail: `hello@${slug}.example`,
  privacyEmail: `privacy@${slug}.example`,
  partnersEmail: `partners@${slug}.example`,
  country: 'India',
  timeZone: 'Asia/Kolkata',
  demoNotice: 'Demo brand, all content fictional',
  demoDisclaimer: `${BRAND_NAME} is a fictional clinic brand built to demonstrate a lead-to-doctor platform. Every clinic, doctor, package, partner and enquiry shown here is synthetic. Nothing on this site is medical advice.`,
  emergencyNotice:
    'If this is an emergency, call your local emergency number or go to the nearest hospital. This form is not for urgent care.',
  noAdviceNotice:
    'This site does not give medical advice. Only a doctor who has examined you can advise on your health.',
} as const;

export type Brand = typeof BRAND;
