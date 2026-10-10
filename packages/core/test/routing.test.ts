import { describe, expect, it } from 'vitest';
import {
  assignLead,
  AssignmentError,
  clinicDemoStaff,
  clinicPack,
  compareQueuePriority,
  routeLead,
  type RosterMember,
  type RoutableLead,
  type UrgencyLevel,
} from '../src';

const byName = (name: string) => clinicDemoStaff.find((m) => m.fullName === name)!.id;
const roster = (overrides: Record<string, Partial<RosterMember>> = {}): RosterMember[] =>
  clinicDemoStaff.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    role: m.role,
    level: m.level,
    active: true,
    specialties: m.specialties,
    languages: m.languages,
    capacity: m.capacity,
    openLeads: 0,
    lastAssignedAt: null,
    ...overrides[m.fullName],
  }));
const lead = (overrides: Partial<RoutableLead> = {}): RoutableLead => ({
  id: 'lead-1',
  specialtySlug: 'dermatology',
  urgency: 'normal',
  preferredLanguage: 'en',
  billingFlag: false,
  previousStaffId: null,
  ...overrides,
});
const route = (l: RoutableLead, r: RosterMember[] = roster()) =>
  routeLead(l, r, clinicPack.routing, clinicPack.staffLevels);

describe('routeLead: table-driven cases', () => {
  const cases: {
    name: string;
    lead: Partial<RoutableLead>;
    roster?: Record<string, Partial<RosterMember>>;
    expected: string;
    pool?: 'specialty' | 'fallback';
    explains?: RegExp;
  }[] = [
    {
      name: 'equal candidates: deterministic tie-break by id',
      lead: {},
      expected: 'Dr. Meera Kulkarni',
      pool: 'specialty',
      explains: /Tied with Dr\. Sana Mirza/,
    },
    {
      name: 'language match wins',
      lead: { preferredLanguage: 'ur' },
      expected: 'Dr. Sana Mirza',
      explains: /speaks ur/,
    },
    {
      name: 'urgent goes to a senior consultant only',
      lead: { specialtySlug: 'general-medicine', urgency: 'urgent' },
      expected: 'Dr. Asha Raman',
      explains: /only senior staff/,
    },
    {
      name: 'urgent with no senior in the team: best available, and says so',
      lead: { specialtySlug: 'dental', urgency: 'urgent' },
      expected: 'Dr. Farhan Qureshi',
      explains: /no senior staff in this team/,
    },
    {
      name: 'not sure goes to a coordinator, by language',
      lead: { specialtySlug: null, preferredLanguage: 'bn' },
      expected: 'Rahul Das',
      pool: 'fallback',
      explains: /not sure/,
    },
    {
      name: 'nobody active covers the specialty: coordinator',
      lead: { specialtySlug: 'dental' },
      roster: { 'Dr. Farhan Qureshi': { active: false } },
      expected: 'Neha Joshi',
      pool: 'fallback',
      explains: /Nobody active covers dental/,
    },
    {
      name: 'a full diary is skipped while a colleague has room',
      lead: {},
      roster: { 'Dr. Meera Kulkarni': { openLeads: 16 } },
      expected: 'Dr. Sana Mirza',
      explains: /Skipped 1 at capacity/,
    },
    {
      name: 'everyone full: the least loaded person',
      lead: {},
      roster: { 'Dr. Meera Kulkarni': { openLeads: 20 }, 'Dr. Sana Mirza': { openLeads: 22 } },
      expected: 'Dr. Sana Mirza',
      explains: /Everyone in this team is at capacity/,
    },
    {
      name: 'spare capacity breaks a language tie',
      lead: {},
      roster: { 'Dr. Meera Kulkarni': { openLeads: 12 }, 'Dr. Sana Mirza': { openLeads: 2 } },
      expected: 'Dr. Sana Mirza',
    },
    {
      name: 'a returning patient goes back to their clinician',
      lead: { previousStaffId: byName('Dr. Sana Mirza') },
      roster: { 'Dr. Sana Mirza': { openLeads: 15 } },
      expected: 'Dr. Sana Mirza',
      explains: /saw this patient before/,
    },
    {
      name: 'continuity does not beat language plus spare capacity together',
      lead: { previousStaffId: byName('Dr. Meera Kulkarni'), preferredLanguage: 'ur' },
      roster: { 'Dr. Meera Kulkarni': { openLeads: 15 } },
      expected: 'Dr. Sana Mirza',
    },
    {
      name: 'round robin: the person waiting longest wins a full tie',
      lead: {},
      roster: {
        'Dr. Meera Kulkarni': { lastAssignedAt: new Date('2026-10-10T09:00:00Z') },
        'Dr. Sana Mirza': { lastAssignedAt: new Date('2026-10-10T08:00:00Z') },
      },
      expected: 'Dr. Sana Mirza',
    },
    {
      name: 'high urgency prefers seniority when everything else is equal',
      lead: { urgency: 'high', specialtySlug: 'general-medicine' },
      roster: { 'Dr. Vikram Sethi': { lastAssignedAt: null }, 'Dr. Asha Raman': { lastAssignedAt: new Date() } },
      expected: 'Dr. Asha Raman',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const decision = route(lead(c.lead), roster(c.roster));
      expect(decision.staffName).toBe(c.expected);
      if (c.pool) expect(decision.pool).toBe(c.pool);
      if (c.explains) expect(decision.explanation.join(' ')).toMatch(c.explains);
      expect(decision.explanation.join(' ')).toContain(`Chose ${c.expected}`);
    });
  }

  it('never picks inactive staff or the wrong role', () => {
    const decision = route(
      lead({ specialtySlug: 'general-medicine' }),
      roster({ 'Dr. Asha Raman': { active: false } }),
    );
    expect(decision.staffName).toBe('Dr. Vikram Sethi');
    expect(decision.candidates.map((c) => c.name)).not.toContain('Dr. Asha Raman');
    const unsure = route(lead({ specialtySlug: null }));
    for (const c of unsure.candidates) {
      expect(clinicDemoStaff.find((m) => m.id === c.staffId)!.role).toBe('care_coordinator');
    }
  });

  it('urgent leads jump the queue; others do not', () => {
    expect(route(lead({ urgency: 'urgent' })).priority).toBe('front');
    expect(route(lead({ urgency: 'high' })).priority).toBe('normal');
  });

  it('copies in the billing desk for insured leads', () => {
    const decision = route(lead({ billingFlag: true }));
    expect(decision.copyIn).toEqual([
      expect.objectContaining({ name: 'Deepa Menon', role: 'billing_desk', reason: 'Insurance to check' }),
    ]);
    expect(route(lead()).copyIn).toEqual([]);
  });

  it('leaves the lead unassigned when nobody is available', () => {
    const everyoneOff = Object.fromEntries(clinicDemoStaff.map((m) => [m.fullName, { active: false }]));
    const decision = route(lead({ specialtySlug: null }), roster(everyoneOff));
    expect(decision.staffId).toBeNull();
    expect(decision.explanation.join(' ')).toMatch(/stays in the unassigned queue/);
  });

  it('shows every candidate with a score breakdown, excluded ones with the reason', () => {
    const decision = route(
      lead({ specialtySlug: 'general-medicine', urgency: 'urgent' }),
      roster({ 'Dr. Asha Raman': { openLeads: 3 } }),
    );
    const [first, second] = decision.candidates;
    expect(first).toMatchObject({ name: 'Dr. Asha Raman' });
    expect(first!.factors.map((f) => f.id)).toEqual(['language', 'seniority', 'load', 'continuity']);
    expect(first!.total).toBe(first!.factors.reduce((s, f) => s + f.points, 0));
    expect(second).toMatchObject({ name: 'Dr. Vikram Sethi', excludedBecause: 'Urgent: senior staff only' });
  });

  it('is deterministic and independent of roster order', () => {
    const l = lead({ specialtySlug: 'general-medicine', preferredLanguage: 'hi' });
    const a = route(l);
    const b = route(l, [...roster()].reverse());
    expect(b.staffId).toBe(a.staffId);
    expect(route(l)).toEqual(a);
  });
});

