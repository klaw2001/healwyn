import 'server-only';
import { slaStatus, type IndustryPack, type SlaState, type UrgencyLevel } from '@healwyn/core';
import { funnelRows, funnelSteps, percentile, share, type FunnelRow } from '../dashboard-math';
import { asStaff, type Tx } from './db';
import type { Session } from './session';

/**
 * The manager dashboard's read models. Every number on /dashboard comes from
 * one function here, and each is documented, with its SQL, in docs/METRICS.md.
 *
 * All reads run inside `asStaff`, so row level security decides which leads
 * count: a manager sees only their own industry. Nothing here filters by
 * industry by hand; the pack is used only for stage order, labels and the SLA.
 * Results hold ids, codes and counts, never names, phones or free text
 * (staff names on the load chart are colleagues, shown elsewhere in the CRM).
 */

export interface DashboardFilters {
  /** First local (India time) day, inclusive, "YYYY-MM-DD". */
  from: string;
  /** Last local day, inclusive. */
  to: string;
  /** An offering slug from the pack (`leads.specialty_slug`), or null for all. */
  offering: string | null;
}

/** Midnight at the start of `from` and after the end of `to`, in the pack's time zone. */
function bounds(tx: Tx, filters: DashboardFilters, timeZone: string) {
  return {
    start: tx`(${filters.from}::date::timestamp at time zone ${timeZone})`,
    end: tx`((${filters.to}::date + 1)::timestamp at time zone ${timeZone})`,
  };
}

/**
 * The cohort most metrics share: individual (not partner) leads created in the
 * range, optionally for one offering. Erased leads stay in: erasure clears
 * personal data in place and keeps stage, source and timestamps for exactly this.
 */
function cohort(tx: Tx, filters: DashboardFilters, timeZone: string) {
  const { start, end } = bounds(tx, filters, timeZone);
  return tx`
    select l.id, l.stage, l.source, l.urgency, l.created_at, l.first_response_at
    from public.leads l
    where l.lead_type = 'individual'
      and l.created_at >= ${start}
      and l.created_at < ${end}
      ${filters.offering ? tx`and l.specialty_slug = ${filters.offering}` : tx``}`;
}

const stageIds = (pack: IndustryPack, kind: 'open' | 'won' | 'lost') =>
  pack.stages.filter((s) => s.kind === kind).map((s) => s.id);

// -- Funnel -----------------------------------------------------------------------------------------

export interface FunnelMetric {
  total: number;
  rows: FunnelRow[];
  /** Leads in the cohort whose current stage is a lost stage. */
  lost: number;
}

/**
 * How far each lead in the cohort got. A lead "reached" a step when the step is
 * at or before the furthest stage it has ever been in: its current stage, or
 * the `from`/`to` of any `stage.changed` event. Leads skip stages (booked
 * straight from New), so counting the furthest step keeps the funnel honest.
 */
export async function funnel(session: Session, pack: IndustryPack, filters: DashboardFilters): Promise<FunnelMetric> {
  const { steps, positions } = funnelSteps(pack.stages, [pack.booking.noShowStageId]);
  return asStaff(session, async (tx) => {
    const scope = cohort(tx, filters, pack.brand.timeZone);
    const rows = await tx<{ position: number; reached: number }[]>`
      with scope as (${scope}),
      visited as (
        select s.id, s.stage as stage_id from scope s
        union
        select e.lead_id, e.payload ->> 'to' from public.lead_events e
          join scope s on s.id = e.lead_id where e.type = 'stage.changed'
        union
        select e.lead_id, e.payload ->> 'from' from public.lead_events e
          join scope s on s.id = e.lead_id where e.type = 'stage.changed'
      ),
      furthest as (
        select v.id, coalesce(max(m.position), 0) as position
        from visited v
        left join unnest(${positions.map((p) => p.stageId)}::text[], ${positions.map((p) => p.position)}::int[])
          as m(stage_id, position) on m.stage_id = v.stage_id
        group by v.id
      )
      select step.position, count(f.id)::int as reached
      from generate_series(0, ${steps.length - 1}::int) as step(position)
      left join furthest f on f.position >= step.position
      group by step.position
      order by step.position`;
    const [lost] = await tx<{ n: number }[]>`
      with scope as (${cohort(tx, filters, pack.brand.timeZone)})
      select count(*)::int as n from scope where stage = any(${stageIds(pack, 'lost')}::text[])`;
    const reached = steps.map((_, i) => rows.find((r) => r.position === i)?.reached ?? 0);
    return { total: reached[0] ?? 0, rows: funnelRows(steps, reached), lost: lost?.n ?? 0 };
  });
}

