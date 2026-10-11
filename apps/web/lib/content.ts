import { LANGUAGE_NAMES, type IndustryPack, type OfferingDetail } from '@healwyn/core';

export interface OfferingView extends OfferingDetail {
  name: string;
  summary: string;
}

/** Each offering's page content, in the pack's offering order. */
export function offeringViews(pack: IndustryPack): OfferingView[] {
  return pack.offerings.flatMap((offering) => {
    const detail = pack.site.services.details.find((d) => d.slug === offering.slug);
    return detail ? [{ ...detail, name: offering.name, summary: offering.summary }] : [];
  });
}

export function offeringView(pack: IndustryPack, slug: string): OfferingView | undefined {
  return offeringViews(pack).find((o) => o.slug === slug);
}

export function offeringName(pack: IndustryPack, slug: string): string {
  return pack.offerings.find((o) => o.slug === slug)?.name ?? slug;
}

/** The people on the public team page. */
export function listedStaff(pack: IndustryPack) {
  return pack.demo.staff.filter((member) => member.listed);
}

export function staffFor(pack: IndustryPack, slug: string) {
  return listedStaff(pack).filter((member) => member.specialties.includes(slug));
}

export function locationsFor(pack: IndustryPack, slug: string) {
  return pack.site.locations.items.filter((location) => location.offerings.includes(slug));
}

export function locationName(pack: IndustryPack, id: string): string {
  const location = pack.site.locations.items.find((l) => l.id === id);
  return location ? `${location.name}, ${location.city}` : id;
}

export function languageList(codes: readonly string[]): string {
  return codes.map((code) => LANGUAGE_NAMES[code] ?? code).join(', ');
}
