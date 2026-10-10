import { getActivePack, renderTemplate } from '@healwyn/core';
import { Badge } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChannelBadge } from '@/components/badges';
import { PageTitle } from '@/components/shell';
import { formatDateTime, formatRelative, stageLabel, stopReasonLabel } from '@/lib/format';
import { requireCapability } from '@/lib/server/auth';
import { listEnrollments, sequenceStats } from '@/lib/server/queries';
import { PauseToggle } from './pause-toggle';

export const metadata: Metadata = { title: 'Sequences' };

const pack = getActivePack();

function delayLabel(minutes: number): string {
  if (minutes === 0) return 'Straight away';
  if (minutes < 60) return `After ${minutes} min`;
  if (minutes < 1440) return `After ${Math.round(minutes / 60)} h`;
  const days = Math.round(minutes / 1440);
  return `After ${days} day${days === 1 ? '' : 's'}`;
}

const sample = {
  fullName: 'Ananya Sample',
  specialty: 'Dermatology',
  reference: 'ABCD-1234',
  unsubscribeUrl: 'https://…/unsubscribe',
};

export default async function SequencesPage() {
  const session = await requireCapability('screen.sequences');
  const [stats, enrollments] = await Promise.all([sequenceStats(session), listEnrollments(session)]);
  const now = new Date();
  const statFor = (id: string) => stats.find((s) => s.sequence_id === id);

  return (
    <>
      <PageTitle
        title="Nurture sequences"
        description="Follow-ups start when a lead enters a stage and stop on a reply, an unsubscribe, a consent withdrawal or a stage that cancels them. Email is real; SMS and WhatsApp are simulated."
      />
      <div className="grid gap-6 px-4 py-6 sm:px-8">
        <ul className="grid gap-4 xl:grid-cols-2">
          {pack.sequences.map((sequence) => {
            const stat = statFor(sequence.id);
            const paused = stat?.paused ?? false;
            return (
              <li key={sequence.id}>
                <article
                  aria-labelledby={`seq-${sequence.id}`}
                  className="h-full rounded-lg border border-line bg-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 id={`seq-${sequence.id}`} className="text-xl">
                        {sequence.name}
                      </h2>
                      <p className="mt-1 text-sm text-ink-muted">{sequence.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {paused ? <Badge tone="accent">Paused</Badge> : <Badge tone="teal">Running</Badge>}
                      <PauseToggle sequenceId={sequence.id} name={sequence.name} paused={paused} />
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    {[
                      ['Active', stat?.active ?? 0],
                      ['Completed', stat?.completed ?? 0],
                      ['Stopped', stat?.stopped ?? 0],
                      ['Messages', stat?.messages ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-surface-muted p-2.5">
                        <dt className="text-xs text-ink-muted">{label}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-ink-muted">
                    Starts on: {sequence.enrolOnStage ? stageLabel(sequence.enrolOnStage) : 'started by staff'} · Stops
                    on: {sequence.cancelOnStages.map(stageLabel).join(', ')}
                    {stat?.next_due ? ` · Next send ${formatRelative(stat.next_due, now)}` : ''}
                  </p>
                  <ol className="mt-4 grid gap-2">
                    {sequence.steps.map((step, index) => {
                      const template = pack.crm.templates.find((t) => t.id === step.templateId);
                      const preview = template ? renderTemplate(template, sample) : null;
                      return (
                        <li key={index} className="rounded-md border border-line p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">Step {index + 1}</span>
                            <ChannelBadge channel={step.channel} />
                            <span className="text-ink-muted">{delayLabel(step.delayMinutes)}</span>
                          </div>
                          {preview ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-primary">
                                Preview{preview.subject ? `: ${preview.subject}` : ''}
                              </summary>
                              <p className="mt-2 rounded bg-surface-muted p-2 text-xs whitespace-pre-wrap">
                                {preview.text}
                              </p>
                            </details>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </article>
              </li>
            );
          })}
        </ul>

        <section aria-labelledby="enrolments-title" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="enrolments-title" className="text-xl">
            Enrolments
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Most recent enrolments, active first</caption>
              <thead className="text-left text-ink-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3">
                    Lead
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Sequence
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Status
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Progress
                  </th>
                  <th scope="col" className="py-2">
                    Next send
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id} className="border-b border-line">
                    <td className="py-2 pr-3">
                      <Link href={`/leads/${e.lead_id}`} className="font-semibold hover:underline">
                        {e.lead_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {pack.sequences.find((s) => s.id === e.sequence_id)?.name ?? e.sequence_id}
                    </td>
                    <td className="py-2 pr-3">{e.status === 'stopped' ? stopReasonLabel(e.stop_reason) : e.status}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {e.sent} of {e.total}
                    </td>
                    <td className="py-2" title={e.next_due ? formatDateTime(e.next_due) : undefined}>
                      {e.next_due ? formatRelative(e.next_due, now) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
