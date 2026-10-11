'use client';

import { Button } from '@healwyn/ui';
import { useActionState, useState, useTransition } from 'react';
import { addAvailabilityException, removeAvailabilityException } from '@/app/(app)/booking-actions';
import { EXCEPTION_REASON_LABELS } from '@/lib/booking-labels';
import type { ActionResult } from '@/lib/server/errors';

const input = 'min-h-10 rounded-md border border-line-strong bg-surface px-2 text-sm';

export function AddException({ staffId, today }: { staffId: string; today: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addAvailabilityException, null);
  const [kind, setKind] = useState<'off' | 'extra'>('off');
  const [wholeDay, setWholeDay] = useState(true);
  const timed = kind === 'extra' || !wholeDay;
  return (
    <form action={action} className="grid gap-3 text-sm">
      <input type="hidden" name="staff_id" value={staffId} />
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-xs font-semibold text-ink-muted">What</legend>
        <label className="flex min-h-10 items-center gap-2">
          <input type="radio" name="kind" value="off" checked={kind === 'off'} onChange={() => setKind('off')} />
          Time off
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="radio" name="kind" value="extra" checked={kind === 'extra'} onChange={() => setKind('extra')} />
          Extra hours
        </label>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-ink-muted">Date</span>
          <input type="date" name="date" min={today} required className={input} />
        </label>
        {kind === 'off' ? (
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="checkbox"
              name="whole_day"
              checked={wholeDay}
              onChange={(event) => setWholeDay(event.target.checked)}
            />
            Whole day
          </label>
        ) : null}
        {timed ? (
          <>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-ink-muted">From</span>
              <input type="time" name="start" step={900} required className={input} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-ink-muted">To</span>
              <input type="time" name="end" step={900} required className={input} />
            </label>
          </>
        ) : null}
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-ink-muted">Reason</span>
          <select name="reason" defaultValue="leave" className={input}>
            {Object.entries(EXCEPTION_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          Add
        </Button>
      </div>
      {state ? (
        <p role={state.ok ? 'status' : 'alert'} className={state.ok ? '' : 'font-semibold text-danger'}>
          {state.ok ? 'Added.' : state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveException({ exceptionId, label }: { exceptionId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        aria-label={`Remove ${label}`}
        onClick={() =>
          startTransition(async () => {
            const result = await removeAvailabilityException(exceptionId);
            setError(result.ok ? null : result.error);
          })
        }
      >
        Remove
      </Button>
      {error ? (
        <span role="alert" className="text-xs font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
