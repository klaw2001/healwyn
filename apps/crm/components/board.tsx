'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { compareQueuePriority, type SlaTargets, type UrgencyLevel } from '@healwyn/core';
import { cx } from '@healwyn/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { changeStage } from '@/app/(app)/actions';
import { Avatar, ScoreBadge, SlaBadge, UrgencyBadge } from './badges';
import { useUndo } from './undo';

export interface BoardStage {
  id: string;
  label: string;
  kind: 'open' | 'won' | 'lost';
}

export interface BoardLead {
  id: string;
  name: string;
  stage: string;
  urgency: UrgencyLevel;
  specialty: string;
  assignee: string | null;
  score: number | null;
  band: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  language: string;
  openTasks: number;
  optedOut: boolean;
}

/**
 * Keyboard dragging: left and right arrows jump to the previous or next stage
 * column (dnd-kit's default moves 25px per press, which never leaves a column).
 */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return undefined;
  event.preventDefault();
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  const centre = collisionRect.left + collisionRect.width / 2;
  let best: { left: number; top: number; distance: number } | null = null;
  for (const container of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const columnCentre = rect.left + rect.width / 2;
    const ahead = event.code === 'ArrowRight' ? columnCentre > centre + 10 : columnCentre < centre - 10;
    const distance = Math.abs(columnCentre - centre);
    if (ahead && (!best || distance < best.distance))
      best = { left: rect.left + (rect.width - collisionRect.width) / 2, top: rect.top + 48, distance };
  }
  return best ? { x: best.left, y: best.top } : undefined;
};

