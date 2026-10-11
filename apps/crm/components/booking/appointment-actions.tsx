'use client';

import { Button } from '@healwyn/ui';
import { useState, useTransition } from 'react';
import { cancelAppointment, markAppointment } from '@/app/(app)/booking-actions';

/** Attended / Missed for an appointment that has started; Cancel for one that has not. */
export function AppointmentActions({
  appointmentId,
  started,
  noun,
  label,
}: {
  appointmentId: string;
  started: boolean;
  noun: string;
  /** Who and when, for the buttons' accessible names. */
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : (result.error ?? 'Something went wrong.'));
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {started ? (
        <>
          <Button
            size="sm"
            disabled={pending}
            aria-label={`Attended: ${label}`}
            onClick={() => run(() => markAppointment(appointmentId, 'attended'))}
          >
            Attended
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            aria-label={`Missed: ${label}`}
            onClick={() => run(() => markAppointment(appointmentId, 'no_show'))}
          >
            Missed
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          aria-label={`Cancel ${noun}: ${label}`}
          onClick={() => {
            if (window.confirm(`Cancel this ${noun}?`)) run(() => cancelAppointment(appointmentId));
          }}
        >
          Cancel
        </Button>
      )}
      {error ? (
        <span role="alert" className="text-xs font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
