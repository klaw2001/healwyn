import { cx } from '@healwyn/ui';
import type { ReactNode } from 'react';
import { axis, barPercent, formatShortDay } from '@/lib/dashboard-math';

/**
 * Server-rendered dashboard charts: plain HTML and CSS, no client JavaScript.
 * Colours are theme tokens (bg-primary, bg-line-strong, bg-success …) so a chart
 * re-skins with the industry pack and follows dark mode. Each chart is one
 * `role="img"` with a summary label; the exact numbers sit in a table beside it.
 * Hovering a mark shows its value through the native `title` tooltip.
 */

/** A dashboard section: heading, one-sentence takeaway, the chart and its numbers. */
export function Panel({
  id,
  title,
  takeaway,
  wide,
  table,
  children,
}: {
  id: string;
  title: string;
  takeaway: ReactNode;
  wide?: boolean;
  /** The data table behind the chart, inside "Show the numbers". */
  table?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cx('min-w-0 rounded-lg border border-line bg-surface p-5', wide && 'xl:col-span-2')}
    >
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      <p className="mt-1 text-ink-muted" data-testid={`${id}-takeaway`}>
        {takeaway}
      </p>
      {children ? <div className="mt-4">{children}</div> : null}
      {table ? (
        <details className="mt-4 border-t border-line pt-1">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-primary">
            Show the numbers
          </summary>
          <div className="overflow-x-auto pb-1">{table}</div>
        </details>
      ) : null}
    </section>
  );
}

/** Wraps a chart so assistive technology reads one summary instead of every bar. */
export function Chart({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="img" aria-label={label} className={className}>
      {children}
    </div>
  );
}

export type Tone = 'primary' | 'muted' | 'success' | 'accent' | 'danger';

export const TONE_CLASS: Record<Tone, string> = {
  primary: 'bg-primary',
  muted: 'bg-line-strong',
  success: 'bg-success',
  accent: 'bg-accent',
  danger: 'bg-danger',
};

