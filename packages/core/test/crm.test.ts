import { describe, expect, it } from 'vitest';
import {
  AssignmentError,
  assignLead,
  canSeeLead,
  can,
  clinicDemoLeads,
  clinicDemoStaff,
  clinicPack,
  DEMO_USERS,
  formatDuration,
  getIndustryPack,
  homePathFor,
  intakeToLeadPayload,
  buildIntakeSchema,
  MESSAGE_CHANNELS,
  PERMISSIONS,
  planStageEntry,
  renderTemplate,
  scoreLead,
  slaStatus,
  STAFF_ROLES,
  stopReasonFor,
  unknownTokens,
  URGENCIES,
  type ScoreInput,
  type SendContext,
} from '../src';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-10-11T10:00:00Z');

describe('permissions matrix', () => {
  it('gives every capability to at least one role and keeps manager-only screens manager-only', () => {
    for (const roles of Object.values(PERMISSIONS)) expect(roles.length).toBeGreaterThan(0);
    for (const role of STAFF_ROLES.filter((r) => r !== 'manager')) {
      expect(can(role, 'screen.sequences')).toBe(false);
      expect(can(role, 'screen.dashboard')).toBe(false);
    }
    expect(can('manager', 'screen.sequences')).toBe(true);
  });

  it('lets only the front desk assign leads', () => {
    expect(STAFF_ROLES.filter((r) => can(r, 'lead.assign'))).toEqual(['manager', 'care_coordinator']);
  });

  it('limits what doctors and the billing desk can see', () => {
    const lead = { assignedStaffId: 'doc-a', hasInsurance: false, stage: 'visited' };
    expect(canSeeLead('specialist_doctor', 'doc-a', lead)).toBe(true);
    expect(canSeeLead('specialist_doctor', 'doc-b', lead)).toBe(false);
    expect(canSeeLead('specialist_doctor', 'doc-b', { ...lead, assignedStaffId: null })).toBe(false);
    expect(canSeeLead('billing_desk', 'desk', lead)).toBe(false);
    expect(canSeeLead('billing_desk', 'desk', { ...lead, hasInsurance: true })).toBe(true);
    expect(canSeeLead('billing_desk', 'desk', { ...lead, stage: 'package_active' })).toBe(true);
    expect(canSeeLead('manager', 'x', lead)).toBe(true);
    expect(canSeeLead('care_coordinator', 'x', lead)).toBe(true);
  });

  it('sends managers to the pipeline and everyone else to their workspace', () => {
    expect(homePathFor('manager')).toBe('/pipeline');
    expect(homePathFor('specialist_doctor')).toBe('/workspace');
  });

  it('has one demo user per role, each a real staff member with that role', () => {
    expect(DEMO_USERS.map((u) => u.role).sort()).toEqual([...STAFF_ROLES].sort());
    for (const user of DEMO_USERS) {
      expect(clinicDemoStaff.find((m) => m.id === user.staffId)?.role).toBe(user.role);
    }
  });
});