describe('assignLead with routing', () => {
  const base = {
    id: 'lead-1',
    specialtySlug: 'dermatology',
    urgency: 'normal' as UrgencyLevel,
    preferredLanguage: 'ur',
    assignedStaffId: null,
  };

  it('auto mode returns the routing decision and its explanation', () => {
    const decision = assignLead(base, {
      mode: 'auto',
      roster: roster(),
      config: clinicPack.routing,
      staffLevels: clinicPack.staffLevels,
    });
    expect(decision).toMatchObject({ staffId: byName('Dr. Sana Mirza'), method: 'routing', changed: true });
    expect(decision.routing?.candidates.length).toBeGreaterThan(1);
  });

  it('overriding the suggestion needs a reason, which is recorded', () => {
    const staff = clinicDemoStaff.map((m) => ({ ...m, active: true }));
    const context = {
      mode: 'manual' as const,
      staffId: byName('Dr. Meera Kulkarni'),
      staff,
      suggestedStaffId: byName('Dr. Sana Mirza'),
    };
    expect(() => assignLead(base, context)).toThrow(AssignmentError);
    const decision = assignLead(base, { ...context, overrideReason: 'patient_request' });
    expect(decision).toMatchObject({ method: 'override', overrideReason: 'patient_request' });
    expect(decision.explanation).toContain('Overrode the routing suggestion: The patient asked for this person.');
    const following = assignLead(base, { ...context, staffId: byName('Dr. Sana Mirza') });
    expect(following.method).toBe('manual');
  });
});

