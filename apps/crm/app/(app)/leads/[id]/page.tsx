import {
  can,
  formatLeadReference,
  formatIndianMobile,
  getActivePack,
  OVERRIDE_REASONS,
  renderTemplate,
} from '@healwyn/core';
import { Badge } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Avatar,
  ChannelBadge,
  MessageStatusBadge,
  ScoreBadge,
  SlaBadge,
  StageBadge,
  UrgencyBadge,
} from '@/components/badges';
import { EmptyState } from '@/components/empty-state';
import { SparkIcon } from '@/components/icons';
import {
  AcceptRoutingButton,
  AssignControl,
  EnrolButton,
  ReplyButton,
  StageControl,
  StopEnrollmentButton,
  WithdrawalControl,
} from '@/components/profile/controls';
import { CompleteTaskButton, NoteForm, TaskForm } from '@/components/profile/forms';
import {
  answerLabel,
  assignmentExplanation,
  describeEvent,
  formatDateTime,
  formatRelative,
  indiaDay,
  languageLabel,
  roleLabel,
  sequenceName,
  sourceLabel,
  specialtyLabel,
  stopReasonLabel,
} from '@/lib/format';
import { requireSession } from '@/lib/server/auth';
import { getLeadProfile, listStaff } from '@/lib/server/queries';
import { suggestRouting } from '@/lib/server/routing';

export const metadata: Metadata = { title: 'Lead' };

const pack = getActivePack();