export interface Segment {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

/** Swatches with labels (and optional values) under a multi-series chart. */
export function Legend({ items }: { items: readonly { key: string; label: ReactNode; tone: Tone }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-muted">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <span aria-hidden="true" className={cx('inline-block size-3 shrink-0 rounded-sm', TONE_CLASS[item.tone])} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Flex sizing for a segment as its share of the bar. Shares always sum to 1, so
 * the segments fill the bar exactly even when the values are fractions.
 */
function grow(value: number, total: number) {
  return { flexGrow: total > 0 ? value / total : 0, flexBasis: 0 };
}

export interface BarRow {
  key: string;
  label: ReactNode;
  /** Shown under the label, e.g. a role. */
  sublabel?: ReactNode;
  /** Stacked from the baseline: the first segment sits at zero. */
  segments: readonly Segment[];
  /** Text at the right of the row, e.g. "24 · 80%". */
  value: ReactNode;
  /** Native hover tooltip for the row. */
  title: string;
  /** Text under the bar (drop-off notes). */
  note?: ReactNode;
}

/**
 * Horizontal bars on one scale that starts at zero. `max` is the scale's end
 * (e.g. the funnel's total); `marker` draws a thin reference line (e.g. capacity).
 */
export function BarChart({
  label,
  rows,
  max,
  marker,
}: {
  label: string;
  rows: readonly BarRow[];
  max: number;
  marker?: { at: number; label: string };
}) {
  return (
    <Chart label={label}>
      <ul className="grid gap-3">
        {rows.map((row) => {
          const total = row.segments.reduce((sum, s) => sum + s.value, 0);
          const visible = row.segments.filter((s) => s.value > 0);
          return (
            <li key={row.key} title={row.title} className="grid gap-1">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold">{row.label}</span>
                  {row.sublabel ? <span className="block text-xs text-ink-muted">{row.sublabel}</span> : null}
                </div>
                <span className="shrink-0 text-right tabular-nums">{row.value}</span>
              </div>
              <div className="relative h-5 border-l border-line-strong">
                <div className="flex h-full gap-0.5" style={{ width: `${barPercent(total, max)}%` }}>
                  {visible.map((segment, i) => (
                    <div
                      key={segment.key}
                      className={cx(
                        'h-full min-w-0.5',
                        TONE_CLASS[segment.tone],
                        i === visible.length - 1 && 'rounded-r',
                      )}
                      style={grow(segment.value, total)}
                    />
                  ))}
                </div>
                {marker ? (
                  <div
                    aria-hidden="true"
                    className="absolute -inset-y-1 w-0.5 bg-ink"
                    style={{ left: `${barPercent(marker.at, max)}%` }}
                  />
                ) : null}
              </div>
              {row.note ? <p className="text-xs text-ink-muted">{row.note}</p> : null}
            </li>
          );
        })}
      </ul>
      {marker ? <p className="mt-3 text-xs text-ink-muted">The dark line marks {marker.label}.</p> : null}
    </Chart>
  );
}

/** One bar split into parts of a whole (100%), with a legend that carries the numbers. */
export function PartsBar({ label, segments }: { label: string; segments: readonly Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <Chart label={label}>
      <div className="flex h-6 gap-0.5 overflow-hidden rounded">
        {visible.map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label}: ${segment.value}`}
            className={cx('h-full min-w-1', TONE_CLASS[segment.tone])}
            style={grow(segment.value, total)}
          />
        ))}
        {total === 0 ? <div className="h-full flex-1 bg-surface-muted" /> : null}
      </div>
      <Legend
        items={segments.map((s) => ({
          key: s.key,
          tone: s.tone,
          label: (
            <span>
              {s.label}: <span className="font-semibold text-ink tabular-nums">{s.value}</span>
            </span>
          ),
        }))}
      />
    </Chart>
  );
}

export interface Column {
  key: string;
  /** Local day the column starts (week's Monday). */
  day: string;
  segments: readonly Segment[];
  title: string;
}

/** Vertical stacked columns over time, on a zero-based axis with a few clean ticks. */
export function ColumnChart({ label, columns, unit }: { label: string; columns: readonly Column[]; unit: string }) {
  const highest = Math.max(0, ...columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0)));
  const { max, ticks: marks } = axis(highest);
  const every = Math.max(1, Math.ceil(columns.length / 8));
  return (
    <Chart label={label}>
      <div className="flex gap-2">
        <div className="relative h-48 w-8 shrink-0 text-right text-xs text-ink-muted tabular-nums">
          {marks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48 border-b border-line-strong">
            {marks.map((t) =>
              t === 0 ? null : (
                <div
                  key={t}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-line"
                  style={{ bottom: `${(t / max) * 100}%` }}
                />
              ),
            )}
            <div className="relative flex h-full items-end gap-1 px-1">
              {columns.map((column) => {
                const total = column.segments.reduce((sum, s) => sum + s.value, 0);
                const visible = column.segments.filter((s) => s.value > 0);
                return (
                  <div key={column.key} title={column.title} className="flex h-full min-w-0 flex-1 justify-center">
                    <div
                      className="flex w-full max-w-6 flex-col-reverse gap-0.5 self-end"
                      style={{ height: `${barPercent(total, max)}%` }}
                    >
                      {visible.map((segment, i) => (
                        <div
                          key={segment.key}
                          className={cx(
                            'min-h-0.5 w-full',
                            TONE_CLASS[segment.tone],
                            i === visible.length - 1 && 'rounded-t',
                          )}
                          style={grow(segment.value, total)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-1 px-1 pt-1 text-xs text-ink-muted">
            {columns.map((column, i) => (
              <span key={column.key} className="min-w-0 flex-1 text-center whitespace-nowrap">
                {i % every === 0 ? formatShortDay(column.day) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {unit}, by week starting Monday (India time). Hover a column for its numbers.
      </p>
    </Chart>
  );
}

/** A small table with a caption, header row and right-aligned numbers. */
export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <table className="mt-2 w-full min-w-[28rem] text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-xs text-ink-muted">
        <tr className="border-b border-line">
          {head.map((h, i) => (
            <th key={h} scope="col" className={cx('py-1.5 pr-3 font-semibold', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b border-line last:border-b-0">
            {row.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className="py-1.5 pr-3 font-normal">
                  {cell}
                </th>
              ) : (
                <td key={i} className="py-1.5 pr-3 text-right tabular-nums">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