function MoveMenu({
  lead,
  stages,
  onMove,
}: {
  lead: BoardLead;
  stages: readonly BoardStage[];
  onMove: (lead: BoardLead, stage: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && ref.current?.open) {
          ref.current.open = false;
          ref.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-full border border-line-strong px-2.5 text-xs font-semibold text-ink hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        Move<span className="sr-only"> {lead.name}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-line bg-surface p-1 shadow-lift">
        <p className="px-2 py-1 text-xs font-semibold text-ink-muted">Move to</p>
        <ul>
          {stages
            .filter((s) => s.id !== lead.stage)
            .map((stage) => (
              <li key={stage.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-primary-soft focus-visible:bg-primary-soft"
                  onClick={() => {
                    if (ref.current) ref.current.open = false;
                    onMove(lead, stage.id);
                  }}
                >
                  {stage.label}
                </button>
              </li>
            ))}
        </ul>
      </div>
    </details>
  );
}

function Card({
  lead,
  stages,
  now,
  sla,
  onMove,
}: {
  lead: BoardLead;
  stages: readonly BoardStage[];
  now: Date;
  sla: SlaTargets;
  onMove: (lead: BoardLead, stage: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });
  return (
    <article
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cx(
        'min-w-0 rounded-md border border-line bg-surface p-3 shadow-soft transition-shadow',
        isDragging && 'z-30 shadow-lift ring-2 ring-primary',
      )}
      aria-labelledby={`card-${lead.id}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Drag ${lead.name} to another stage`}
          className="mt-0.5 cursor-grab touch-none rounded px-0.5 text-ink-muted hover:text-ink active:cursor-grabbing"
        >
          <svg viewBox="0 0 12 20" className="h-4 w-2.5" aria-hidden="true">
            {[3, 9].flatMap((x) =>
              [4, 10, 16].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />),
            )}
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <Link
            id={`card-${lead.id}`}
            href={`/leads/${lead.id}`}
            className="block truncate font-semibold text-ink underline-offset-2 hover:underline"
          >
            {lead.name}
          </Link>
          <p className="truncate text-xs text-ink-muted">{lead.specialty}</p>
        </div>
        <ScoreBadge score={lead.score} band={lead.band} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <UrgencyBadge urgency={lead.urgency} />
        <SlaBadge
          sla={sla}
          createdAt={lead.createdAt}
          urgency={lead.urgency}
          firstResponseAt={lead.firstResponseAt}
          now={now}
        />
        {lead.optedOut ? (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-muted">
            Unsubscribed
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs whitespace-nowrap text-ink-muted">
          <Avatar name={lead.assignee} className="size-6" />
          <span className="min-w-0 truncate">{lead.assignee ?? 'Unassigned'}</span>
          <span aria-hidden="true">·</span>
          <span>{lead.language.toUpperCase()}</span>
          {lead.openTasks ? (
            <>
              <span aria-hidden="true">·</span>
              <span title={`${lead.openTasks} open task${lead.openTasks === 1 ? '' : 's'}`}>
                {lead.openTasks}
                <span className="sr-only"> open task{lead.openTasks === 1 ? '' : 's'}</span>
                <svg aria-hidden="true" viewBox="0 0 16 16" className="ml-0.5 inline size-3 align-[-1px]">
                  <path
                    d="M3 8.5 6.5 12 13 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </>
          ) : null}
        </span>
        <MoveMenu lead={lead} stages={stages} onMove={onMove} />
      </div>
    </article>
  );
}

function Column({
  stage,
  leads,
  stages,
  now,
  sla,
  onMove,
}: {
  stage: BoardStage;
  leads: BoardLead[];
  stages: readonly BoardStage[];
  now: Date;
  sla: SlaTargets;
  onMove: (lead: BoardLead, stage: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${stage.id}`}
      className={cx(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-surface-muted p-2 transition-colors',
        isOver ? 'border-primary bg-primary-soft/40' : 'border-transparent',
      )}
    >
      <h2
        id={`col-${stage.id}`}
        className="flex items-center justify-between px-1.5 py-1 font-sans text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cx(
              'size-2 rounded-full',
              stage.kind === 'won' ? 'bg-success' : stage.kind === 'lost' ? 'bg-line-strong' : 'bg-primary',
            )}
          />
          {stage.label}
        </span>
        <span className="rounded-full bg-surface px-2 text-xs text-ink-muted">
          {leads.length}
          <span className="sr-only"> leads</span>
        </span>
      </h2>
      <ul className="mt-1 grid max-h-[calc(100dvh-17rem)] min-h-24 gap-2 overflow-y-auto overscroll-contain p-0.5">
        {leads.map((lead) => (
          <li key={lead.id} className="min-w-0">
            <Card lead={lead} stages={stages} now={now} sla={sla} onMove={onMove} />
          </li>
        ))}
      </ul>
      {leads.length === 0 ? <p className="px-2 py-6 text-center text-xs text-ink-muted">Nothing here</p> : null}
    </section>
  );
}

/**
 * The pipeline board. Columns come from the industry pack. Cards move by
 * drag-and-drop (pointer, touch or keyboard: space to lift, arrows, space to
 * drop) or with the Move menu on each card.
 */
export function Board({
  stages,
  leads: initial,
  nowIso,
  sla,
}: {
  stages: readonly BoardStage[];
  leads: BoardLead[];
  nowIso: string;
  /** The pack's first-response targets. */
  sla: SlaTargets;
}) {
  const [leads, setLeads] = useState(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const { record, notify } = useUndo();
  const now = new Date(nowIso);
  const labelOf = (id: string) => stages.find((s) => s.id === id)?.label ?? id;

  // Fresh server data (after a refresh or undo) replaces local state.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with new server props
  useEffect(() => setLeads(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  const move = (lead: BoardLead, toStage: string) => {
    if (lead.stage === toStage) return;
    const from = lead.stage;
    setLeads((current) => current.map((l) => (l.id === lead.id ? { ...l, stage: toStage } : l)));
    startTransition(async () => {
      const result = await changeStage(lead.id, toStage);
      if (result.ok) {
        record({
          leadId: lead.id,
          leadName: lead.name,
          from,
          to: toStage,
          fromLabel: labelOf(from),
          toLabel: labelOf(toStage),
        });
        router.refresh();
      } else {
        setLeads((current) => current.map((l) => (l.id === lead.id ? { ...l, stage: from } : l)));
        notify(result.error, 'error');
      }
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const lead = event.active.data.current?.lead as BoardLead | undefined;
    const target = event.over?.id;
    if (lead && typeof target === 'string') move(lead, target);
  };

  const nameOf = (id: string | number) => leads.find((l) => l.id === id)?.name ?? 'lead';
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}. Use the left and right arrow keys to choose a stage, space to drop.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${labelOf(String(over.id))}.` : `${nameOf(active.id)} is not over a stage.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped in ${labelOf(String(over.id))}.`
        : `${nameOf(active.id)} dropped. Stage unchanged.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move a lead, press space or enter on the drag handle, use the left and right arrow keys to choose a stage, then press space again. Or use the Move menu on the card.',
        },
      }}
    >
      <div
        className="flex gap-3 overflow-x-auto px-4 pb-6 sm:px-8"
        role="region"
        aria-label="Pipeline board"
        tabIndex={0}
      >
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            stages={stages}
            now={now}
            sla={sla}
            onMove={move}
            leads={leads.filter((l) => l.stage === stage.id).sort((a, b) => compareQueuePriority(a, b))}
          />
        ))}
      </div>
    </DndContext>
  );
}