describe('fairness over a simulated week', () => {
  /** mulberry32 */
  function prng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  for (const seed of [1, 7, 42, 2026]) {
    it(`nobody is starved or overloaded (seed ${seed})`, () => {
      const rand = prng(seed);
      const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
      const team = roster();
      const state = new Map(team.map((m) => [m.id, { ...m }]));
      const received = new Map(team.map((m) => [m.id, 0]));
      const open: { staffId: string; closesAt: number }[] = [];
      const specialties = [...clinicPack.offerings.map((o) => o.slug), null];
      const languages = ['en', 'en', 'en', 'en', 'hi', 'hi', 'hi', 'ta', 'mr', 'bn'];
      const urgencies: UrgencyLevel[] = ['low', 'normal', 'normal', 'normal', 'normal', 'high', 'high', 'urgent'];

      // 7 days, 8 hours a day, ~5 leads an hour; a lead stays open 1 to 3 days.
      for (let hour = 0; hour < 7 * 24; hour += 1) {
        for (const item of open.filter((o) => o.closesAt <= hour)) {
          state.get(item.staffId)!.openLeads -= 1;
          open.splice(open.indexOf(item), 1);
        }
        if (hour % 24 < 9 || hour % 24 >= 17) continue;
        for (let n = 0; n < 5; n += 1) {
          const l = lead({
            id: `L${hour}-${n}`,
            specialtySlug: pick(specialties),
            preferredLanguage: pick(languages),
            urgency: pick(urgencies),
          });
          const current = [...state.values()];
          const decision = routeLead(l, current, clinicPack.routing, clinicPack.staffLevels);
          const chosen = state.get(decision.staffId!)!;
          // Overloaded: someone at capacity got a lead while a pool colleague had room.
          if (chosen.openLeads >= chosen.capacity) {
            const poolIds = decision.candidates.filter((c) => !c.excludedBecause).map((c) => c.staffId);
            for (const id of poolIds) expect(state.get(id)!.openLeads).toBeGreaterThanOrEqual(state.get(id)!.capacity);
          }
          chosen.openLeads += 1;
          (chosen as { lastAssignedAt: Date | null }).lastAssignedAt = new Date(hour * 3_600_000 + n);
          received.set(chosen.id, received.get(chosen.id)! + 1);
          open.push({ staffId: chosen.id, closesAt: hour + 24 + Math.floor(rand() * 48) });
        }
      }

      // Starved: in every team of two or more, each person gets at least a
      // third of an even share of the team's leads.
      const teams = new Map<string, string[]>();
      for (const m of team.filter((m) => m.role === 'specialist_doctor')) {
        for (const s of m.specialties) teams.set(s, [...(teams.get(s) ?? []), m.id]);
      }
      teams.set(
        'coordinators',
        team.filter((m) => m.role === 'care_coordinator').map((m) => m.id),
      );
      for (const [name, ids] of teams) {
        if (ids.length < 2) continue;
        const total = ids.reduce((sum, id) => sum + received.get(id)!, 0);
        for (const id of ids) {
          expect(received.get(id), `${name}: ${id}`).toBeGreaterThanOrEqual(Math.floor(total / ids.length / 3));
        }
      }
      // Billing and managers are never routed leads directly.
      for (const m of team.filter((m) => m.role === 'billing_desk' || m.role === 'manager')) {
        expect(received.get(m.id)).toBe(0);
      }
    });
  }
});

describe('compareQueuePriority', () => {
  it('puts urgent leads first, then the longest wait', () => {
    const items = [
      { id: 'new-normal', urgency: 'normal', createdAt: '2026-10-10T10:00:00Z' },
      { id: 'old-normal', urgency: 'normal', createdAt: '2026-10-09T10:00:00Z' },
      { id: 'new-urgent', urgency: 'urgent', createdAt: '2026-10-10T11:00:00Z' },
      { id: 'low', urgency: 'low', createdAt: '2026-10-01T10:00:00Z' },
      { id: 'high', urgency: 'high', createdAt: '2026-10-10T12:00:00Z' },
    ];
    expect([...items].sort(compareQueuePriority).map((i) => i.id)).toEqual([
      'new-urgent',
      'high',
      'old-normal',
      'new-normal',
      'low',
    ]);
  });
});
