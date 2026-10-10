import { describe, expect, it } from 'vitest';
import {
  clinicDemoLeads,
  clinicDemoStaff,
  clinicLocations,
  clinicPack,
  formQuestions,
  getActivePack,
  getIndustryPack,
  getOfferingQuestion,
  healthPackages,
  industryPacks,
  partnerAudiences,
  specialtyDetails,
  type IndustryPack,
} from '../src';

const unique = (values: readonly string[]) => new Set(values).size === values.length;

describe.each(Object.values(industryPacks) as IndustryPack[])('industry pack $id', (pack) => {
  it('has unique ids everywhere', () => {
    expect(unique(pack.stages.map((s) => s.id))).toBe(true);
    expect(unique(pack.staffLevels.map((l) => l.id))).toBe(true);
    expect(unique(pack.sequences.map((s) => s.id))).toBe(true);
    expect(unique(pack.offerings.map((o) => o.slug))).toBe(true);
    expect(unique(pack.intake.questions.map((q) => q.id))).toBe(true);
    expect(unique([...pack.intake.consents, ...pack.partnerIntake.consents].map((c) => c.id))).toBe(true);
  });

  it('has a valid initial stage and sequences that enrol on real stages', () => {
    const stageIds = pack.stages.map((s) => s.id);
    expect(stageIds).toContain(pack.initialStageId);
    for (const sequence of pack.sequences) {
      if (sequence.enrolOnStage) expect(stageIds).toContain(sequence.enrolOnStage);
    }
    expect(pack.stages.some((s) => s.kind === 'won')).toBe(true);
    expect(pack.stages.some((s) => s.kind === 'lost')).toBe(true);
  });

  it('maps every offering-question option to an offering or the unsure value', () => {
    const offeringSlugs = pack.offerings.map((o) => o.slug);
    for (const option of getOfferingQuestion(pack).options) {
      expect([...offeringSlugs, pack.intake.offeringUnsureValue]).toContain(option.value);
    }
  });

  it('has a free-text message question shown on the form', () => {
    const message = pack.intake.questions.find((q) => q.id === pack.intake.messageQuestionId);
    expect(message?.kind === 'text' || message?.kind === 'textarea').toBe(true);
    expect(formQuestions(pack).map((q) => q.id)).toContain(pack.intake.messageQuestionId);
  });

  it('requires at least one consent, and only that one, to submit', () => {
    expect(pack.intake.consents.filter((c) => c.required)).toHaveLength(1);
    expect(pack.partnerIntake.consents.filter((c) => c.required)).toHaveLength(1);
    for (const consent of [...pack.intake.consents, ...pack.partnerIntake.consents]) {
      expect(consent.text).toContain('{brand}');
      expect(consent.text).toMatch(/withdraw/i);
    }
  });

  it('offers English and Hindi', () => {
    expect(pack.languages.map((l) => l.code)).toEqual(['en', 'hi']);
  });
});

describe('clinic pack', () => {
  it('is the active pack', () => {
    expect(getActivePack()).toBe(clinicPack);
    expect(getIndustryPack('clinic')).toBe(clinicPack);
    expect(() => getIndustryPack('casino')).toThrow();
  });

  it('defines the required stages, levels and sequences in order', () => {
    expect(clinicPack.stages.map((s) => s.label)).toEqual([
      'New',
      'AI-triaged',
      'Appointment booked',
      'Visited',
      'Follow-up due',
      'Package active',
      'Lost',
    ]);
    expect(clinicPack.staffLevels.map((l) => l.id).sort()).toEqual(
      ['billing_desk', 'care_coordinator', 'clinic_manager', 'senior_consultant', 'specialist_doctor'].sort(),
    );
    expect(clinicPack.sequences.map((s) => s.id)).toEqual([
      'new-lead-welcome',
      'appointment-reminder',
      'no-show-recovery',
      'post-visit-check-in',
      'follow-up-due',
      'package-renewal',
    ]);
  });

  it('asks four to six qualifying questions on the voice channel', () => {
    const voice = clinicPack.intake.questions.filter((q) => q.channels.includes('voice'));
    expect(voice.length).toBeGreaterThanOrEqual(4);
    expect(voice.length).toBeLessThanOrEqual(6);
  });
});

describe('clinic content and demo data', () => {
  const slugs = clinicPack.offerings.map((o) => o.slug);
  const levels = clinicPack.staffLevels.map((l) => l.id);
  const stages = clinicPack.stages.map((s) => s.id);
  const locationIds = clinicLocations.map((l) => l.id);

  it('has a detail page for every specialty', () => {
    expect(specialtyDetails.map((d) => d.slug).sort()).toEqual([...slugs].sort());
  });

  it('references only real specialties, levels, locations and partner types', () => {
    for (const pkg of healthPackages) expect(slugs).toContain(pkg.specialtySlug);
    for (const location of clinicLocations) for (const s of location.specialties) expect(slugs).toContain(s);
    for (const audience of partnerAudiences) {
      expect(clinicPack.partnerIntake.partnerTypes.map((t) => t.value)).toContain(audience.type);
    }
    for (const member of clinicDemoStaff) {
      expect(levels).toContain(member.level);
      for (const s of member.specialties) expect(slugs).toContain(s);
      for (const l of member.locations) expect(locationIds).toContain(l);
    }
  });

  it('has 6 to 8 clinicians covering every specialty', () => {
    const clinicians = clinicDemoStaff.filter((m) => m.clinician);
    expect(clinicians.length).toBeGreaterThanOrEqual(6);
    expect(clinicians.length).toBeLessThanOrEqual(8);
    for (const slug of slugs) expect(clinicians.some((c) => c.specialties.includes(slug))).toBe(true);
  });

  it('has exactly four health packages and two locations', () => {
    expect(healthPackages).toHaveLength(4);
    expect(clinicLocations).toHaveLength(2);
  });

  it('uses only demo-range phone numbers and valid stages for demo leads', () => {
    const staffIds = clinicDemoStaff.map((m) => m.id);
    for (const lead of clinicDemoLeads) {
      expect(lead.phone).toMatch(/^\+9170000\d{5}$/);
      expect(stages).toContain(lead.stage);
      if (lead.assignedStaffId) expect(staffIds).toContain(lead.assignedStaffId);
      for (const stage of lead.stageHistory) expect(stages).toContain(stage);
      expect(lead.stageHistory.at(-1) ?? 'new').toBe(lead.stage);
    }
  });

  it('labels every clinic address as fictional', () => {
    for (const location of clinicLocations) expect(location.addressLines.join(' ')).toMatch(/fictional/);
  });
});
