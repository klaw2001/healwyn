'use client';

import { Button } from '@healwyn/ui';
import { useId, useState, useTransition } from 'react';
import { bookAppointment, cancelAppointment, markAppointment } from '@/app/(app)/booking-actions';
import type { SlotChoice } from '@/lib/server/booking';

export interface AppointmentView {
  id: string;
  staffName: string;
  when: string;
  status: 'booked' | 'attended' | 'no_show' | 'cancelled';
  started: boolean;
}

const STATUS: Record<AppointmentView['status'], string> = {
  booked: 'Booked',
  attended: 'Attended',
  no_show: 'Missed',
  cancelled: 'Cancelled',
};

/** The lead's appointment: book, move, cancel, or mark attended or missed. */
export function BookingPanel({
  leadId,
  noun,
  appointments,
  choices,
  defaultStaffId,
  canManage,
  zone,
}: {
  leadId: string;
  noun: string;
  appointments: AppointmentView[];
  choices: SlotChoice[];
  defaultStaffId: string | null;
  canManage: boolean;
  zone: string;
}) {
  const upcoming = appointments.find((a) => a.status === 'booked');
  const past = appointments.filter((a) => a !== upcoming);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok ? { ok: true, text: success } : { ok: false, text: result.error ?? 'Something went wrong.' },
      );
      if (result.ok) setPicking(false);
    });

  return (
    <div className="grid gap-3 text-sm">
      {message ? (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={`rounded-md px-3 py-2 ${message.ok ? 'bg-success-soft' : 'border border-danger bg-danger-soft'}`}
        >
          {message.text}
        </p>
      ) : null}

      {upcoming ? (
        <div className="rounded-md border border-line bg-surface-muted p-3">
          <p className="font-semibold">{upcoming.when}</p>
          <p className="text-ink-muted">With {upcoming.staffName}</p>
          {canManage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {upcoming.started ? (
                <>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => markAppointment(upcoming.id, 'attended'), `Marked as attended.`)}
                  >
                    Attended
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => markAppointment(upcoming.id, 'no_show'), `Marked as missed.`)}
                  >
                    Missed
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => setPicking((v) => !v)}>
                  {picking ? 'Keep this time' : 'Change time'}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Cancel this ${noun}?`)) {
                    run(() => cancelAppointment(upcoming.id), `The ${noun} is cancelled.`);
                  }
                }}
              >
                Cancel {noun}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-ink-muted">No upcoming {noun}.</p>
      )}

      {canManage && (picking || !upcoming) ? (
        <SlotPicker
          noun={noun}
          zone={zone}
          choices={choices}
          defaultStaffId={defaultStaffId}
          pending={pending}
          actionLabel={upcoming ? 'Move to this time' : `Book ${noun}`}
          onBook={(staffId, start, label) =>
            run(
              () => bookAppointment(leadId, staffId, start, upcoming?.id ?? null),
              upcoming ? `Moved to ${label}.` : `Booked for ${label}.`,
            )
          }
        />
      ) : null}

      {past.length ? (
        <details>
          <summary className="cursor-pointer font-semibold text-primary">Earlier ({past.length})</summary>
          <ul className="mt-2 grid gap-1 text-xs text-ink-muted">
            {past.map((a) => (
              <li key={a.id}>
                {a.when} · {a.staffName} · {STATUS[a.status]}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function SlotPicker({
  noun,
  zone,
  choices,
  defaultStaffId,
  pending,
  actionLabel,
  onBook,
}: {
  noun: string;
  zone: string;
  choices: SlotChoice[];
  defaultStaffId: string | null;
  pending: boolean;
  actionLabel: string;
  onBook: (staffId: string, start: string, label: string) => void;
}) {
  const id = useId();
  const [staffId, setStaffId] = useState(
    choices.find((c) => c.staffId === defaultStaffId)?.staffId ?? choices[0]?.staffId ?? '',
  );
  const choice = choices.find((c) => c.staffId === staffId);
  const [date, setDate] = useState<string | null>(null);
  const day = choice?.days.find((d) => d.date === date) ?? choice?.days[0];
  const [start, setStart] = useState<string | null>(null);
  const slot = day?.slots.find((s) => s.start === start);

  if (choices.length === 0) return <p className="text-ink-muted">Nobody takes bookings in this industry yet.</p>;

  return (
    <div className="grid gap-3 rounded-md border border-line p-3">
      <label htmlFor={`${id}-staff`} className="grid gap-1">
        <span className="text-xs font-semibold text-ink-muted">With</span>
        <select
          id={`${id}-staff`}
          value={staffId}
          onChange={(event) => {
            setStaffId(event.target.value);
            setDate(null);
            setStart(null);
          }}
          className="min-h-10 rounded-md border border-line-strong bg-surface px-2"
        >
          {choices.map((c) => (
            <option key={c.staffId} value={c.staffId}>
              {c.name} ({c.title})
            </option>
          ))}
        </select>
      </label>
      {!choice || choice.days.length === 0 || !day ? (
        <p className="text-ink-muted">No open times in the booking window.</p>
      ) : (
        <>
          <fieldset>
            <legend className="text-xs font-semibold text-ink-muted">Day</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {choice.days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  aria-pressed={d.date === day.date}
                  onClick={() => {
                    setDate(d.date);
                    setStart(null);
                  }}
                  className={`min-h-10 rounded-md border px-2 text-xs ${d.date === day.date ? 'border-primary bg-primary text-surface' : 'border-line bg-surface'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold text-ink-muted">Time ({zone})</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {day.slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  aria-pressed={s.start === start}
                  onClick={() => setStart(s.start)}
                  className={`min-h-10 min-w-16 rounded-md border px-2 text-xs ${s.start === start ? 'border-primary bg-primary text-surface' : 'border-line bg-surface'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Button
            size="sm"
            disabled={pending || !slot}
            onClick={() => slot && onBook(staffId, slot.start, `${day.label}, ${slot.label}`)}
          >
            {slot ? `${actionLabel}: ${day.label}, ${slot.label}` : `Choose a time for the ${noun}`}
          </Button>
        </>
      )}
    </div>
  );
}