describe('lead scoring', () => {
  const base: ScoreInput = {
    stage: 'new',
    urgency: 'normal',
    specialtySlug: 'dental',
    answers: { has_insurance: 'yes', visit_type: 'first' },
    hasEmail: true,
    hasMessage: false,
    consents: ['contact'],
    createdAt: at('2026-10-11T08:00:00Z'),
    replied: false,
    optedOut: false,
  };

  it('adds matching rules and shows the breakdown', () => {
    const score = scoreLead(clinicPack.crm.scoring, base, NOW);
    expect(score.factors.map((f) => f.id)).toEqual(['offering', 'insured', 'email', 'fresh']);
    expect(score.score).toBe(15 + 10 + 5 + 15);
    expect(score.band).toBe('warm');
  });

  it('clamps to 0..100 and bands consistently', () => {
    const everything = scoreLead(
      clinicPack.crm.scoring,
      {
        ...base,
        urgency: 'urgent',
        hasMessage: true,
        consents: ['contact', 'assistant_call'],
        replied: true,
        stage: 'package_active',
        answers: { has_insurance: 'yes', visit_type: 'follow-up' },
      },
      NOW,
    );
    expect(everything.score).toBe(100);
    expect(everything.band).toBe('hot');
    const lost = scoreLead(
      clinicPack.crm.scoring,
      { ...base, stage: 'lost', optedOut: true, specialtySlug: null, hasEmail: false, answers: {} },
      at('2026-11-30T00:00:00Z'),
    );
    expect(lost.score).toBe(0);
    expect(lost.band).toBe('cool');
  });

  it('drops the freshness bonus after a day', () => {
    const later = scoreLead(clinicPack.crm.scoring, base, at('2026-10-12T09:00:00Z'));
    expect(later.factors.map((f) => f.id)).not.toContain('fresh');
  });
});

describe('first-response SLA', () => {
  const targets = clinicPack.crm.sla;
  const created = at('2026-10-11T06:00:00Z');

  it('is on track, then due soon, then overdue for a high-urgency lead (4h window)', () => {
    expect(
      slaStatus({ createdAt: created, urgency: 'high', firstResponseAt: null }, targets, at('2026-10-11T07:00:00Z'))
        .state,
    ).toBe('on_track');
    expect(
      slaStatus({ createdAt: created, urgency: 'high', firstResponseAt: null }, targets, at('2026-10-11T09:30:00Z'))
        .state,
    ).toBe('due_soon');
    const overdue = slaStatus(
      { createdAt: created, urgency: 'high', firstResponseAt: null },
      targets,
      at('2026-10-11T11:00:00Z'),
    );
    expect(overdue.state).toBe('overdue');
    expect(overdue.minutesLeft).toBe(-60);
  });

  it('records whether a response met the target', () => {
    expect(
      slaStatus({ createdAt: created, urgency: 'urgent', firstResponseAt: at('2026-10-11T06:45:00Z') }, targets).state,
    ).toBe('met');
    expect(
      slaStatus({ createdAt: created, urgency: 'urgent', firstResponseAt: at('2026-10-11T08:00:00Z') }, targets).state,
    ).toBe('met_late');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(125)).toBe('2h 05m');
    expect(formatDuration(-1500)).toBe('1d 1h');
    expect(formatDuration(2880)).toBe('2d');
  });

  it('has a target for every urgency', () => {
    for (const urgency of URGENCIES) expect(targets.firstResponseMinutes[urgency]).toBeGreaterThan(0);
  });
});

describe('nurture planner', () => {
  const sequences = clinicPack.sequences;

  it('enrols a new lead in the welcome sequence with dated steps', () => {
    const plan = planStageEntry(sequences, 'new', [], NOW);
    expect(plan.cancel).toEqual([]);
    expect(plan.enroll.map((e) => e.sequenceId)).toEqual(['new-lead-welcome']);
    expect(plan.enroll[0]?.steps[0]).toEqual({
      stepIndex: 0,
      channel: 'email',
      templateId: 'welcome-email',
      dueAt: NOW.toISOString(),
    });
    expect(plan.enroll[0]?.steps[1]?.dueAt).toBe(new Date(NOW.getTime() + 5 * 60_000).toISOString());
  });

  it('stops the welcome sequence and starts reminders when an appointment is booked', () => {
    const plan = planStageEntry(sequences, 'appointment_booked', ['new-lead-welcome'], NOW);
    expect(plan.cancel).toEqual([{ sequenceId: 'new-lead-welcome', reason: 'stage_changed' }]);
    expect(plan.enroll.map((e) => e.sequenceId)).toEqual(['appointment-reminder']);
  });

  it('never enrols twice in a sequence that is already running', () => {
    expect(planStageEntry(sequences, 'new', ['new-lead-welcome'], NOW).enroll).toEqual([]);
  });

  it('keeps sequences that the new stage does not cancel', () => {
    const plan = planStageEntry(sequences, 'ai_triaged', ['new-lead-welcome'], NOW);
    expect(plan).toEqual({ enroll: [], cancel: [] });
  });
});