function Panel({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-line bg-surface p-4">
      <h2 id={id} className="font-sans text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function LeadPage({ params }: PageProps<'/leads/[id]'>) {
  const session = await requireSession();
  const { id } = await params;
  const [profile, staff] = await Promise.all([getLeadProfile(session, id), listStaff(session)]);
  if (!profile) notFound();
  const { lead, events, notes, tasks, messages, consents, enrollments, factors } = profile;
  const now = new Date();
  const erased = lead.erased_at !== null;
  const name = lead.full_name ?? 'Erased lead';
  const staffName = (value: unknown) => staff.find((s) => s.id === value)?.full_name ?? 'a colleague';
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const assignable = staff
    .filter((s) => s.role !== 'manager')
    .map((s) => ({ id: s.id, label: `${s.full_name} (${roleLabel(s.role)})` }));
  const allConsents = [...pack.intake.consents, ...pack.partnerIntake.consents];
  const currentConsent = new Map<string, boolean>();
  for (const record of consents) currentConsent.set(record.purpose, record.granted);
  const offeringQuestion = pack.intake.offeringQuestionId;
  const answerEntries = Object.entries(lead.answers).filter(([key]) => key !== offeringQuestion);
  const canFrontDesk = can(session.role, 'lead.assign');
  const stageIsOpen = pack.stages.find((s) => s.id === lead.stage)?.kind === 'open';
  const suggestion = canFrontDesk && !erased && stageIsOpen ? await suggestRouting(session, lead.id) : null;
  const overrideReasons = Object.entries(OVERRIDE_REASONS).map(([value, label]) => ({ value, label }));
  const tomorrowNine = `${indiaDay(new Date(now.getTime() + 86_400_000))}T09:00`;
  const sampleVars = {
    fullName: name,
    specialty: specialtyLabel(lead.specialty_slug),
    reference: formatLeadReference(lead.id),
    unsubscribeUrl: '(unsubscribe link)',
  };

  return (
    <div className="px-4 py-5 sm:px-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/pipeline" className="text-primary underline underline-offset-4">
          Pipeline
        </Link>
        <span aria-hidden="true" className="mx-2 text-ink-muted">
          /
        </span>
        <span aria-current="page">{name}</span>
      </nav>

      <header className="mt-3 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl">{name}</h1>
            <StageBadge stage={lead.stage} />
            <UrgencyBadge urgency={lead.urgency} />
            {lead.lead_type === 'partner' ? <Badge>Partner</Badge> : null}
            {lead.is_demo ? <Badge tone="accent">Demo data</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Ref <span className="font-mono">{formatLeadReference(lead.id)}</span> · received{' '}
            {formatDateTime(lead.created_at)} ({formatRelative(lead.created_at, now)}) · {sourceLabel(lead.source)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SlaBadge
              createdAt={lead.created_at}
              urgency={lead.urgency}
              firstResponseAt={lead.first_response_at}
              now={now}
              showMet
            />
            {lead.opted_out_at ? <Badge>Unsubscribed {formatRelative(lead.opted_out_at, now)}</Badge> : null}
            {lead.last_inbound_at ? (
              <Badge tone="teal">Replied {formatRelative(lead.last_inbound_at, now)}</Badge>
            ) : null}
          </div>
        </div>
        {!erased ? (
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[34rem]">
            <div className="grid gap-1">
              <span className="text-xs font-semibold text-ink-muted">Stage</span>
              <StageControl
                leadId={lead.id}
                leadName={name}
                stage={lead.stage}
                stages={pack.stages.map((s) => ({ id: s.id, label: s.label }))}
              />
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-semibold text-ink-muted">Assigned to</span>
              {canFrontDesk ? (
                <AssignControl
                  leadId={lead.id}
                  assignedStaffId={lead.assigned_staff_id}
                  staff={assignable}
                  suggestedStaffId={suggestion?.staffId ?? null}
                  overrideReasons={overrideReasons}
                />
              ) : (
                <p className="flex min-h-10 items-center gap-2 text-sm">
                  <Avatar name={lead.assignee_name} />
                  {lead.assignee_name ?? 'Unassigned'}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </header>

      {erased ? (
        <div className="mt-6">
          <EmptyState title="This lead’s personal details were erased">
            Erased {formatDateTime(lead.erased_at!)} after consent was withdrawn or the retention period ended. The
            history below holds no personal data.
          </EmptyState>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid min-w-0 content-start gap-6">
          <section
            aria-labelledby="ai-summary"
            className="rounded-lg border border-dashed border-line-strong bg-surface-teal p-4"
          >
            <h2 id="ai-summary" className="flex items-center gap-2 font-sans text-sm font-bold">
              <SparkIcon className="text-primary" /> AI summary
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              No summary yet. When the voice assistant (Phase 3) qualifies this lead, a three-to-five line summary, its
              answers and any safety flags appear here, with the routing explanation.
            </p>
          </section>

          {suggestion ? (
            <section aria-labelledby="routing-title" className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="routing-title" className="font-sans text-sm font-bold">
                  Routing suggestion: <span className="text-primary">{suggestion.staffName ?? 'nobody available'}</span>
                  {suggestion.priority === 'front' ? (
                    <Badge tone="accent" className="ml-2">
                      Front of queue
                    </Badge>
                  ) : null}
                </h2>
                {suggestion.staffId && suggestion.staffId !== lead.assigned_staff_id ? (
                  <AcceptRoutingButton leadId={lead.id} staffName={suggestion.staffName ?? 'suggestion'} />
                ) : suggestion.staffId ? (
                  <span className="text-sm text-ink-muted">Already assigned to the suggested person.</span>
                ) : null}
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink-muted">
                {suggestion.explanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-primary">Score breakdown</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-xs">
                    <caption className="sr-only">Routing scores for each candidate</caption>
                    <thead className="text-ink-muted">
                      <tr>
                        <th scope="col" className="py-1 pr-2 font-semibold">
                          Candidate
                        </th>
                        {['Language', 'Seniority', 'Spare capacity', 'Continuity'].map((h) => (
                          <th key={h} scope="col" className="px-2 py-1 text-right font-semibold">
                            {h}
                          </th>
                        ))}
                        <th scope="col" className="py-1 pl-2 text-right font-semibold">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestion.candidates.map((c) => (
                        <tr key={c.staffId} className="border-t border-line">
                          <th scope="row" className="py-1 pr-2 font-semibold">
                            {c.name}
                            {c.excludedBecause ? (
                              <span className="block font-normal text-ink-muted">{c.excludedBecause}</span>
                            ) : null}
                          </th>
                          {c.factors.map((f) => (
                            <td key={f.id} className="px-2 py-1 text-right" title={f.label}>
                              {f.points} / {f.max}
                            </td>
                          ))}
                          <td className="py-1 pl-2 text-right font-semibold">{c.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          ) : null}

          {!erased ? <NoteForm leadId={lead.id} templates={[...pack.crm.noteTemplates]} /> : null}

          <section aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="text-xl">
              Timeline
            </h2>
            <ol className="mt-3 border-l-2 border-line pl-5">
              {events.map((event) => {
                const note = event.type === 'note.added' ? noteById.get(String(event.payload.note_id)) : undefined;
                const why = assignmentExplanation(event.type, event.payload);
                return (
                  <li key={event.id} className="relative pb-4">
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-surface bg-primary"
                    />
                    <p className="text-sm">
                      <span className="font-semibold">{describeEvent(event.type, event.payload, staffName)}</span>
                      {event.actor_name ? <span className="text-ink-muted"> · {event.actor_name}</span> : null}
                    </p>
                    <p className="text-xs text-ink-muted">
                      <time dateTime={new Date(event.created_at).toISOString()}>
                        {formatDateTime(event.created_at)}
                      </time>
                    </p>
                    {why.length ? (
                      <ul className="mt-1 list-disc pl-4 text-xs text-ink-muted">
                        {why.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                    {note ? (
                      <p className="mt-1 rounded-md bg-surface-muted px-3 py-2 text-sm whitespace-pre-wrap">
                        {note.body}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="grid min-w-0 content-start gap-4" aria-label="Lead details">
          <Panel title="Contact" id="contact-title">
            <dl>
              <Row label="Phone">{lead.phone ? formatIndianMobile(lead.phone) : '–'}</Row>
              <Row label="Email">{lead.email ?? '–'}</Row>
              <Row label="Language">{languageLabel(lead.preferred_language)}</Row>
            </dl>
            {!erased ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <ReplyButton leadId={lead.id} />
              </div>
            ) : null}
          </Panel>

          <Panel title="Enquiry" id="enquiry-title">
            <dl>
              <Row label="Looking for">{specialtyLabel(lead.specialty_slug)}</Row>
              {answerEntries.map(([key, value]) => (
                <Row key={key} label={pack.intake.questions.find((q) => q.id === key)?.label.replace(/\?$/, '') ?? key}>
                  {answerLabel(key, value)}
                </Row>
              ))}
            </dl>
          </Panel>

          <Panel title="Lead score" id="score-title">
            <div className="flex items-center gap-3">
              <ScoreBadge score={lead.score} band={lead.band} />
              <span className="text-sm text-ink-muted capitalize">{lead.band ?? 'Not scored'}</span>
            </div>
            {factors.length ? (
              <ul className="mt-3 grid gap-1 text-sm">
                {factors.map((factor) => (
                  <li key={factor.id} className="flex justify-between gap-3">
                    <span>{factor.label}</span>
                    <span className={factor.points < 0 ? 'font-semibold text-danger' : 'font-semibold'}>
                      {factor.points > 0 ? '+' : ''}
                      {factor.points}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-ink-muted">Rule-based, from the industry pack. Capped at 0 to 100.</p>
          </Panel>

          <Panel title="Tasks" id="tasks-title">
            {tasks.length ? (
              <ul className="grid gap-2">
                {tasks.map((task) => {
                  const overdue = !task.completed_at && new Date(task.due_at) < now;
                  return (
                    <li key={task.id} className="flex items-start gap-2 text-sm">
                      {task.completed_at ? (
                        <span
                          aria-hidden="true"
                          className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-surface"
                        >
                          ✓
                        </span>
                      ) : (
                        <CompleteTaskButton taskId={task.id} leadId={lead.id} title={task.title} />
                      )}
                      <span className={task.completed_at ? 'text-ink-muted line-through' : undefined}>
                        {task.title}
                        <span className={`block text-xs ${overdue ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
                          {overdue ? 'Overdue · ' : ''}
                          {formatDateTime(task.due_at)} · {task.assignee_name ?? 'Unassigned'}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No tasks yet.</p>
            )}
            {!erased ? (
              <div className="mt-4 border-t border-line pt-4">
                <TaskForm
                  leadId={lead.id}
                  defaultDue={tomorrowNine}
                  currentStaffId={session.staffId}
                  staff={staff.map((s) => ({ id: s.id, label: s.full_name }))}
                />
              </div>
            ) : null}
          </Panel>

          <Panel title="Consent" id="consent-title">
            <ul className="grid gap-2 text-sm">
              {[...currentConsent.entries()].map(([purpose, granted]) => (
                <li key={purpose} className="flex items-center justify-between gap-2">
                  <span>{allConsents.find((c) => c.id === purpose)?.title ?? purpose}</span>
                  <Badge tone={granted ? 'teal' : 'neutral'}>{granted ? 'Given' : 'Withdrawn'}</Badge>
                </li>
              ))}
            </ul>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-primary">History ({consents.length})</summary>
              <ol className="mt-2 grid gap-1 text-xs text-ink-muted">
                {consents.map((record, index) => (
                  <li key={index}>
                    {formatDateTime(record.recorded_at)}: {record.purpose.replaceAll('_', ' ')}{' '}
                    {record.granted ? 'given' : 'withdrawn'} ({record.text_version}, via{' '}
                    {record.source.replaceAll('_', ' ')})
                  </li>
                ))}
              </ol>
            </details>
            {!erased && can(session.role, 'lead.recordWithdrawal') ? (
              <div className="mt-3">
                <WithdrawalControl
                  leadId={lead.id}
                  consents={allConsents
                    .filter((c) => currentConsent.get(c.id))
                    .map((c) => ({ id: c.id, title: c.title, erases: c.erasesDataOnWithdrawal }))}
                />
              </div>
            ) : null}
          </Panel>

          <Panel title="Nurture sequences" id="sequences-title">
            {enrollments.length ? (
              <ul className="grid gap-3 text-sm">
                {enrollments.map((enrollment) => (
                  <li key={enrollment.id} className="rounded-md border border-line p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{sequenceName(enrollment.sequence_id)}</span>
                      <Badge tone={enrollment.status === 'active' ? 'teal' : 'neutral'}>
                        {enrollment.status === 'stopped' ? stopReasonLabel(enrollment.stop_reason) : enrollment.status}
                      </Badge>
                    </div>
                    <ol className="mt-2 flex flex-wrap gap-1" aria-label="Steps">
                      {enrollment.steps.map((step) => (
                        <li
                          key={step.step_index}
                          title={`${step.channel}, ${step.status}, due ${formatDateTime(step.due_at)}`}
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            step.status === 'done'
                              ? 'bg-success-soft text-success'
                              : step.status === 'pending'
                                ? 'bg-primary-soft'
                                : 'bg-surface-muted text-ink-muted line-through'
                          }`}
                        >
                          {step.channel} · {step.status === 'pending' ? formatRelative(step.due_at, now) : step.status}
                        </li>
                      ))}
                    </ol>
                    {enrollment.status === 'active' && canFrontDesk ? (
                      <div className="mt-2">
                        <StopEnrollmentButton
                          enrollmentId={enrollment.id}
                          leadId={lead.id}
                          label={sequenceName(enrollment.sequence_id)}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Not enrolled in any sequence.</p>
            )}
            {!erased && !lead.opted_out_at && canFrontDesk ? (
              <div className="mt-2">
                {pack.sequences
                  .filter((s) => s.enrolOnStage === null)
                  .map((s) => (
                    <EnrolButton key={s.id} leadId={lead.id} sequenceId={s.id} label={s.name} />
                  ))}
              </div>
            ) : null}
          </Panel>

          <Panel title="Messages" id="messages-title">
            {messages.length ? (
              <ul className="grid gap-2">
                {messages.map((message) => {
                  const template = pack.crm.templates.find((t) => t.id === message.template_id);
                  const preview = message.body ?? (template ? renderTemplate(template, sampleVars).text : null);
                  return (
                    <li key={message.id} className="rounded-md border border-line p-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ChannelBadge channel={message.channel} />
                        <MessageStatusBadge status={message.status} />
                        <span className="text-xs text-ink-muted">
                          {message.direction === 'inbound' ? 'from lead' : 'to lead'} ·{' '}
                          {formatDateTime(message.created_at)}
                        </span>
                      </div>
                      {message.subject ? <p className="mt-1 font-semibold">{message.subject}</p> : null}
                      {preview ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-semibold text-primary">Show message</summary>
                          <p className="mt-1 text-xs whitespace-pre-wrap text-ink-muted">{preview}</p>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No messages yet.</p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              SMS and WhatsApp are simulated in this demo (India requires DLT registration for real SMS).
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
