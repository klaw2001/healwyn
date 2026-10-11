import { localDate, addDays } from '@healwyn/core';
import { buttonClasses, cx } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart, ColumnChart, DataTable, Legend, PartsBar, Panel, type Segment } from '@/components/dashboard/charts';
import { PageTitle } from '@/components/shell';
import {
  biggestDrop,
  DASH,
  formatCount,
  formatLongDay,
  formatMinutes,
  formatPercent,
  formatShortDay,
  plural,
  resolveRange,
  share,
  weekStarts,
} from '@/lib/dashboard-math';
import { packLabels, sourceLabel } from '@/lib/format';
import { requireCapability } from '@/lib/server/auth';
import { CALL_GROUPS, loadDashboard, SLA_BUCKETS, type CallGroup, type SlaBucket } from '@/lib/server/dashboard';
import { packFor } from '@/lib/server/pack';

export const metadata: Metadata = { title: 'Dashboard' };

const SLA_LABELS: Record<SlaBucket, string> = {
  met: 'Answered on time',
  met_late: 'Answered late',
  waiting: 'Waiting, still within target',
  overdue: 'Waiting past target',
};
const SLA_TONES = { met: 'success', met_late: 'accent', waiting: 'muted', overdue: 'danger' } as const;

const URGENCY_LABELS: Record<string, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

const CALL_GROUP_LABELS: Record<CallGroup, string> = {
  completed: 'Completed (qualified)',
  escalated: 'Escalated (emergency advice)',
  abandoned: 'Abandoned (did not finish)',
  failed: 'Failed',
};
const CALL_OUTCOME_LABELS: Record<string, string> = {
  completed: 'Qualified',
  emergency: 'Emergency advice given',
  consent_declined: 'Caller declined',
  no_consent: 'No clear consent',
  caller_ended: 'Caller ended early',
  limit_reached: 'Time limit reached',
  never_finished: 'Never finished',
  error: 'Failed',
};

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
      <dd className="mt-1 text-xs text-ink-muted">{detail}</dd>
    </div>
  );
}