describe('stop conditions at send time', () => {
  const sequence = clinicPack.sequences[0]!;
  const ok: SendContext = {
    enrollmentStatus: 'active',
    leadStage: 'new',
    optedOut: false,
    erased: false,
    contactConsent: true,
    replied: false,
  };

  it('allows a normal step', () => {
    expect(stopReasonFor(sequence, ok)).toBeNull();
  });

  it.each([
    [{ erased: true }, 'lead_erased'],
    [{ contactConsent: false }, 'consent_withdrawn'],
    [{ optedOut: true }, 'opted_out'],
    [{ replied: true }, 'replied'],
    [{ enrollmentStatus: 'stopped' as const }, 'manual'],
    [{ leadStage: 'appointment_booked' }, 'stage_changed'],
  ])('stops on %o', (change, reason) => {
    expect(stopReasonFor(sequence, { ...ok, ...change })).toBe(reason);
  });

  it('puts erasure and consent above everything else', () => {
    expect(stopReasonFor(sequence, { ...ok, erased: true, contactConsent: false, optedOut: true, replied: true })).toBe(
      'lead_erased',
    );
  });
});

describe('message templates', () => {
  const vars = {
    fullName: 'Dr. Ananya Rao',
    specialty: 'Dental',
    reference: 'ABCD-1234',
    unsubscribeUrl: 'https://example.com/unsubscribe?token=t',
  };

  it('fills tokens, adds the unsubscribe link to emails and STOP to texts', () => {
    const email = renderTemplate(
      clinicPack.crm.templates.find((t) => t.id === 'welcome-email')!,
      vars,
    );
    expect(email.subject).toBe('We have your enquiry (ref ABCD-1234)');
    expect(email.text).toContain('Hello Ananya,');
    expect(email.text).toContain('Unsubscribe from these emails: https://example.com/unsubscribe?token=t');
    expect(email.text).not.toMatch(/\{\w+\}/);
    const sms = renderTemplate(
      clinicPack.crm.templates.find((t) => t.channel === 'sms')!,
      vars,
    );
    expect(sms.subject).toBeNull();
    expect(sms.text).toMatch(/Reply STOP to opt out\.$/);
  });

  it('every template uses only known tokens', () => {
    for (const template of clinicPack.crm.templates) expect(unknownTokens(template), template.id).toEqual([]);
  });
});

describe('clinic CRM configuration', () => {
  const pack = getIndustryPack('clinic');
  const stageIds = pack.stages.map((s) => s.id);

  it('points every sequence step at a template on the same channel', () => {
    for (const sequence of pack.sequences) {
      expect(sequence.steps.length).toBeGreaterThan(0);
      for (const step of sequence.steps) {
        const template = pack.crm.templates.find((t) => t.id === step.templateId);
        expect(template, `${sequence.id} -> ${step.templateId}`).toBeDefined();
        expect(template?.channel).toBe(step.channel);
        expect(MESSAGE_CHANNELS).toContain(step.channel);
      }
      for (const stage of sequence.cancelOnStages) expect(stageIds).toContain(stage);
      if (sequence.enrolOnStage) expect(sequence.cancelOnStages).not.toContain(sequence.enrolOnStage);
    }
  });

  it('defines the six required sequences and some note templates', () => {
    expect(pack.sequences.map((s) => s.id)).toEqual([
      'new-lead-welcome',
      'appointment-reminder',
      'no-show-recovery',
      'post-visit-check-in',
      'follow-up-due',
      'package-renewal',
    ]);
    expect(pack.crm.noteTemplates.length).toBeGreaterThan(0);
  });

  it('templates contain no medical advice words', () => {
    for (const template of pack.crm.templates) {
      expect(template.body).not.toMatch(/\b(diagnos|dosage|prescri|take \d|mg\b)/i);
    }
  });
});

