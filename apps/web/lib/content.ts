import {
  clinicDemoStaff,
  clinicLocations,
  getActivePack,
  LANGUAGE_NAMES,
  specialtyDetails,
  type Offering,
  type SpecialtyDetail,
} from '@healwyn/core';

export interface SpecialtyView extends SpecialtyDetail {
  name: string;
  summary: string;
}

export function specialtyViews(): SpecialtyView[] {
  const { offerings } = getActivePack();
  return specialtyDetails.flatMap((detail) => {
    const offering = offerings.find((o: Offering) => o.slug === detail.slug);
    return offering ? [{ ...detail, name: offering.name, summary: offering.summary }] : [];
  });
}

export function specialtyView(slug: string): SpecialtyView | undefined {
  return specialtyViews().find((s) => s.slug === slug);
}

export function specialtyName(slug: string): string {
  return getActivePack().offerings.find((o) => o.slug === slug)?.name ?? slug;
}

export const clinicians = clinicDemoStaff.filter((member) => member.clinician);

export function cliniciansFor(slug: string) {
  return clinicians.filter((member) => member.specialties.includes(slug));
}

export function locationsFor(slug: string) {
  return clinicLocations.filter((location) => location.specialties.includes(slug));
}

export function locationName(id: string): string {
  const location = clinicLocations.find((l) => l.id === id);
  return location ? `${location.name}, ${location.city}` : id;
}

export function languageList(codes: readonly string[]): string {
  return codes.map((code) => LANGUAGE_NAMES[code] ?? code).join(', ');
}