// -- First response against the SLA ------------------------------------------------------------------

/** Display order: responded on time, responded late, still inside the window, waiting past it. */
export const SLA_BUCKETS = ['met', 'met_late', 'waiting', 'overdue'] as const;
export type SlaBucket = (typeof SLA_BUCKETS)[number];

const bucketOf = (state: SlaState): SlaBucket =>
  state === 'on_track' || state === 'due_soon' ? 'waiting' : (state as SlaBucket);

export interface FirstResponseRow {
  urgency: UrgencyLevel;
  targetMinutes: number;
  leads: number;
  counts: Record<SlaBucket, number>;
  medianMinutes: number | null;
  onTimeShare: number | null;
}

export interface FirstResponseMetric {
  leads: number;
  responded: number;
  counts: Record<SlaBucket, number>;
  medianMinutes: number | null;
  p90Minutes: number | null;
  /** met ÷ (responded + overdue): leads still inside their window are not judged yet. */
  onTimeShare: number | null;
  /** overdue ÷ leads. */
  overdueShare: number | null;
  byUrgency: FirstResponseRow[];
}

const URGENCIES: readonly UrgencyLevel[] = ['urgent', 'high', 'normal', 'low'];

function summariseResponses(
  rows: readonly { urgency: UrgencyLevel; created_at: Date; first_response_at: Date | null }[],
  pack: IndustryPack,
  now: Date,
) {
  const counts: Record<SlaBucket, number> = { met: 0, met_late: 0, waiting: 0, overdue: 0 };
  const minutes: number[] = [];
  for (const row of rows) {
    const state = slaStatus(
      { createdAt: row.created_at, urgency: row.urgency, firstResponseAt: row.first_response_at },
      pack.crm.sla,
      now,
    ).state;
    counts[bucketOf(state)] += 1;
    if (row.first_response_at) {
      minutes.push(Math.max(0, (row.first_response_at.getTime() - row.created_at.getTime()) / 60_000));
    }
  }
  return {
    counts,
    minutes,
    onTimeShare: share(counts.met, counts.met + counts.met_late + counts.overdue),
  };
}

/**
 * Minutes from enquiry to the first staff action (`leads.first_response_at`),
 * judged per lead against the pack's target for its urgency with `slaStatus`
 * from @healwyn/core, the same rule the pipeline badges use.
 */
export async function firstResponse(
  session: Session,
  pack: IndustryPack,
  filters: DashboardFilters,
  now: Date = new Date(),
): Promise<FirstResponseMetric> {
  const rows = await asStaff(
    session,
    (tx) => tx<{ urgency: UrgencyLevel; created_at: Date; first_response_at: Date | null }[]>`
      with scope as (${cohort(tx, filters, pack.brand.timeZone)})
      select urgency, created_at, first_response_at from scope`,
  );
  const all = summariseResponses(rows, pack, now);
  const byUrgency = URGENCIES.map((urgency): FirstResponseRow => {
    const subset = rows.filter((r) => r.urgency === urgency);
    const summary = summariseResponses(subset, pack, now);
    return {
      urgency,
      targetMinutes: pack.crm.sla.firstResponseMinutes[urgency],
      leads: subset.length,
      counts: summary.counts,
      medianMinutes: percentile(summary.minutes, 0.5),
      onTimeShare: summary.onTimeShare,
    };
  });
  return {
    leads: rows.length,
    responded: all.minutes.length,
    counts: all.counts,
    medianMinutes: percentile(all.minutes, 0.5),
    p90Minutes: percentile(all.minutes, 0.9),
    onTimeShare: all.onTimeShare,
    overdueShare: share(all.counts.overdue, rows.length),
    byUrgency,
  };
}

// -- No-shows ------------------------------------------------------------------------------------------

export interface NoShowMetric {
  attended: number;
  noShow: number;
  /** Ended but nobody marked them attended or missed yet. */
  unmarked: number;
  /** noShow ÷ (attended + noShow). */
  rate: number | null;
}

/**
 * Appointments that started in the range and have already ended, excluding
 * cancelled ones, for individual leads (optionally one offering).
 */
export async function noShows(session: Session, pack: IndustryPack, filters: DashboardFilters): Promise<NoShowMetric> {
  const rows = await asStaff(session, (tx) => {
    const { start, end } = bounds(tx, filters, pack.brand.timeZone);
    return tx<{ status: string; n: number }[]>`
      select a.status, count(*)::int as n
      from public.appointments a
      join public.leads l on l.id = a.lead_id
      where l.lead_type = 'individual'
        and a.status <> 'cancelled'
        and a.starts_at >= ${start} and a.starts_at < ${end}
        and a.ends_at <= now()
        ${filters.offering ? tx`and l.specialty_slug = ${filters.offering}` : tx``}
      group by a.status`;
  });
  const count = (status: string) => rows.find((r) => r.status === status)?.n ?? 0;
  const attended = count('attended');
  const noShow = count('no_show');
  return { attended, noShow, unmarked: count('booked'), rate: share(noShow, attended + noShow) };
}

