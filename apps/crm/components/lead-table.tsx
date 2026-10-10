import { firstResponseDue, getActivePack } from '@healwyn/core';
import Link from 'next/link';
import { formatDateTime, formatRelative, specialtyLabel } from '@/lib/format';
import type { LeadRow } from '@/lib/server/queries';
import { Avatar, ScoreBadge, SlaBadge, StageBadge, UrgencyBadge } from './badges';
import { EmptyState } from './empty-state';

export const SORTS = ['created', 'name', 'stage', 'specialty', 'assignee', 'score', 'sla'] as const;
export type SortKey = (typeof SORTS)[number];

const pack = getActivePack();
const stageOrder = new Map(pack.stages.map((s, i) => [s.id, i]));

export function sortLeads(leads: LeadRow[], sort: SortKey, dir: 'asc' | 'desc'): LeadRow[] {
  const value = (lead: LeadRow): number | string => {
    switch (sort) {
      case 'name':
        return lead.full_name?.toLowerCase() ?? '';
      case 'stage':
        return stageOrder.get(lead.stage) ?? 99;
      case 'specialty':
        return specialtyLabel(lead.specialty_slug).toLowerCase();
      case 'assignee':
        return lead.assignee_name?.toLowerCase() ?? '~';
      case 'score':
        return lead.score ?? -1;
      case 'sla':
        // Responded leads sort last; otherwise soonest due first.
        return lead.first_response_at
          ? Number.MAX_SAFE_INTEGER
          : firstResponseDue(new Date(lead.created_at), lead.urgency, pack.crm.sla).getTime();
      case 'created':
        return new Date(lead.created_at).getTime();
    }
  };
  return [...leads].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const order = x < y ? -1 : x > y ? 1 : 0;
    return dir === 'asc' ? order : -order;
  });
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  params,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  params: Record<string, string>;
}) {
  const active = current === sortKey;
  const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
  const query = new URLSearchParams({ ...params, view: 'list', sort: sortKey, dir: nextDir });
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-3 py-2 text-left"
    >
      <Link
        href={`/pipeline?${query.toString()}`}
        className="inline-flex items-center gap-1 font-semibold hover:underline"
      >
        {label}
        <span aria-hidden="true" className="text-xs text-ink-muted">
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </Link>
    </th>
  );
}

export function LeadTable({
  leads,
  sort,
  dir,
  params,
  now,
}: {
  leads: LeadRow[];
  sort: SortKey;
  dir: 'asc' | 'desc';
  params: Record<string, string>;
  now: Date;
}) {
  if (!leads.length) {
    return (
      <div className="px-4 sm:px-8">
        <EmptyState title="No leads match these filters">Try clearing a filter or widening the dates.</EmptyState>
      </div>
    );
  }
  const header = (label: string, key: SortKey) => (
    <SortHeader label={label} sortKey={key} current={sort} dir={dir} params={params} />
  );
  return (
    <div className="overflow-x-auto px-4 pb-8 sm:px-8">
      <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Leads, sorted by {sort} {dir === 'asc' ? 'ascending' : 'descending'}
        </caption>
        <thead className="text-ink-muted [&_th]:border-b [&_th]:border-line">
          <tr>
            {header('Name', 'name')}
            {header('Stage', 'stage')}
            {header('Specialty', 'specialty')}
            {header('Assignee', 'assignee')}
            {header('Score', 'score')}
            {header('First response', 'sla')}
            {header('Received', 'created')}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-surface-muted">
              <td className="min-w-44 px-3 py-2">
                <Link href={`/leads/${lead.id}`} className="font-semibold text-ink hover:underline">
                  {lead.full_name}
                </Link>
                <span className="ml-2 inline-flex gap-1 align-middle">
                  <UrgencyBadge urgency={lead.urgency} />
                  {lead.lead_type === 'partner' ? (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold">Partner</span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2">
                <StageBadge stage={lead.stage} />
              </td>
              <td className="px-3 py-2">{specialtyLabel(lead.specialty_slug)}</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <Avatar name={lead.assignee_name} className="size-6" />
                  {lead.assignee_name ?? <span className="text-ink-muted">Unassigned</span>}
                </span>
              </td>
              <td className="px-3 py-2">
                <ScoreBadge score={lead.score} band={lead.band} />
              </td>
              <td className="px-3 py-2">
                <SlaBadge
                  createdAt={lead.created_at}
                  urgency={lead.urgency}
                  firstResponseAt={lead.first_response_at}
                  now={now}
                  showMet
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-ink-muted" title={formatDateTime(lead.created_at)}>
                {formatRelative(lead.created_at, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
