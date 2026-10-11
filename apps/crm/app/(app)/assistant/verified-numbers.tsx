'use client';

import { formatIndianMobile } from '@healwyn/core';
import { Button } from '@healwyn/ui';
import { useActionState, useTransition } from 'react';
import { addVerifiedNumber, removeVerifiedNumber } from '@/app/(app)/actions';
import { useUndo } from '@/components/undo';

const control = 'min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink';

export function VerifiedNumbers({ numbers }: { numbers: { phone: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addVerifiedNumber, null);
  const [removing, start] = useTransition();
  const { notify } = useUndo();
  return (
    <div className="grid gap-4">
      {numbers.length ? (
        <ul className="grid gap-2">
          {numbers.map((n) => (
            <li key={n.phone} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
              <span>
                <span className="font-semibold">{n.label}</span>{' '}
                <span className="text-ink-muted">{formatIndianMobile(n.phone)}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={removing}
                onClick={() =>
                  start(async () => {
                    const result = await removeVerifiedNumber(n.phone);
                    notify(result.ok ? 'Number removed.' : result.error, result.ok ? 'info' : 'error');
                  })
                }
              >
                Remove<span className="sr-only"> {n.label}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          No verified numbers yet. Real phone calls are refused until one is added.
        </p>
      )}
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-semibold">
          Mobile number
          <input name="phone" type="tel" inputMode="tel" autoComplete="off" required className={control} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Label
          <input name="label" required maxLength={60} placeholder="Demo phone" className={control} />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Adding…' : 'Add number'}
        </Button>
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-danger sm:col-span-3">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