// -- Staff load -------------------------------------------------------------------------------------

export interface StaffLoadRow {
  id: string;
  name: string;
  role: string;
  capacity: number;
  openLeads: number;
  appointments: number;
  /** openLeads ÷ capacity. */
  load: number | null;
}

/**
 * Open leads assigned to each active bookable expert and care coordinator now,
 * against their capacity (counted as routing counts them: any lead type, not
 * erased, in an open stage), plus their appointments that start in the range.
 */
export async function staffLoad(
  session: Session,
  pack: IndustryPack,
  filters: DashboardFilters,
): Promise<StaffLoadRow[]> {
  const roles = [...new Set<string>([...pack.booking.bookableRoles, 'care_coordinator'])];
  const rows = await asStaff(session, (tx) => {
    const { start, end } = bounds(tx, filters, pack.brand.timeZone);
    const offering = filters.offering ? tx`and l.specialty_slug = ${filters.offering}` : tx``;
    return tx<
      {
        id: string;
        full_name: string;
        role: string;
        capacity: number;
        specialties: string[];
        open_leads: number;
        appointments: number;
      }[]
    >`
      select s.id, s.full_name, s.role, s.capacity, s.specialties,
        (select count(*)::int from public.leads l
          where l.assigned_staff_id = s.id and l.erased_at is null
            and l.stage = any(${stageIds(pack, 'open')}::text[]) ${offering}) as open_leads,
        (select count(*)::int from public.appointments a join public.leads l on l.id = a.lead_id
          where a.staff_id = s.id and a.status <> 'cancelled'
            and a.starts_at >= ${start} and a.starts_at < ${end} ${offering}) as appointments
      from public.staff s
      where s.active and s.role = any(${roles}::text[])
      order by array_position(${roles}::text[], s.role), s.full_name`;
  });
  return rows
    .filter(
      (r) => !filters.offering || r.specialties.includes(filters.offering) || r.open_leads > 0 || r.appointments > 0,
    )
    .map((r) => ({
      id: r.id,
      name: r.full_name,
      role: r.role,
      capacity: r.capacity,
      openLeads: r.open_leads,
      appointments: r.appointments,
      load: share(r.open_leads, r.capacity),
    }));
}

// -- AI call outcomes -----------------------------------------------------------------------------

export const CALL_GROUPS = ['completed', 'escalated', 'abandoned', 'failed'] as const;
export type CallGroup = (typeof CALL_GROUPS)[number];

/** Which group each stored outcome belongs to. `started` calls older than 15 minutes count as abandoned. */
export const CALL_OUTCOME_GROUP: Record<string, CallGroup> = {
  completed: 'completed',
  emergency: 'escalated',
  consent_declined: 'abandoned',
  no_consent: 'abandoned',
  caller_ended: 'abandoned',
  limit_reached: 'abandoned',
  never_finished: 'abandoned',
  error: 'failed',
};

export interface CallOutcomeMetric {
  total: number;
  groups: Record<CallGroup, number>;
  /** Count per stored outcome ("never_finished" for stale started calls). */
  outcomes: { outcome: string; group: CallGroup; calls: number }[];
  /** Started in the last 15 minutes and not finished: not counted yet. */
  inProgress: number;
}

/** Assistant calls started in the range, for individual leads (optionally one offering). */
export async function callOutcomes(
  session: Session,
  pack: IndustryPack,
  filters: DashboardFilters,
): Promise<CallOutcomeMetric> {
  const rows = await asStaff(session, (tx) => {
    const { start, end } = bounds(tx, filters, pack.brand.timeZone);
    return tx<{ outcome: string; calls: number }[]>`
      select case
               when c.status = 'started' and c.started_at >= now() - interval '15 minutes' then 'in_progress'
               when c.status = 'started' then 'never_finished'
               else coalesce(c.outcome, 'error')
             end as outcome,
             count(*)::int as calls
      from public.call_sessions c
      join public.leads l on l.id = c.lead_id
      where l.lead_type = 'individual'
        and c.started_at >= ${start} and c.started_at < ${end}
        ${filters.offering ? tx`and l.specialty_slug = ${filters.offering}` : tx``}
      group by 1
      order by 2 desc, 1`;
  });
  const groups: Record<CallGroup, number> = { completed: 0, escalated: 0, abandoned: 0, failed: 0 };
  const outcomes: CallOutcomeMetric['outcomes'] = [];
  let inProgress = 0;
  for (const row of rows) {
    if (row.outcome === 'in_progress') {
      inProgress += row.calls;
      continue;
    }
    const group = CALL_OUTCOME_GROUP[row.outcome] ?? 'failed';
    groups[group] += row.calls;
    outcomes.push({ outcome: row.outcome, group, calls: row.calls });
  }
  const total = CALL_GROUPS.reduce((sum, g) => sum + groups[g], 0);
  return { total, groups, outcomes, inProgress };
}