describe('demo leads', () => {
  it('has 40 leads covering every stage, with some overdue first responses', () => {
    expect(clinicDemoLeads).toHaveLength(40);
    expect(new Set(clinicDemoLeads.map((l) => l.stage)).size).toBe(clinicPack.stages.length);
    expect(new Set(clinicDemoLeads.map((l) => l.id)).size).toBe(40);
    const overdue = clinicDemoLeads.filter(
      (l) =>
        l.firstResponseAfterMinutes === null &&
        l.createdMinutesAgo > clinicPack.crm.sla.firstResponseMinutes[l.urgency],
    );
    expect(overdue.length).toBeGreaterThan(0);
    expect(clinicDemoLeads.some((l) => l.assignedStaffId === null)).toBe(true);
  });
});

describe('new lead payload', () => {
  it('flags insurance for billing and plans the welcome sequence', async () => {
    const submission = buildIntakeSchema(clinicPack).parse({
      full_name: 'Asha Demo',
      phone: '9876543210',
      preferred_language: 'en',
      concern_category: 'dental',
      preferred_time: 'any',
      visit_type: 'first',
      has_insurance: 'yes',
      consent_contact: 'on',
    });
    const payload = await intakeToLeadPayload(submission, clinicPack, { now: NOW });
    expect(payload.billingFlag).toBe(true);
    expect(payload.sequencePlan?.enroll.map((e) => e.sequenceId)).toEqual(['new-lead-welcome']);
    expect(payload.consents.find((c) => c.purpose === 'contact')?.required).toBe(true);
  });
});

describe('assignLead', () => {
  const lead = {
    id: 'lead-1',
    specialtySlug: 'dental',
    urgency: 'normal' as const,
    preferredLanguage: 'hi',
    assignedStaffId: null,
  };
  const staff = [
    { id: 's1', fullName: 'Dr. One', active: true, specialties: ['dental'], languages: ['en', 'hi'] },
    { id: 's2', fullName: 'Dr. Two', active: true, specialties: ['dermatology'], languages: ['en'] },
    { id: 's3', fullName: 'Former', active: false, specialties: ['dental'], languages: ['hi'] },
  ];

  it('assigns by hand and explains how well the person matches', () => {
    const decision = assignLead(lead, { mode: 'manual', staffId: 's1', staff });
    expect(decision).toMatchObject({ staffId: 's1', method: 'manual', changed: true });
    expect(decision.explanation).toEqual([
      'Assigned by hand to Dr. One.',
      'Covers dental.',
      "Speaks the lead's preferred language (hi).",
    ]);
    const mismatch = assignLead(lead, { mode: 'manual', staffId: 's2', staff });
    expect(mismatch.explanation).toContain('Does not list dental as a specialty.');
    expect(mismatch.explanation).toContain("Does not list the lead's preferred language (hi).");
  });

  it('refuses inactive or unknown staff', () => {
    expect(() => assignLead(lead, { mode: 'manual', staffId: 's3', staff })).toThrow(AssignmentError);
    expect(() => assignLead(lead, { mode: 'manual', staffId: 'nobody', staff })).toThrow(AssignmentError);
  });

  it('reports no change when the lead already sits with that person, and unassigns', () => {
    const owned = { ...lead, assignedStaffId: 's1' };
    expect(assignLead(owned, { mode: 'manual', staffId: 's1', staff }).changed).toBe(false);
    expect(assignLead(owned, { mode: 'manual', staffId: null, staff })).toMatchObject({ staffId: null, changed: true });
    expect(assignLead(lead, { mode: 'manual', staffId: null, staff }).changed).toBe(false);
  });
});
