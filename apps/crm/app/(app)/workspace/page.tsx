import { can, compareQueuePriority, getActivePack } from '@healwyn/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ScoreBadge, SlaBadge, StageBadge, UrgencyBadge } from '@/components/badges';
import { EmptyState } from '@/components/empty-state';
import { CompleteTaskButton } from '@/components/profile/forms';
import { PageTitle } from '@/components/shell';
import { endOfIndiaDay, formatDay, formatTime, indiaDay, specialtyLabel } from '@/lib/format';
import { requireCapability } from '@/lib/server/auth';
import { listLeads, listTasks, type LeadRow, type TaskRow } from '@/lib/server/queries';

export const metadata: Metadata = { title: 'My workspace' };

const pack = getActivePack();
const closedStages = new Set(pack.stages.filter((s) => s.kind !== 'open').map((s) => s.id));

function Section({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="flex items-center gap-2 text-xl">
        {title}
        <span className="rounded-full bg-surface-muted px-2 font-sans text-sm text-ink-muted">{count}</span>
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LeadList({ leads, now }: { leads: LeadRow[]; now: Date }) {
  return (
    <ul className="grid gap-2">
      {leads.map((lead) => (
        <li key={lead.id} className="rounded-md border border-line bg-surface p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                {lead.full_name}
              </Link>
              <p className="text-xs text-ink-muted">{specialtyLabel(lead.specialty_slug)}</p>
            </div>
            <ScoreBadge score={lead.score} band={lead.band} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <StageBadge stage={lead.stage} />
            <UrgencyBadge urgency={lead.urgency} />
            <SlaBadge
              createdAt={lead.created_at}
              urgency={lead.urgency}
              firstResponseAt={lead.first_response_at}
              now={now}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TaskItems({ tasks, now }: { tasks: TaskRow[]; now: Date }) {
  return (
    <ul className="grid gap-2">
      {tasks.map((task) => {
        const overdue = new Date(task.due_at) < now;
        const reminding = !overdue && task.remind_at !== null && new Date(task.remind_at) <= now;
        return (
          <li key={task.id} className="flex items-start gap-3 rounded-md border border-line bg-surface p-3">
            <CompleteTaskButton taskId={task.id} leadId={task.lead_id} title={task.title} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{task.title}</p>
              <p className="text-xs text-ink-muted">
                <Link href={`/leads/${task.lead_id}`} className="text-primary underline underline-offset-2">
                  {task.lead_name ?? 'Lead'}
                </Link>{' '}
                ·{' '}
                <span
                  className={overdue ? 'font-semibold text-danger' : reminding ? 'font-semibold text-ink' : undefined}
                >
                  {overdue
                    ? `Overdue since ${formatDay(task.due_at)}, ${formatTime(task.due_at)}`
                    : reminding
                      ? `Reminder: due at ${formatTime(task.due_at)}`
                      : `Due ${formatTime(task.due_at)}`}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function WorkspacePage() {
  const session = await requireCapability('screen.workspace');
  const now = new Date();
  const frontDesk = can(session.role, 'lead.assign');
  const [mine, unassigned, todayTasks, weekTasks] = await Promise.all([
    listLeads(session, { assignee: 'me' }),
    frontDesk ? listLeads(session, { assignee: 'unassigned' }) : Promise.resolve([]),
    listTasks(session, { assignee: 'me', until: endOfIndiaDay(now) }),
    listTasks(session, { assignee: 'me', until: endOfIndiaDay(now, 7) }),
  ]);
  const byPriority = (a: LeadRow, b: LeadRow) =>
    compareQueuePriority(
      { urgency: a.urgency, createdAt: a.created_at },
      { urgency: b.urgency, createdAt: b.created_at },
    );
  const myOpen = mine.filter((l) => !closedStages.has(l.stage)).sort(byPriority);
  const queue = unassigned.filter((l) => !closedStages.has(l.stage)).sort(byPriority);
  const upcoming = weekTasks.filter((t) => new Date(t.due_at) > endOfIndiaDay(now));
  const byDay = new Map<string, TaskRow[]>();
  for (const task of upcoming) byDay.set(indiaDay(task.due_at), [...(byDay.get(indiaDay(task.due_at)) ?? []), task]);
  const firstName = session.name.replace(/^Dr\.\s*/, '').split(' ')[0];

  return (
    <>
      <PageTitle
        title={`Good to see you, ${firstName}`}
        description={`${todayTasks.length} task${todayTasks.length === 1 ? '' : 's'} due today or overdue · ${myOpen.length} open lead${myOpen.length === 1 ? '' : 's'} assigned to you`}
      />
      <div className="grid gap-8 px-4 py-6 sm:px-8 lg:grid-cols-2 2xl:grid-cols-3">
        <Section id="today" title="Today’s tasks" count={todayTasks.length}>
          {todayTasks.length ? (
            <TaskItems tasks={todayTasks} now={now} />
          ) : (
            <EmptyState title="Nothing due today">New tasks you or your team create will show up here.</EmptyState>
          )}
        </Section>

        <Section id="mine" title="My leads" count={myOpen.length}>
          {myOpen.length ? (
            <LeadList leads={myOpen} now={now} />
          ) : (
            <EmptyState title="No open leads assigned to you">
              {frontDesk ? 'Pick one up from the unassigned queue.' : 'A coordinator assigns leads to you.'}
            </EmptyState>
          )}
        </Section>

        {frontDesk ? (
          <Section id="queue" title="Unassigned queue" count={queue.length}>
            {queue.length ? (
              <LeadList leads={queue} now={now} />
            ) : (
              <EmptyState title="The queue is clear">Every open lead has an owner.</EmptyState>
            )}
          </Section>
        ) : null}

        <Section id="agenda" title="Next 7 days" count={upcoming.length}>
          {byDay.size ? (
            <ol className="grid gap-4">
              {[...byDay.entries()].map(([day, tasks]) => (
                <li key={day}>
                  <h3 className="font-sans text-sm font-semibold text-ink-muted">{formatDay(tasks[0]!.due_at)}</h3>
                  <ul className="mt-2 grid gap-1.5">
                    {tasks.map((task) => (
                      <li key={task.id} className="flex gap-3 text-sm">
                        <span className="w-16 shrink-0 text-ink-muted tabular-nums">{formatTime(task.due_at)}</span>
                        <span className="min-w-0">
                          {task.title} ·{' '}
                          <Link href={`/leads/${task.lead_id}`} className="text-primary underline underline-offset-2">
                            {task.lead_name ?? 'Lead'}
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="A quiet week ahead">No follow-ups scheduled for the next seven days.</EmptyState>
          )}
        </Section>
      </div>
    </>
  );
}