// -- Lead sources --------------------------------------------------------------------------------

export interface SourceRow {
  source: string;
  leads: number;
  booked: number;
  won: number;
  /** won ÷ leads. */
  conversion: number | null;
}

/**
 * Per `leads.source` in the cohort: leads, how many were ever booked (were in
 * the pack's booked stage at some point, or have a non-cancelled appointment)
 * and how many ever reached a won stage.
 */
export async function sourcePerformance(
  session: Session,
  pack: IndustryPack,
  filters: DashboardFilters,
): Promise<SourceRow[]> {
  const rows = await asStaff(
    session,
    (tx) => tx<{ source: string; leads: number; booked: number; won: number }[]>`
      with scope as (${cohort(tx, filters, pack.brand.timeZone)}),
      visited as (
        select s.id, s.stage as stage_id from scope s
        union
        select e.lead_id, e.payload ->> 'to' from public.lead_events e
          join scope s on s.id = e.lead_id where e.type = 'stage.changed'
      ),
      per_lead as (
        select s.id, s.source,
          exists (select 1 from visited v where v.id = s.id and v.stage_id = ${pack.booking.bookedStageId})
            or exists (select 1 from public.appointments a where a.lead_id = s.id and a.status <> 'cancelled')
            as booked,
          exists (select 1 from visited v where v.id = s.id and v.stage_id = any(${stageIds(pack, 'won')}::text[]))
            as won
        from scope s
      )
      select source, count(*)::int as leads,
             count(*) filter (where booked)::int as booked,
             count(*) filter (where won)::int as won
      from per_lead
      group by source
      order by leads desc, source`,
  );
  return rows.map((r) => ({ ...r, conversion: share(r.won, r.leads) }));
}

// -- Conversion over time ------------------------------------------------------------------------

export interface WeekRow {
  /** Monday of the week, local day. */
  week: string;
  leads: number;
  won: number;
}

/** Leads created per week (Monday start, local time) and how many of them have reached a won stage. */
export async function conversionByWeek(
  session: Session,
  pack: IndustryPack,
  filters: DashboardFilters,
): Promise<WeekRow[]> {
  const timeZone = pack.brand.timeZone;
  return asStaff(
    session,
    (tx) => tx<WeekRow[]>`
      with scope as (${cohort(tx, filters, timeZone)}),
      won as (
        select distinct s.id from scope s
        where s.stage = any(${stageIds(pack, 'won')}::text[])
           or exists (select 1 from public.lead_events e
                      where e.lead_id = s.id and e.type = 'stage.changed'
                        and e.payload ->> 'to' = any(${stageIds(pack, 'won')}::text[]))
      )
      select to_char(date_trunc('week', s.created_at at time zone ${timeZone}), 'YYYY-MM-DD') as week,
             count(*)::int as leads,
             count(w.id)::int as won
      from scope s left join won w on w.id = s.id
      group by 1
      order by 1`,
  );
}

// -- Everything for the page -----------------------------------------------------------------------

export interface Dashboard {
  funnel: FunnelMetric;
  firstResponse: FirstResponseMetric;
  noShows: NoShowMetric;
  staffLoad: StaffLoadRow[];
  calls: CallOutcomeMetric;
  sources: SourceRow[];
  weeks: WeekRow[];
}

export async function loadDashboard(
  session: Session,
  pack: IndustryPack,
  filters: DashboardFilters,
): Promise<Dashboard> {
  const [funnelMetric, response, missed, load, calls, sources, weeks] = await Promise.all([
    funnel(session, pack, filters),
    firstResponse(session, pack, filters),
    noShows(session, pack, filters),
    staffLoad(session, pack, filters),
    callOutcomes(session, pack, filters),
    sourcePerformance(session, pack, filters),
    conversionByWeek(session, pack, filters),
  ]);
  return {
    funnel: funnelMetric,
    firstResponse: response,
    noShows: missed,
    staffLoad: load,
    calls,
    sources,
    weeks,
  };
}
