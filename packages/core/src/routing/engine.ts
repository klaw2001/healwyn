import type { StaffLevel } from '../industries/types';
import type {
  CandidateScore,
  CopyIn,
  FactorScore,
  RosterMember,
  RoutableLead,
  RoutingConfig,
  RoutingDecision,
} from './types';

/**
 * The routing engine: pure and deterministic. The same lead, roster and
 * config always give the same answer, and every answer explains itself.
 *
 * 1. Pool: active specialists who list the lead's offering; if the lead is
 *    unsure or nobody covers it, the fallback role (care coordinators).
 * 2. Capacity: people at capacity are skipped while anyone else has room.
 * 3. Urgency: urgent leads go only to staff at `urgentMinRank` or above when
 *    anyone in the pool qualifies, and jump the queue.
 * 4. Score: language, seniority (scaled by urgency), spare capacity and
 *    continuity with a returning patient's previous clinician.
 * 5. Tie-breaks: more spare capacity, then longest since last assignment,
 *    then id, so equal candidates take turns.
 * The billing role is copied in when the lead carries the billing flag.
 */
export function routeLead(
  lead: RoutableLead,
  roster: readonly RosterMember[],
  config: RoutingConfig,
  staffLevels: readonly StaffLevel[],
  offeringName: (slug: string) => string = (slug) => slug,
): RoutingDecision {
  const rankOf = (member: RosterMember) => staffLevels.find((l) => l.id === member.level)?.rank ?? 0;
  const maxRank = Math.max(1, ...staffLevels.map((l) => l.rank));
  const active = roster.filter((m) => m.active);
  const explanation: string[] = [];

  // 1. Pool.
  const specialists = lead.specialtySlug
    ? active.filter((m) => config.specialistRoles.includes(m.role) && m.specialties.includes(lead.specialtySlug!))
    : [];
  const pool: 'specialty' | 'fallback' = specialists.length ? 'specialty' : 'fallback';
  let eligible = pool === 'specialty' ? specialists : active.filter((m) => m.role === config.fallbackRole);
  if (pool === 'specialty') {
    explanation.push(`Specialty: ${offeringName(lead.specialtySlug!)} team (${specialists.length} available).`);
  } else if (lead.specialtySlug) {
    explanation.push(`Nobody active covers ${offeringName(lead.specialtySlug)}, so a care coordinator triages.`);
  } else {
    explanation.push('The lead is not sure which specialty they need, so a care coordinator triages.');
  }
  const excluded = new Map<string, string>();

  // 2. Capacity.
  const withRoom = eligible.filter((m) => m.openLeads < m.capacity);
  if (withRoom.length && withRoom.length < eligible.length) {
    for (const m of eligible) if (m.openLeads >= m.capacity) excluded.set(m.id, 'At capacity');
    explanation.push(`Skipped ${eligible.length - withRoom.length} at capacity.`);
    eligible = withRoom;
  } else if (!withRoom.length && eligible.length) {
    explanation.push('Everyone in this team is at capacity; the least loaded person is chosen.');
  }

  // 3. Urgency.
  const priority = lead.urgency === 'urgent' ? 'front' : 'normal';
  if (lead.urgency === 'urgent') {
    const senior = eligible.filter((m) => rankOf(m) >= config.urgentMinRank);
    if (senior.length) {
      for (const m of eligible) if (rankOf(m) < config.urgentMinRank) excluded.set(m.id, 'Urgent: senior staff only');
      if (senior.length < eligible.length) explanation.push('Urgent: only senior staff considered.');
      eligible = senior;
    } else if (eligible.length) {
      explanation.push('Urgent, but no senior staff in this team; the best available person is chosen.');
    }
    explanation.push('Urgent: placed at the front of the queue.');
  }

  // 4. Score.
  const { weights } = config;
  const seniorityFactor = config.urgencySeniority[lead.urgency] ?? 0;
  const score = (m: RosterMember): CandidateScore => {
    const factors: FactorScore[] = [
      {
        id: 'language',
        label: m.languages.includes(lead.preferredLanguage)
          ? `Speaks ${lead.preferredLanguage}`
          : `Does not list ${lead.preferredLanguage}`,
        points: m.languages.includes(lead.preferredLanguage) ? weights.language : 0,
        max: weights.language,
      },
      {
        id: 'seniority',
        label: `Level rank ${rankOf(m)} for a ${lead.urgency} lead`,
        points: round(weights.seniority * seniorityFactor * (rankOf(m) / maxRank)),
        max: round(weights.seniority * seniorityFactor),
      },
      {
        id: 'load',
        label: `${m.openLeads} of ${m.capacity} open leads`,
        points: round(weights.load * Math.max(0, 1 - m.openLeads / Math.max(1, m.capacity))),
        max: weights.load,
      },
      {
        id: 'continuity',
        label: lead.previousStaffId === m.id ? 'Saw this patient before' : 'New to this patient',
        points: lead.previousStaffId === m.id ? weights.continuity : 0,
        max: weights.continuity,
      },
    ];
    return { staffId: m.id, name: m.fullName, total: round(factors.reduce((sum, f) => sum + f.points, 0)), factors };
  };

  // 5. Rank with deterministic tie-breaks.
  const byId = new Map(roster.map((m) => [m.id, m]));
  const ranked = eligible.map(score).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const ma = byId.get(a.staffId)!;
    const mb = byId.get(b.staffId)!;
    const loadA = ma.openLeads / Math.max(1, ma.capacity);
    const loadB = mb.openLeads / Math.max(1, mb.capacity);
    if (loadA !== loadB) return loadA - loadB;
    const lastA = ma.lastAssignedAt?.getTime() ?? -Infinity;
    const lastB = mb.lastAssignedAt?.getTime() ?? -Infinity;
    if (lastA !== lastB) return lastA - lastB;
    return a.staffId < b.staffId ? -1 : a.staffId > b.staffId ? 1 : 0;
  });
  const skipped = [...excluded.entries()].map(([id, reason]) => ({ ...score(byId.get(id)!), excludedBecause: reason }));

  const winner = ranked[0];
  const winnerMember = winner ? byId.get(winner.staffId)! : null;
  if (winner && winnerMember) {
    const reasons = winner.factors.filter((f) => f.points > 0).map((f) => f.label.toLowerCase());
    explanation.push(
      `Chose ${winner.name} (${winner.total} points${reasons.length ? `: ${reasons.join(', ')}` : ''}).`,
    );
    const runnerUp = ranked[1];
    if (runnerUp && runnerUp.total === winner.total) {
      explanation.push(`Tied with ${runnerUp.name} on points; chosen for more spare capacity or a longer wait.`);
    }
  } else {
    explanation.push('Nobody is available to take this lead; it stays in the unassigned queue.');
  }

  // Billing copy-in.
  const copyIn: CopyIn[] = [];
  if (lead.billingFlag && config.billingRole) {
    const desk = active
      .filter((m) => m.role === config.billingRole)
      .sort(
        (a, b) =>
          a.openLeads / Math.max(1, a.capacity) - b.openLeads / Math.max(1, b.capacity) || (a.id < b.id ? -1 : 1),
      )[0];
    if (desk) {
      copyIn.push({
        staffId: desk.id,
        name: desk.fullName,
        role: desk.role,
        code: 'insurance_check',
        reason: 'Insurance to check',
      });
      explanation.push(`Copied in ${desk.fullName} (billing desk) to check insurance.`);
    }
  }

  return {
    staffId: winner?.staffId ?? null,
    staffName: winner?.name ?? null,
    pool,
    priority,
    copyIn,
    candidates: [...ranked, ...skipped],
    explanation,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

const QUEUE_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** Work-queue order: urgent leads jump the queue, then whoever has waited longest. */
export function compareQueuePriority(
  a: { urgency: string; createdAt: Date | string },
  b: { urgency: string; createdAt: Date | string },
): number {
  const rank = (QUEUE_RANK[a.urgency] ?? 2) - (QUEUE_RANK[b.urgency] ?? 2);
  if (rank !== 0) return rank;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
