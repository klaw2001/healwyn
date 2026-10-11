import { addDays, type PipelineStage } from '@healwyn/core';

/**
 * Pure helpers for the manager dashboard: date ranges, percentiles, shares and
 * the wording of each chart's takeaway. No database, no server-only imports.
 */

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

/** A real calendar date "YYYY-MM-DD" (rejects 2026-02-30). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Whole days from `from` to `to` (0 when equal). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface DateRange {
  from: string;
  to: string;
  /** Set when the requested range was adjusted, in plain words. */
  notice: string | null;
}

/**
 * The dashboard's date range in local (India) days, inclusive. Defaults to the
 * last 30 days ending today; swaps a reversed range; caps it at a year.
 */
export function resolveRange(input: { from?: unknown; to?: unknown }, today: string): DateRange {
  const notices: string[] = [];
  let to = isDay(input.to) ? input.to : today;
  let from = isDay(input.from) ? input.from : addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if ((input.from && !isDay(input.from)) || (input.to && !isDay(input.to))) {
    notices.push('A date was not recognised, so the default was used.');
  }
  if (from > to) {
    [from, to] = [to, from];
    notices.push('The start date was after the end date, so they were swapped.');
  }
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
    from = addDays(to, -(MAX_RANGE_DAYS - 1));
    notices.push('The range was shortened to one year.');
  }
  return { from, to, notice: notices.length ? notices.join(' ') : null };
}

/** Percentile with linear interpolation between ranks (same as SQL percentile_cont). Null when empty. */
export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(1, Math.max(0, p)) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const a = sorted[low]!;
  const b = sorted[high]!;
  return a + (b - a) * (rank - low);
}

/** part ÷ whole, or null when the whole is zero (shown as "—", never NaN). */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export const DASH = '—';

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? DASH : value.toLocaleString('en-IN');
}

/** "42%", "<1%" for small non-zero shares, "—" when there is nothing to divide. */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  if (value > 0 && value < 0.005) return '<1%';
  return `${Math.round(value * 100)}%`;
}

/** "45 min", "3 h 05 min", "2 d 4 h", or "—". */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return DASH;
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  return hours ? `${days} d ${hours} h` : `${days} d`;
}

/** Width of a bar as a CSS percentage of the scale (0 when the scale is empty). */
export function barPercent(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
}

/**
 * A zero-based axis for whole-number counts: a round step (1, 2, 5, 10, 20, 50 …)
 * giving about `count` intervals, and a maximum that is a multiple of the step.
 */
export function axis(highest: number, count = 4): { max: number; ticks: number[] } {
  const rough = Math.max(1, highest) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, ([1, 2, 5, 10].find((m) => m * magnitude >= rough) ?? 10) * magnitude);
  const max = Math.max(step, Math.ceil(highest / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return { max, ticks };
}

// -- Weeks ------------------------------------------------------------------------------------------

/** The Monday on or before a local day (weeks start on Monday, as Postgres date_trunc('week') does). */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** Every week (its Monday) that overlaps the range, in order. */
export function weekStarts(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let week = mondayOf(from); week <= to; week = addDays(week, 7)) weeks.push(week);
  return weeks;
}

const shortDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "7 Sep" for a local day. */
export const formatShortDay = (day: string) => shortDay.format(new Date(`${day}T00:00:00Z`));
/** "7 Sep 2026" for a local day. */
export const formatLongDay = (day: string) => longDay.format(new Date(`${day}T00:00:00Z`));

// -- Funnel -----------------------------------------------------------------------------------------

export interface FunnelStep {
  id: string;
  label: string;
  kind: 'open' | 'won';
}

/**
 * The funnel's steps, from the pack: open stages in pipeline order, then the
 * won stages. Side stages (the no-show stage) are left out; a lead that was in
 * one counts at the step before it. Returns each stage's position too, which
 * the SQL uses to find the furthest step a lead reached.
 */
export function funnelSteps(
  stages: readonly PipelineStage[],
  sideStageIds: readonly string[],
): { steps: FunnelStep[]; positions: { stageId: string; position: number }[] } {
  const steps: FunnelStep[] = [];
  const positions: { stageId: string; position: number }[] = [];
  const ordered = [...stages.filter((s) => s.kind === 'open'), ...stages.filter((s) => s.kind === 'won')];
  for (const stage of ordered) {
    if (sideStageIds.includes(stage.id)) {
      positions.push({ stageId: stage.id, position: Math.max(0, steps.length - 1) });
      continue;
    }
    positions.push({ stageId: stage.id, position: steps.length });
    steps.push({ id: stage.id, label: stage.label, kind: stage.kind === 'won' ? 'won' : 'open' });
  }
  return { steps, positions };
}

export interface FunnelRow extends FunnelStep {
  reached: number;
  /** Share of all leads in the period. */
  ofTotal: number | null;
  /** Leads that reached this step but not the next one. Null for the last step. */
  dropped: number | null;
  /** dropped ÷ reached. */
  dropRate: number | null;
}

export function funnelRows(steps: readonly FunnelStep[], reached: readonly number[]): FunnelRow[] {
  const total = reached[0] ?? 0;
  return steps.map((step, i) => {
    const here = reached[i] ?? 0;
    const next = i + 1 < steps.length ? (reached[i + 1] ?? 0) : null;
    const dropped = next === null ? null : here - next;
    return {
      ...step,
      reached: here,
      ofTotal: share(here, total),
      dropped,
      dropRate: dropped === null ? null : share(dropped, here),
    };
  });
}

/** The pair of consecutive steps that lost the most leads (by count, then by rate). */
export function biggestDrop(rows: readonly FunnelRow[]): { from: FunnelRow; to: FunnelRow } | null {
  let best: { from: FunnelRow; to: FunnelRow } | null = null;
  rows.forEach((row, i) => {
    const next = rows[i + 1];
    if (!next || !row.dropped) return;
    if (
      !best ||
      row.dropped > (best.from.dropped ?? 0) ||
      (row.dropped === best.from.dropped && (row.dropRate ?? 0) > (best.from.dropRate ?? 0))
    ) {
      best = { from: row, to: next };
    }
  });
  return best;
}

/** "1 lead" / "3 leads" with the pack's noun, e.g. "patient". */
export function plural(count: number, noun: string, nouns = `${noun}s`): string {
  return `${count.toLocaleString('en-IN')} ${count === 1 ? noun : nouns}`;
}
