import { getActivePack, LEAD_SOURCES, URGENCIES } from '@healwyn/core';
import { buttonClasses, cx } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Board, type BoardLead } from '@/components/board';
import { Filters, type FilterDefinition } from '@/components/filters';
import { BoardIcon, ListIcon } from '@/components/icons';
import { LeadTable, SORTS, sortLeads, type SortKey } from '@/components/lead-table';
import { PageTitle } from '@/components/shell';
import { languageLabel, sourceLabel, specialtyLabel } from '@/lib/format';
import { requireCapability } from '@/lib/server/auth';
import { listLeads, listStaff, type LeadFilters } from '@/lib/server/queries';

export const metadata: Metadata = { title: 'Pipeline' };

const pack = getActivePack();
const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function PipelinePage({ searchParams }: PageProps<'/pipeline'>) {
  const session = await requireCapability('screen.pipeline');
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === 'string' && v ? [[k, v] as const] : [])),
  ) as Record<string, string>;
  const view = params.view === 'list' ? 'list' : 'board';
  const filters: LeadFilters = {
    q: one(raw.q),
    assignee: one(raw.assignee),
    specialty: one(raw.specialty),
    language: one(raw.language),
    urgency: one(raw.urgency),
    source: one(raw.source),
    from: one(raw.from),
    to: one(raw.to),
    type: raw.type === 'partner' || raw.type === 'all' ? raw.type : 'individual',
  };
  const [leads, staff] = await Promise.all([listLeads(session, filters), listStaff(session)]);
  const now = new Date();

  const definitions: FilterDefinition[] = [
    {
      name: 'assignee',
      label: 'Assignee',
      options: [
        { value: 'me', label: 'Me' },
        { value: 'unassigned', label: 'Unassigned' },
        ...staff.filter((s) => s.role !== 'manager').map((s) => ({ value: s.id, label: s.full_name })),
      ],
    },
    { name: 'specialty', label: 'Specialty', options: pack.offerings.map((o) => ({ value: o.slug, label: o.name })) },
    { name: 'language', label: 'Language', options: pack.languages.map((l) => ({ value: l.code, label: l.label })) },
    {
      name: 'urgency',
      label: 'Urgency',
      options: URGENCIES.map((u) => ({ value: u, label: u[0]!.toUpperCase() + u.slice(1) })),
    },
    { name: 'source', label: 'Source', options: LEAD_SOURCES.map((s) => ({ value: s, label: sourceLabel(s) })) },
    {
      name: 'type',
      label: 'Type',
      options: [
        { value: 'partner', label: 'Partners' },
        { value: 'all', label: 'Patients and partners' },
      ],
    },
  ];

  const sort: SortKey = SORTS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : view === 'list'
      ? 'created'
      : 'sla';
  const dir = params.dir === 'asc' ? 'asc' : params.dir === 'desc' ? 'desc' : sort === 'sla' ? 'asc' : 'desc';
  const sorted = sortLeads(leads, sort, dir);

  const boardLeads: BoardLead[] = sortLeads(leads, 'sla', 'asc').map((l) => ({
    id: l.id,
    name: l.full_name ?? 'Erased lead',
    stage: l.stage,
    urgency: l.urgency,
    specialty: specialtyLabel(l.specialty_slug),
    assignee: l.assignee_name,
    score: l.score,
    band: l.band,
    createdAt: new Date(l.created_at).toISOString(),
    firstResponseAt: l.first_response_at ? new Date(l.first_response_at).toISOString() : null,
    language: languageLabel(l.preferred_language).slice(0, 2),
    openTasks: l.open_tasks,
    optedOut: l.opted_out_at !== null,
  }));

  const viewLink = (target: 'board' | 'list') =>
    `/pipeline?${new URLSearchParams({ ...params, view: target }).toString()}`;

  return (
    <>
      <PageTitle
        title="Pipeline"
        description={`${leads.length} lead${leads.length === 1 ? '' : 's'} you can see. Columns are the ${pack.label.toLowerCase()} stages.`}
        actions={
          <nav aria-label="View" className="flex rounded-full border border-line bg-surface p-0.5">
            {(['board', 'list'] as const).map((target) => (
              <Link
                key={target}
                href={viewLink(target)}
                aria-current={view === target ? 'page' : undefined}
                className={cx(
                  buttonClasses({ size: 'sm', variant: 'ghost' }),
                  'gap-1.5 aria-[current=page]:bg-primary aria-[current=page]:text-on-primary',
                )}
              >
                {target === 'board' ? <BoardIcon /> : <ListIcon />}
                {target === 'board' ? 'Board' : 'List'}
              </Link>
            ))}
          </nav>
        }
      />
      <div className="px-4 py-4 sm:px-8">
        <Filters definitions={definitions} />
      </div>
      {view === 'board' ? (
        <Board
          stages={pack.stages.map((s) => ({ id: s.id, label: s.label, kind: s.kind }))}
          leads={boardLeads}
          nowIso={now.toISOString()}
        />
      ) : (
        <LeadTable leads={sorted} sort={sort} dir={dir} params={params} now={now} />
      )}
    </>
  );
}
