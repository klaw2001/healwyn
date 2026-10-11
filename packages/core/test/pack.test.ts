import { describe, expect, it } from 'vitest';
import {
  BRANDS,
  buildVoiceScript,
  callPolicies,
  clinicPack,
  demoUsers,
  formQuestions,
  getActivePack,
  getIndustryPack,
  getOfferingQuestion,
  industryPacks,
  STAFF_ROLES,
  type IndustryPack,
} from '../src';

const unique = (values: readonly string[]) => new Set(values).size === values.length;
const packs = Object.values(industryPacks) as IndustryPack[];
/** Each pack's number in its demo ids (5ea1f000-000P-…, 1ead0000-000P-…). */
const PACK_NUMBER: Record<string, number> = { clinic: 0, real_estate: 1, wealth_advisory: 2, home_interiors: 3 };
/** Packs that must show a regulatory-style disclaimer on every page. */
const REGULATED = new Set(['real_estate', 'wealth_advisory']);

/**
 * Every pack must pass these. They are the contract a new industry is built against:
 * structure, references between parts, safety configuration, theme and demo data.
 */
describe.each(packs)('industry pack $id', (pack) => {
  const stageIds = pack.stages.map((s) => s.id);
  const offeringSlugs = pack.offerings.map((o) => o.slug);
  const levelIds = pack.staffLevels.map((l) => l.id);

  it('has unique ids everywhere', () => {
    expect(unique(stageIds)).toBe(true);
    expect(unique(levelIds)).toBe(true);
    expect(unique(pack.sequences.map((s) => s.id))).toBe(true);
    expect(unique(offeringSlugs)).toBe(true);
    expect(unique(pack.intake.questions.map((q) => q.id))).toBe(true);
    expect(unique([...pack.intake.consents, ...pack.partnerIntake.consents].map((c) => c.id))).toBe(true);
    expect(unique(pack.crm.templates.map((t) => t.id))).toBe(true);
    expect(unique(pack.crm.noteTemplates.map((t) => t.id))).toBe(true);
    expect(pack.id).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    for (const slug of offeringSlugs) expect(slug).toMatch(/^[a-z0-9-]{2,40}$/);
  });

  it('has a valid initial stage, won and lost stages, and sequences on real stages and templates', () => {
    expect(stageIds).toContain(pack.initialStageId);
    expect(pack.stages.some((s) => s.kind === 'won')).toBe(true);
    expect(pack.stages.some((s) => s.kind === 'lost')).toBe(true);
    const templateIds = pack.crm.templates.map((t) => t.id);
    for (const sequence of pack.sequences) {
      if (sequence.enrolOnStage) expect(stageIds).toContain(sequence.enrolOnStage);
      for (const stage of sequence.cancelOnStages) expect(stageIds).toContain(stage);
      expect(sequence.steps.length).toBeGreaterThan(0);
      for (const step of sequence.steps) expect(templateIds).toContain(step.templateId);
    }
    expect(pack.sequences.length).toBeGreaterThanOrEqual(4);
  });

  it('maps every offering-question option to an offering or the unsure value', () => {
    for (const option of getOfferingQuestion(pack).options) {
      expect([...offeringSlugs, pack.intake.offeringUnsureValue]).toContain(option.value);
    }
    for (const slug of offeringSlugs) expect(getOfferingQuestion(pack).options.map((o) => o.value)).toContain(slug);
  });

  it('has a free-text message question shown on the form', () => {
    const message = pack.intake.questions.find((q) => q.id === pack.intake.messageQuestionId);
    expect(message?.kind === 'text' || message?.kind === 'textarea').toBe(true);
    expect(formQuestions(pack).map((q) => q.id)).toContain(pack.intake.messageQuestionId);
  });

  it('requires exactly one consent to submit, versioned per pack, with withdrawal explained', () => {
    expect(pack.intake.consents.filter((c) => c.required)).toHaveLength(1);
    expect(pack.partnerIntake.consents.filter((c) => c.required)).toHaveLength(1);
    for (const consent of [...pack.intake.consents, ...pack.partnerIntake.consents]) {
      expect(consent.text).toContain('{brand}');
      expect(consent.text).toMatch(/withdraw/i);
      expect(consent.version.startsWith(pack.id.replaceAll('_', '-'))).toBe(true);
    }
    expect(pack.intake.consents.map((c) => c.id)).toContain(pack.voice.callConsentId);
    const call = pack.intake.consents.find((c) => c.id === pack.voice.callConsentId)!;
    expect(call.required).toBe(false);
    expect(call.text).toMatch(/Gemini/);
  });

  it('offers English and Hindi', () => {
    expect(pack.languages.map((l) => l.code)).toEqual(['en', 'hi']);
  });

  it('has a brand from brand.ts, role labels and, for regulated industries, a regulatory notice', () => {
    expect(Object.values(BRANDS)).toContain(pack.brand);
    expect(Object.keys(pack.roleLabels).sort()).toEqual([...STAFF_ROLES].sort());
    if (REGULATED.has(pack.id)) expect(pack.brand.regulatoryNotice).toBeTruthy();
    expect(pack.brand.tagline).toContain(pack.brand.taglineHighlight);
  });

  it('routes to real roles and levels', () => {
    for (const role of [...pack.routing.specialistRoles, pack.routing.fallbackRole]) {
      expect(STAFF_ROLES).toContain(role);
    }
    if (pack.routing.billingRole) expect(STAFF_ROLES).toContain(pack.routing.billingRole);
    expect(Math.max(...pack.staffLevels.map((l) => l.rank))).toBeGreaterThanOrEqual(pack.routing.urgentMinRank);
    if (pack.billingRule) {
      const question = pack.intake.questions.find((q) => q.id === pack.billingRule!.questionId);
      expect(question && 'options' in question && question.options.map((o) => o.value)).toContain(
        pack.billingRule.equals,
      );
    }
  });

  it('asks four to six voice questions and builds a valid voice script with its safety rules', () => {
    const voice = pack.intake.questions.filter((q) => q.channels.includes('voice'));
    expect(voice.length).toBeGreaterThanOrEqual(4);
    expect(voice.length).toBeLessThanOrEqual(6);
    const script = buildVoiceScript(pack);
    expect(script.packId).toBe(pack.id);
    expect(script.brand).toBe(pack.brand.name);
    expect(stageIds).toContain(pack.voice.triagedStageId);
    expect(voice.map((q) => q.id)).toContain(pack.voice.callback.questionId);
    const { safety } = pack.voice;
    expect(safety.redFlags.length).toBeGreaterThanOrEqual(6);
    expect(unique(safety.redFlags.map((f) => f.id))).toBe(true);
    for (const flag of safety.redFlags) {
      expect(flag.id).toMatch(/^[a-z0-9_]{2,64}$/);
      expect(flag.phrases.en.length).toBeGreaterThan(0);
    }
    expect(safety.redFlags.filter((f) => (f.phrases.hi ?? []).length > 0).length).toBeGreaterThanOrEqual(4);
    expect(safety.adviceRequests.en.length).toBeGreaterThanOrEqual(8);
    expect(safety.adviceCode).toMatch(/^[a-z_]+_advice$/);
    expect(safety.injection.en.length).toBeGreaterThanOrEqual(5);
    expect(pack.voice.staffNotes.redFlag).toContain('{flags}');
    expect(script.greeting.en).toMatch(/\bAI\b/);
    expect(script.greeting.hi).toBeTruthy();
    expect(script.summary.length).toBeGreaterThan(0);
  });

  it('derives call policies for every channel', () => {
    expect(callPolicies(pack).map((p) => p.channel)).toEqual(['browser', 'text', 'phone', 'simulated']);
  });

  it('has site copy for every offering, and plans, locations and partners that reference real things', () => {
    const { site } = pack;
    expect(site.services.details.map((d) => d.slug).sort()).toEqual([...offeringSlugs].sort());
    for (const detail of site.services.details) {
      expect(detail.reasons.length).toBeGreaterThanOrEqual(3);
      expect(detail.firstSteps.length).toBeGreaterThanOrEqual(3);
    }
    expect(site.plans.items.length).toBeGreaterThanOrEqual(3);
    for (const plan of site.plans.items) expect(offeringSlugs).toContain(plan.offeringSlug);
    expect(site.locations.items.length).toBeGreaterThanOrEqual(2);
    for (const location of site.locations.items) {
      for (const slug of location.offerings) expect(offeringSlugs).toContain(slug);
      expect(location.addressLines.join(' ')).toMatch(/fictional/);
    }
    for (const audience of site.partners.audiences) {
      expect(pack.partnerIntake.partnerTypes.map((t) => t.value)).toContain(audience.type);
    }
    expect(site.partners.wordmarks.length).toBeGreaterThanOrEqual(4);
    expect(site.home.howItWorks.steps).toHaveLength(3);
    expect(site.home.trust.points).toHaveLength(3);
    expect(site.home.highlights.length).toBeGreaterThanOrEqual(2);
    expect(site.contact.steps).toHaveLength(3);
  });

  it('books and takes payments through real stages and roles', () => {
    const { booking, payments } = pack;
    for (const stage of [booking.bookedStageId, booking.attendedStageId, booking.noShowStageId, payments.paidStageId]) {
      expect(stageIds).toContain(stage);
    }
    expect(pack.stages.find((s) => s.id === payments.paidStageId)?.kind).toBe('won');
    expect([15, 20, 30, 45, 60]).toContain(booking.slotMinutes);
    for (const role of booking.bookableRoles) expect(STAFF_ROLES).toContain(role);
    expect(booking.defaultHours.start).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(booking.defaultHours.end > booking.defaultHours.start).toBe(true);
    for (const day of booking.defaultHours.weekdays) expect(day).toBeGreaterThanOrEqual(0);
    expect(payments.products.length).toBeGreaterThanOrEqual(1);
    expect(unique(payments.products.map((p) => p.id))).toBe(true);
    for (const product of payments.products) {
      expect(Number.isInteger(product.amountPaise)).toBe(true);
      expect(product.amountPaise).toBeGreaterThanOrEqual(100);
      expect(product.amountPaise).toBeLessThanOrEqual(5_000_000);
    }
  });

  it('has demo staff with pack-numbered ids, one demo login per role, and listed people for every offering', () => {
    const n = PACK_NUMBER[pack.id];
    expect(n).toBeDefined();
    const staff = pack.demo.staff;
    expect(unique(staff.map((m) => m.id))).toBe(true);
    for (const member of staff) {
      expect(member.id.startsWith(`5ea1f000-${String(n).padStart(4, '0')}-`)).toBe(true);
      expect(levelIds).toContain(member.level);
      for (const slug of member.specialties) expect(offeringSlugs).toContain(slug);
      for (const location of member.locations) {
        expect(pack.site.locations.items.map((l) => l.id)).toContain(location);
      }
    }
    expect(demoUsers(staff).map((u) => u.role)).toEqual([...STAFF_ROLES]);
    expect(staff.filter((m) => m.demoLogin)).toHaveLength(STAFF_ROLES.length);
    const listed = staff.filter((m) => m.listed);
    expect(listed.length).toBeGreaterThanOrEqual(6);
    expect(listed.length).toBeLessThanOrEqual(10);
    for (const slug of offeringSlugs) expect(listed.some((m) => m.specialties.includes(slug))).toBe(true);
    for (const role of pack.booking.bookableRoles) expect(staff.some((m) => m.role === role)).toBe(true);
    expect(staff.some((m) => m.role === pack.routing.fallbackRole)).toBe(true);
  });

  it('has 40 demo leads across every stage, with valid answers, staff and demo-range phones', () => {
    const n = PACK_NUMBER[pack.id]!;
    const leads = pack.demo.leads;
    const staffIds = pack.demo.staff.map((m) => m.id);
    expect(leads).toHaveLength(40);
    expect(unique(leads.map((l) => l.id))).toBe(true);
    expect(new Set(leads.map((l) => l.stage))).toEqual(new Set(stageIds));
    for (const lead of leads) {
      expect(lead.id.startsWith(`1ead0000-${String(n).padStart(4, '0')}-`)).toBe(true);
      expect(lead.phone).toMatch(/^\+9170\d{8}$/);
      expect(Number(lead.phone.slice(5)) - 100).toBeGreaterThanOrEqual(n * 1000);
      expect(Number(lead.phone.slice(5)) - 100).toBeLessThan((n + 1) * 1000);
      if (lead.email) expect(lead.email).toMatch(/@example\.com$/);
      expect(stageIds).toContain(lead.stage);
      for (const stage of lead.stageHistory) expect(stageIds).toContain(stage);
      expect(lead.stageHistory.at(-1) ?? pack.initialStageId).toBe(lead.stage);
      if (lead.assignedStaffId) expect(staffIds).toContain(lead.assignedStaffId);
      for (const [id, value] of Object.entries(lead.answers)) {
        const question = pack.intake.questions.find((q) => q.id === id);
        expect(question, id).toBeDefined();
        if (question && 'options' in question) expect(question.options.map((o) => o.value)).toContain(value);
      }
      for (const note of lead.notes) expect(pack.crm.noteTemplates.map((t) => t.id)).toContain(note.templateId);
      for (const task of lead.tasks) expect(staffIds).toContain(task.assigneeStaffId);
    }
    expect(leads.some((l) => l.assignedStaffId === null)).toBe(true);
  });

  it('keeps clinic wording out of other industries', () => {
    if (pack.id === 'clinic') return;
    const copy = JSON.stringify([pack.site, pack.stages, pack.offerings, pack.intake, pack.crm.templates]);
    expect(copy).not.toMatch(/\b(doctors?|patients?|clinics?|medical|hospital)\b/i);
  });
});

describe('pack registry', () => {
  it('returns packs by id and the clinic by default', () => {
    expect(getActivePack()).toBe(clinicPack);
    expect(getIndustryPack('clinic')).toBe(clinicPack);
    expect(() => getIndustryPack('casino')).toThrow();
  });

  it('keeps offering slugs, demo staff and lead ids unique across packs', () => {
    expect(unique(packs.flatMap((p) => p.offerings.map((o) => o.slug)))).toBe(true);
    expect(unique(packs.flatMap((p) => p.demo.staff.map((m) => m.id)))).toBe(true);
    expect(unique(packs.flatMap((p) => p.demo.leads.map((l) => l.id)))).toBe(true);
    expect(unique(packs.map((p) => p.brand.name))).toBe(true);
  });
});

describe('clinic pack', () => {
  it('defines the required stages, levels and sequences in order', () => {
    expect(clinicPack.stages.map((s) => s.label)).toEqual([
      'New',
      'AI-triaged',
      'Appointment booked',
      'Missed visit',
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

  it('has exactly four health packages and two locations', () => {
    expect(clinicPack.site.plans.items).toHaveLength(4);
    expect(clinicPack.site.locations.items).toHaveLength(2);
  });
});