/** The manager's dashboard: computed from the data on every request; each number is defined in docs/METRICS.md. */
export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  const session = await requireCapability('screen.dashboard');
  const pack = packFor(session);
  const { stageLabel, specialtyLabel, roleLabel } = packLabels(pack);
  const tz = pack.brand.timeZone;
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

  const today = localDate(new Date(), tz);
  const range = resolveRange({ from: one(params.from), to: one(params.to) }, today);
  const requestedOffering = one(params.offering) ?? '';
  const offering = pack.offerings.some((o) => o.slug === requestedOffering) ? requestedOffering : null;
  const filters = { from: range.from, to: range.to, offering };
  const data = await loadDashboard(session, pack, filters);

  const offeringLabel = pack.site.team.offeringLabel;
  const wonStage = pack.stages.find((s) => s.kind === 'won');
  const wonLabel = wonStage?.label ?? 'Won';
  const bookingNoun = pack.booking.noun;
  const leadsLabel = (count: number) => plural(count, 'lead');

  // -- Headline numbers ---------------------------------------------------------------------------
  const { funnel, firstResponse, noShows, calls, sources, staffLoad } = data;
  const wonCount = funnel.rows.at(-1)?.reached ?? 0;
  const judged = firstResponse.counts.met + firstResponse.counts.met_late + firstResponse.counts.overdue;
  const marked = noShows.attended + noShows.noShow;

  // -- Funnel ---------------------------------------------------------------------------------------
  const drop = biggestDrop(funnel.rows);
  const funnelTakeaway =
    funnel.total === 0
      ? 'No leads were created in this period.'
      : `${formatCount(wonCount)} of ${leadsLabel(funnel.total)} (${formatPercent(share(wonCount, funnel.total))}) reached ${wonLabel}. ` +
        (drop
          ? `The biggest drop-off is between ${drop.from.label} and ${drop.to.label}: ${formatCount(drop.from.dropped)} of ${formatCount(drop.from.reached)} (${formatPercent(drop.from.dropRate)}) went no further.`
          : 'No lead stopped between stages.');

  // -- First response -------------------------------------------------------------------------------
  const responseTakeaway =
    firstResponse.leads === 0
      ? 'No leads were created in this period.'
      : firstResponse.responded === 0
        ? `No lead in this period has had a first response yet; ${formatCount(firstResponse.counts.overdue)} ${firstResponse.counts.overdue === 1 ? 'is' : 'are'} waiting past the target.`
        : `Half of the answered leads heard back within ${formatMinutes(firstResponse.medianMinutes)}, and ${formatPercent(firstResponse.onTimeShare)} of leads with a known result were answered on time. ` +
          (firstResponse.counts.overdue
            ? `${formatCount(firstResponse.counts.overdue)} still ${firstResponse.counts.overdue === 1 ? 'waits' : 'wait'} past the target.`
            : 'Nobody is waiting past the target.');

  // -- No-shows -------------------------------------------------------------------------------------
  const unmarkedNote = noShows.unmarked
    ? ` ${formatCount(noShows.unmarked)} finished ${noShows.unmarked === 1 ? bookingNoun : `${bookingNoun}s`} still ${noShows.unmarked === 1 ? 'needs' : 'need'} marking.`
    : '';
  const noShowTakeaway =
    marked === 0
      ? `No finished ${bookingNoun}s were marked attended or missed in this period.${unmarkedNote}`
      : `${formatCount(noShows.noShow)} of ${formatCount(marked)} marked ${bookingNoun}s were missed (${formatPercent(noShows.rate)}).${unmarkedNote}`;

  // -- Staff load -----------------------------------------------------------------------------------
  const busiest = [...staffLoad].sort((a, b) => (b.load ?? 0) - (a.load ?? 0))[0];
  const overCapacity = staffLoad.filter((s) => s.openLeads > s.capacity).length;
  const loadTakeaway =
    !busiest || busiest.openLeads === 0
      ? 'Nobody has open leads assigned right now.'
      : `${busiest.name} is the most loaded: ${formatCount(busiest.openLeads)} open leads against a capacity of ${formatCount(busiest.capacity)} (${formatPercent(busiest.load)}). ` +
        (overCapacity ? `${plural(overCapacity, 'person', 'people')} over capacity.` : 'Nobody is over capacity.');
  const loadMax = Math.max(1, ...staffLoad.map((s) => Math.max(s.openLeads, s.capacity) / s.capacity));

  // -- Calls ----------------------------------------------------------------------------------------
  const callsTakeaway =
    calls.total === 0
      ? `The assistant finished no calls in this period.${calls.inProgress ? ` ${formatCount(calls.inProgress)} in progress.` : ''}`
      : `${formatCount(calls.groups.completed)} of ${plural(calls.total, 'call')} (${formatPercent(share(calls.groups.completed, calls.total))}) ended with the lead qualified; ` +
        `${formatCount(calls.groups.abandoned)} did not finish and ${formatCount(calls.groups.escalated)} ${calls.groups.escalated === 1 ? 'was' : 'were'} escalated to emergency advice.`;
  const callMax = Math.max(0, ...CALL_GROUPS.map((g) => calls.groups[g]));

  // -- Sources --------------------------------------------------------------------------------------
  const sourceMax = Math.max(0, ...sources.map((s) => s.leads));
  const topSource = sources[0];
  const bestSource = [...sources].sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0) || b.leads - a.leads)[0];
  const sourcesTakeaway = !topSource
    ? 'No leads were created in this period.'
    : sources.length === 1
      ? `Every lead came from ${sourceLabel(topSource.source)}; ${formatPercent(topSource.conversion)} reached ${wonLabel}.`
      : `${sourceLabel(topSource.source)} brought the most leads (${formatCount(topSource.leads)}). ` +
        (bestSource && (bestSource.conversion ?? 0) > 0
          ? bestSource.source === topSource.source
            ? `It also converted best: ${formatPercent(bestSource.conversion)} reached ${wonLabel}.`
            : `${sourceLabel(bestSource.source)} converted best: ${formatPercent(bestSource.conversion)} reached ${wonLabel}.`
          : `No source has a lead at ${wonLabel} yet.`);

  // -- Weeks ----------------------------------------------------------------------------------------
  const weeks = weekStarts(range.from, range.to).map((week) => {
    const row = data.weeks.find((w) => w.week === week);
    return { week, leads: row?.leads ?? 0, won: row?.won ?? 0 };
  });
  const weekLeads = weeks.reduce((sum, w) => sum + w.leads, 0);
  const weekWon = weeks.reduce((sum, w) => sum + w.won, 0);
  const busiestWeek = [...weeks].sort((a, b) => b.leads - a.leads)[0];
  const weeksTakeaway =
    weekLeads === 0
      ? 'No leads were created in this period.'
      : `${formatCount(weekWon)} of ${leadsLabel(weekLeads)} (${formatPercent(share(weekWon, weekLeads))}) have reached ${wonLabel} so far. ` +
        (busiestWeek
          ? `The busiest week started ${formatShortDay(busiestWeek.week)}, with ${leadsLabel(busiestWeek.leads)}.`
          : '');

  const rangeLabel = `${formatLongDay(range.from)} to ${formatLongDay(range.to)}`;
  const preset = (days: number) => {
    const q = new URLSearchParams({ from: addDays(today, -(days - 1)), to: today });
    if (offering) q.set('offering', offering);
    return `/dashboard?${q.toString()}`;
  };
  const control =
    'min-h-12 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-base text-ink focus-visible:border-primary';
  const field = 'grid min-w-0 content-end gap-1 text-sm font-semibold';
  const funnelSegments = (reached: number, kind: 'open' | 'won'): Segment[] => [
    { key: 'reached', label: 'Reached', value: reached, tone: kind === 'won' ? 'success' : 'primary' },
  ];

  return (
    <div data-tour="dashboard">
      <PageTitle
        title="Dashboard"
        description="How leads move from enquiry to a result, worked out from the data each time the page loads. Demo data is synthetic."
      />
      <div className="grid gap-6 px-4 py-6 sm:px-8">
        <form method="get" action="/dashboard" aria-label="Dashboard filters" className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className={field}>
              From
              <input name="from" type="date" defaultValue={range.from} className={control} />
            </label>
            <label className={field}>
              To
              <input name="to" type="date" defaultValue={range.to} className={control} />
            </label>
            <label className={cx(field, 'col-span-2 md:col-span-1')}>
              {offeringLabel}
              <select name="offering" defaultValue={offering ?? ''} className={control}>
                <option value="">Any</option>
                {pack.offerings.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="col-span-2 flex items-end gap-2 md:col-span-1">
              <button type="submit" className={buttonClasses({ size: 'md' })}>
                Apply
              </button>
              <Link href="/dashboard" className={buttonClasses({ size: 'md', variant: 'ghost' })}>
                Reset
              </Link>
            </div>
          </div>
          <nav aria-label="Quick date ranges" className="flex flex-wrap gap-2 text-sm">
            {[7, 30, 90].map((days) => (
              <Link
                key={days}
                href={preset(days)}
                className="inline-flex min-h-12 items-center rounded-full border border-line-strong px-4 font-semibold text-primary hover:bg-primary-soft"
              >
                Last {days} days
              </Link>
            ))}
          </nav>
        </form>

        <div>
          <p className="text-sm" data-testid="dashboard-scope">
            Leads created <strong>{rangeLabel}</strong> (India time) · {offeringLabel}:{' '}
            <strong>{offering ? specialtyLabel(offering) : 'any'}</strong>. Partner enquiries are left out. Definitions
            and queries: <code>docs/METRICS.md</code>.
          </p>
          {range.notice ? (
            <p role="status" className="mt-1 text-sm text-accent-ink">
              {range.notice}
            </p>
          ) : null}
        </div>

        <section aria-labelledby="kpis-title">
          <h2 id="kpis-title" className="sr-only">
            Key numbers
          </h2>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Leads created" value={formatCount(funnel.total)} detail={rangeLabel} />
            <Kpi
              label={`Reached ${wonLabel}`}
              value={formatCount(wonCount)}
              detail={`${formatPercent(share(wonCount, funnel.total))} of leads created`}
            />
            <Kpi
              label="First response on time"
              value={formatPercent(firstResponse.onTimeShare)}
              detail={judged ? `of ${leadsLabel(judged)} with a known result` : 'No result yet'}
            />
            <Kpi
              label="Median first response"
              value={formatMinutes(firstResponse.medianMinutes)}
              detail={
                firstResponse.p90Minutes === null
                  ? 'No responses yet'
                  : `9 in 10 within ${formatMinutes(firstResponse.p90Minutes)}`
              }
            />
            <Kpi
              label="No-show rate"
              value={formatPercent(noShows.rate)}
              detail={marked ? `${formatCount(noShows.noShow)} of ${formatCount(marked)} marked` : 'None marked yet'}
            />
            <Kpi
              label="Assistant calls qualified"
              value={formatPercent(share(calls.groups.completed, calls.total))}
              detail={
                calls.total ? `${formatCount(calls.groups.completed)} of ${plural(calls.total, 'call')}` : 'No calls'
              }
            />
          </dl>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            id="funnel"
            title="Funnel by stage"
            takeaway={funnelTakeaway}
            table={
              <DataTable
                caption="Leads that reached each stage, with drop-off to the next stage"
                head={['Stage', 'Reached', 'Of all leads', 'Went no further', 'Drop-off']}
                rows={[
                  ...funnel.rows.map((row) => [
                    row.label,
                    formatCount(row.reached),
                    formatPercent(row.ofTotal),
                    row.dropped === null ? DASH : formatCount(row.dropped),
                    formatPercent(row.dropRate),
                  ]),
                  [
                    `Now in a lost stage`,
                    formatCount(funnel.lost),
                    formatPercent(share(funnel.lost, funnel.total)),
                    DASH,
                    DASH,
                  ],
                ]}
              />
            }
          >
            {funnel.total ? (
              <>
                <BarChart
                  label={`Funnel: ${funnel.rows.map((r) => `${r.label} ${r.reached}`).join(', ')}, out of ${funnel.total} leads.`}
                  max={funnel.total}
                  rows={funnel.rows.map((row) => ({
                    key: row.id,
                    label: row.label,
                    segments: funnelSegments(row.reached, row.kind),
                    value: (
                      <>
                        <span className="font-semibold">{formatCount(row.reached)}</span>{' '}
                        <span className="text-ink-muted">· {formatPercent(row.ofTotal)}</span>
                      </>
                    ),
                    title: `${row.label}: ${row.reached} of ${funnel.total} leads`,
                    note: row.dropped
                      ? `${formatCount(row.dropped)} (${formatPercent(row.dropRate)}) went no further`
                      : undefined,
                  }))}
                />
                <p className="mt-3 text-sm text-ink-muted">
                  {formatCount(funnel.lost)} of these leads ({formatPercent(share(funnel.lost, funnel.total))}) are now
                  in{' '}
                  {pack.stages
                    .filter((s) => s.kind === 'lost')
                    .map((s) => s.label)
                    .join(' or ')}
                  .
                </p>
              </>
            ) : null}
          </Panel>

          <Panel
            id="first-response"
            title="First response against target"
            takeaway={responseTakeaway}
            table={
              <DataTable
                caption="First response by urgency, against the target for each urgency"
                head={['Urgency', 'Target', 'Leads', 'On time', 'Late', 'Waiting', 'Past target', 'Median']}
                rows={[
                  ...firstResponse.byUrgency.map((row) => [
                    URGENCY_LABELS[row.urgency] ?? row.urgency,
                    formatMinutes(row.targetMinutes),
                    formatCount(row.leads),
                    formatCount(row.counts.met),
                    formatCount(row.counts.met_late),
                    formatCount(row.counts.waiting),
                    formatCount(row.counts.overdue),
                    formatMinutes(row.medianMinutes),
                  ]),
                  [
                    'All',
                    DASH,
                    formatCount(firstResponse.leads),
                    formatCount(firstResponse.counts.met),
                    formatCount(firstResponse.counts.met_late),
                    formatCount(firstResponse.counts.waiting),
                    formatCount(firstResponse.counts.overdue),
                    formatMinutes(firstResponse.medianMinutes),
                  ],
                ]}
              />
            }
          >
            {firstResponse.leads ? (
              <>
                <PartsBar
                  label={`First response: ${SLA_BUCKETS.map((b) => `${SLA_LABELS[b]} ${firstResponse.counts[b]}`).join(', ')}.`}
                  segments={SLA_BUCKETS.map((b) => ({
                    key: b,
                    label: SLA_LABELS[b],
                    value: firstResponse.counts[b],
                    tone: SLA_TONES[b],
                  }))}
                />
                <p className="mt-3 text-sm text-ink-muted">
                  Median {formatMinutes(firstResponse.medianMinutes)} · 90th percentile{' '}
                  {formatMinutes(firstResponse.p90Minutes)} · targets:{' '}
                  {firstResponse.byUrgency
                    .map(
                      (r) =>
                        `${(URGENCY_LABELS[r.urgency] ?? r.urgency).toLowerCase()} ${formatMinutes(r.targetMinutes)}`,
                    )
                    .join(', ')}
                  .
                </p>
              </>
            ) : null}
          </Panel>

          <Panel
            id="no-shows"
            title={`Missed ${bookingNoun}s`}
            takeaway={noShowTakeaway}
            table={
              <DataTable
                caption={`Finished ${bookingNoun}s that started in the period, by status`}
                head={['Status', `${capitalise(bookingNoun)}s`]}
                rows={[
                  ['Attended', formatCount(noShows.attended)],
                  ['Missed (no-show)', formatCount(noShows.noShow)],
                  ['Not marked yet', formatCount(noShows.unmarked)],
                  ['No-show rate', formatPercent(noShows.rate)],
                ]}
              />
            }
          >
            {marked + noShows.unmarked ? (
              <PartsBar
                label={`${capitalise(bookingNoun)}s: attended ${noShows.attended}, missed ${noShows.noShow}, not marked ${noShows.unmarked}.`}
                segments={[
                  { key: 'attended', label: 'Attended', value: noShows.attended, tone: 'primary' },
                  { key: 'missed', label: 'Missed', value: noShows.noShow, tone: 'accent' },
                  { key: 'unmarked', label: 'Not marked yet', value: noShows.unmarked, tone: 'muted' },
                ]}
              />
            ) : null}
          </Panel>

          <Panel
            id="calls"
            title="AI assistant call outcomes"
            takeaway={callsTakeaway}
            table={
              <DataTable
                caption="Assistant calls started in the period, by outcome"
                head={['Outcome', 'Group', 'Calls']}
                rows={[
                  ...calls.outcomes.map((o) => [
                    CALL_OUTCOME_LABELS[o.outcome] ?? o.outcome,
                    CALL_GROUP_LABELS[o.group],
                    formatCount(o.calls),
                  ]),
                  ['In progress (not counted)', DASH, formatCount(calls.inProgress)],
                ]}
              />
            }
          >
            {calls.total ? (
              <BarChart
                label={`Assistant calls: ${CALL_GROUPS.map((g) => `${CALL_GROUP_LABELS[g]} ${calls.groups[g]}`).join(', ')}.`}
                max={callMax}
                rows={CALL_GROUPS.map((group) => ({
                  key: group,
                  label: CALL_GROUP_LABELS[group],
                  segments: [
                    { key: group, label: CALL_GROUP_LABELS[group], value: calls.groups[group], tone: 'primary' },
                  ],
                  value: (
                    <>
                      <span className="font-semibold">{formatCount(calls.groups[group])}</span>{' '}
                      <span className="text-ink-muted">· {formatPercent(share(calls.groups[group], calls.total))}</span>
                    </>
                  ),
                  title: `${CALL_GROUP_LABELS[group]}: ${calls.groups[group]} of ${calls.total} calls`,
                }))}
              />
            ) : null}
          </Panel>

          <Panel
            id="staff-load"
            title="Team load"
            wide
            takeaway={loadTakeaway}
            table={
              <DataTable
                caption="Open leads against capacity, and appointments in the period, per person"
                head={['Person', 'Role', 'Open leads', 'Capacity', 'Load', `${capitalise(bookingNoun)}s in period`]}
                rows={staffLoad.map((s) => [
                  s.name,
                  roleLabel(s.role),
                  formatCount(s.openLeads),
                  formatCount(s.capacity),
                  formatPercent(s.load),
                  formatCount(s.appointments),
                ])}
              />
            }
          >
            {staffLoad.length ? (
              <BarChart
                label={`Team load: ${staffLoad.map((s) => `${s.name} ${s.openLeads} of ${s.capacity}`).join(', ')}.`}
                max={loadMax}
                marker={{ at: 1, label: 'full capacity' }}
                rows={staffLoad.map((s) => {
                  const ratio = s.openLeads / s.capacity;
                  const tone = ratio > 1 ? 'danger' : ratio >= 0.8 ? 'accent' : 'primary';
                  const status = ratio > 1 ? 'over capacity' : ratio >= 0.8 ? 'near capacity' : null;
                  return {
                    key: s.id,
                    label: s.name,
                    sublabel: `${roleLabel(s.role)} · ${plural(s.appointments, bookingNoun)} in period`,
                    segments: [{ key: 'open', label: 'Open leads', value: ratio, tone }],
                    value: (
                      <>
                        <span className="font-semibold">
                          {s.openLeads} of {s.capacity}
                        </span>
                        {status ? <span className="block text-xs text-ink-muted">{status}</span> : null}
                      </>
                    ),
                    title: `${s.name}: ${s.openLeads} open leads, capacity ${s.capacity}, ${s.appointments} ${bookingNoun}s in period`,
                  };
                })}
              />
            ) : null}
            <Legend
              items={[
                { key: 'ok', label: 'Under 80% of capacity', tone: 'primary' },
                { key: 'near', label: 'Near capacity (80% or more)', tone: 'accent' },
                { key: 'over', label: 'Over capacity', tone: 'danger' },
              ]}
            />
          </Panel>

          <Panel
            id="sources"
            title="Lead sources"
            takeaway={sourcesTakeaway}
            table={
              <DataTable
                caption="Leads, bookings and conversions per source"
                head={['Source', 'Leads', 'Booked', 'Booked %', `Reached ${wonLabel}`, 'Conversion']}
                rows={sources.map((s) => [
                  sourceLabel(s.source),
                  formatCount(s.leads),
                  formatCount(s.booked),
                  formatPercent(share(s.booked, s.leads)),
                  formatCount(s.won),
                  formatPercent(s.conversion),
                ])}
              />
            }
          >
            {sources.length ? (
              <>
                <BarChart
                  label={`Lead sources: ${sources.map((s) => `${sourceLabel(s.source)} ${s.leads} leads, ${s.won} reached ${wonLabel}`).join('; ')}.`}
                  max={sourceMax}
                  rows={sources.map((s) => ({
                    key: s.source,
                    label: sourceLabel(s.source),
                    sublabel: `${formatCount(s.booked)} booked`,
                    segments: [
                      { key: 'won', label: `Reached ${wonLabel}`, value: s.won, tone: 'primary' },
                      { key: 'rest', label: 'Not yet', value: s.leads - s.won, tone: 'muted' },
                    ],
                    value: (
                      <>
                        <span className="font-semibold">{formatCount(s.leads)}</span>{' '}
                        <span className="text-ink-muted">· {formatPercent(s.conversion)} won</span>
                      </>
                    ),
                    title: `${sourceLabel(s.source)}: ${s.leads} leads, ${s.booked} booked, ${s.won} reached ${wonLabel}`,
                  }))}
                />
                <Legend
                  items={[
                    { key: 'won', label: `Reached ${wonLabel}`, tone: 'primary' },
                    { key: 'rest', label: 'Not yet', tone: 'muted' },
                  ]}
                />
              </>
            ) : null}
          </Panel>

          <Panel
            id="conversion"
            title="Conversion over time"
            takeaway={weeksTakeaway}
            table={
              <DataTable
                caption={`Leads created per week and how many reached ${wonLabel}`}
                head={['Week starting', 'Leads created', `Reached ${wonLabel}`, 'Conversion']}
                rows={weeks.map((w) => [
                  formatLongDay(w.week),
                  formatCount(w.leads),
                  formatCount(w.won),
                  formatPercent(share(w.won, w.leads)),
                ])}
              />
            }
          >
            {weekLeads ? (
              <>
                <ColumnChart
                  label={`Leads created per week: ${weeks.map((w) => `week of ${formatShortDay(w.week)} ${w.leads} created, ${w.won} reached ${wonLabel}`).join('; ')}.`}
                  unit="Leads created"
                  columns={weeks.map((w) => ({
                    key: w.week,
                    day: w.week,
                    title: `Week of ${formatShortDay(w.week)}: ${w.leads} leads, ${w.won} reached ${wonLabel}`,
                    segments: [
                      { key: 'won', label: `Reached ${wonLabel}`, value: w.won, tone: 'primary' },
                      { key: 'rest', label: 'Not yet', value: w.leads - w.won, tone: 'muted' },
                    ],
                  }))}
                />
                <Legend
                  items={[
                    { key: 'won', label: `Reached ${wonLabel}`, tone: 'primary' },
                    { key: 'rest', label: 'Not yet', tone: 'muted' },
                  ]}
                />
                <p className="mt-2 text-xs text-ink-muted">
                  Recent weeks have had less time to convert. The first and last weeks may be partly outside the range;
                  only leads created inside it count.
                </p>
              </>
            ) : null}
          </Panel>
        </div>
        <p className="text-xs text-ink-muted">
          Stage names come from the {pack.label.toLowerCase()} pipeline; {stageLabel(pack.initialStageId)} is where
          every lead starts.
        </p>
      </div>
    </div>
  );
}
