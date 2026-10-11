'use client';

import { Button } from '@healwyn/ui';
import { useState, useTransition } from 'react';
import { saveWeeklyHours, type DayHours } from '@/app/(app)/booking-actions';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const input = 'min-h-10 rounded-md border border-line-strong bg-surface px-2 text-sm';

/** One row per weekday: works that day, from, to. Saves the whole week at once. */
export function WeeklyHours({
  staffId,
  initial,
  defaults,
}: {
  staffId: string;
  initial: DayHours[];
  defaults: { start: string; end: string };
}) {
  const [rows, setRows] = useState(() =>
    DAYS.map((_, i) => {
      const rule = initial.find((r) => r.weekday === i + 1);
      return { on: Boolean(rule), start: rule?.start ?? defaults.start, end: rule?.end ?? defaults.end };
    }),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (index: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const hours = rows.flatMap((row, i) => (row.on ? [{ weekday: i + 1, start: row.start, end: row.end }] : []));
        startTransition(async () => {
          const result = await saveWeeklyHours(staffId, hours);
          setMessage(result.ok ? { ok: true, text: 'Weekly hours saved.' } : { ok: false, text: result.error });
        });
      }}
    >
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Weekly hours, India time</caption>
        <thead className="text-xs text-ink-muted">
          <tr>
            <th scope="col" className="py-1 font-semibold">
              Day
            </th>
            <th scope="col" className="py-1 font-semibold">
              From
            </th>
            <th scope="col" className="py-1 font-semibold">
              To
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={DAYS[i]} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 font-normal">
                <label className="flex min-h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.on}
                    onChange={(event) => update(i, { on: event.target.checked })}
                    className="size-5"
                  />
                  {DAYS[i]}
                </label>
              </th>
              <td className="py-2 pr-3">
                <input
                  type="time"
                  aria-label={`${DAYS[i]} from`}
                  value={row.start}
                  disabled={!row.on}
                  step={900}
                  onChange={(event) => update(i, { start: event.target.value })}
                  className={input}
                />
              </td>
              <td className="py-2">
                <input
                  type="time"
                  aria-label={`${DAYS[i]} to`}
                  value={row.end}
                  disabled={!row.on}
                  step={900}
                  onChange={(event) => update(i, { end: event.target.value })}
                  className={input}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          Save weekly hours
        </Button>
        {message ? (
          <span
            role={message.ok ? 'status' : 'alert'}
            className={message.ok ? 'text-sm' : 'text-sm font-semibold text-danger'}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
