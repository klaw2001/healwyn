'use client';

import { Button } from '@healwyn/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  acceptRouting,
  assignLead,
  changeStage,
  enrollInSequence,
  markReplied,
  placeAssistantCall,
  recordWithdrawal,
  stopEnrollment,
} from '@/app/(app)/actions';
import { useUndo } from '../undo';

const control = 'min-h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink';

export function StageControl({
  leadId,
  leadName,
  stage,
  stages,
}: {
  leadId: string;
  leadName: string;
  stage: string;
  stages: { id: string; label: string }[];
}) {
  const [value, setValue] = useState(stage);
  const [pending, start] = useTransition();
  const { record, notify } = useUndo();
  const router = useRouter();
  const labelOf = (id: string) => stages.find((s) => s.id === id)?.label ?? id;
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (value === stage) return;
        start(async () => {
          const result = await changeStage(leadId, value);
          if (result.ok) {
            record({
              leadId,
              leadName,
              from: result.from,
              to: result.to,
              fromLabel: labelOf(result.from),
              toLabel: labelOf(result.to),
            });
            router.refresh();
          } else notify(result.error, 'error');
        });
      }}
    >
      <label className="sr-only" htmlFor="stage-select">
        Stage
      </label>
      <select id="stage-select" value={value} onChange={(e) => setValue(e.target.value)} className={control}>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending || value === stage}>
        {pending ? 'Moving…' : 'Move'}
      </Button>
    </form>
  );
}

export function AssignControl({
  leadId,
  assignedStaffId,
  staff,
  suggestedStaffId = null,
  overrideReasons,
}: {
  leadId: string;
  assignedStaffId: string | null;
  staff: { id: string; label: string }[];
  /** The routing engine's choice; picking someone else needs a reason. */
  suggestedStaffId?: string | null;
  overrideReasons: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(assignedStaffId ?? '');
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  const router = useRouter();
  const overriding = suggestedStaffId !== null && value !== '' && value !== suggestedStaffId;
  const unchanged = value === (assignedStaffId ?? '');
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await assignLead(leadId, value || null, {
            suggestedStaffId,
            overrideReason: overriding ? reason : null,
          });
          if (result.ok) {
            notify(value ? 'Lead assigned.' : 'Lead unassigned.');
            setReason('');
            router.refresh();
          } else notify(result.error, 'error');
        });
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="assign-select">
          Assigned to
        </label>
        <select id="assign-select" value={value} onChange={(e) => setValue(e.target.value)} className={control}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" disabled={pending || unchanged || (overriding && !reason)}>
          {pending ? 'Saving…' : 'Assign'}
        </Button>
      </div>
      {overriding && !unchanged ? (
        <div className="grid gap-1">
          <label htmlFor="override-reason" className="text-xs font-semibold text-ink-muted">
            Reason for not following the routing suggestion
          </label>
          <select
            id="override-reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={control}
          >
            <option value="">Choose a reason</option>
            {overrideReasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </form>
  );
}

export function AcceptRoutingButton({ leadId, staffName }: { leadId: string; staffName: string }) {
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  const router = useRouter();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await acceptRouting(leadId);
          if (result.ok) {
            notify(`Assigned to ${result.staffName}.`);
            router.refresh();
          } else notify(result.error, 'error');
        })
      }
    >
      {pending ? 'Assigning…' : `Assign to ${staffName}`}
    </Button>
  );
}

export function ReplyButton({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const result = await markReplied(leadId);
          if (result.ok) {
            notify(
              result.stopped
                ? `Marked as replied. ${result.stopped} sequence${result.stopped === 1 ? '' : 's'} stopped.`
                : 'Marked as replied.',
            );
            router.refresh();
          } else notify(result.error, 'error');
        })
      }
    >
      {pending ? 'Saving…' : 'Mark as replied'}
    </Button>
  );
}

export function WithdrawalControl({
  leadId,
  consents,
}: {
  leadId: string;
  consents: { id: string; title: string; erases: boolean }[];
}) {
  const [purpose, setPurpose] = useState(consents[0]?.id ?? '');
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  const router = useRouter();
  const selected = consents.find((c) => c.id === purpose);
  return (
    <details className="rounded-md border border-line p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Record a consent withdrawal</summary>
      <form
        className="mt-3 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = await recordWithdrawal(leadId, purpose);
            if (result.ok) {
              notify(selected?.erases ? 'Withdrawal recorded. Personal details erased.' : 'Withdrawal recorded.');
              router.refresh();
            } else notify(result.error, 'error');
          });
        }}
      >
        <label htmlFor="withdraw-purpose" className="font-semibold">
          Which consent?
        </label>
        <select id="withdraw-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={control}>
          {consents.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {selected?.erases ? (
          <p className="text-danger">
            This erases the lead’s personal details, notes and tasks straight away. It cannot be undone.
          </p>
        ) : (
          <p className="text-ink-muted">The lead stays; this consent is marked as withdrawn.</p>
        )}
        <Button type="submit" size="sm" variant={selected?.erases ? 'primary' : 'secondary'} disabled={pending}>
          {pending ? 'Recording…' : 'Record withdrawal'}
        </Button>
      </form>
    </details>
  );
}

export function EnrolButton({ leadId, sequenceId, label }: { leadId: string; sequenceId: string; label: string }) {
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await enrollInSequence(leadId, sequenceId);
          if (result.ok) {
            notify(`Started “${label}”.`);
            router.refresh();
          } else notify(result.error, 'error');
        })
      }
    >
      Start “{label}”
    </Button>
  );
}

export function StopEnrollmentButton({
  enrollmentId,
  leadId,
  label,
}: {
  enrollmentId: string;
  leadId: string;
  label: string;
}) {
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs font-semibold text-primary underline underline-offset-2"
      onClick={() =>
        start(async () => {
          const result = await stopEnrollment(enrollmentId, leadId);
          if (result.ok) {
            notify(`Stopped “${label}”.`);
            router.refresh();
          } else notify(result.error, 'error');
        })
      }
    >
      Stop<span className="sr-only"> {label}</span>
    </button>
  );
}

/**
 * The dialer: place an assistant call for this lead. Simulated calls run the
 * real conversation engine; phone calls need a SIP trunk (docs/VOICE.md).
 */
export function CallControls({ leadId, phoneEnabled }: { leadId: string; phoneEnabled: boolean }) {
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  const router = useRouter();
  const place = (channel: 'simulated' | 'phone') =>
    start(async () => {
      const result = await placeAssistantCall(leadId, channel);
      if (result.ok) {
        notify(
          channel === 'phone'
            ? 'Dialling. The summary appears here when the call ends.'
            : `Simulated call finished: ${result.outcome.replaceAll('_', ' ')}.`,
        );
      } else notify(result.error, 'error');
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => place('simulated')}>
        {pending ? 'Calling…' : 'Simulated assistant call'}
      </Button>
      <Button size="sm" variant="secondary" disabled={pending || !phoneEnabled} onClick={() => place('phone')}>
        Phone call
      </Button>
    </div>
  );
}
