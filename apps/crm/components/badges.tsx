import { getActivePack, slaStatus, formatDuration, type UrgencyLevel } from '@healwyn/core';
import { cx } from '@healwyn/ui';
import { CHANNEL_LABELS, initials, stageLabel } from '@/lib/format';
import { ChatIcon, ClockIcon, MailIcon, PhoneMsgIcon } from './icons';

const pill = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold';
const sla = getActivePack().crm.sla;

export function StageBadge({ stage }: { stage: string }) {
  const kind = getActivePack().stages.find((s) => s.id === stage)?.kind;
  return (
    <span
      className={cx(
        pill,
        kind === 'won'
          ? 'bg-success-soft text-success'
          : kind === 'lost'
            ? 'bg-surface-muted text-ink-muted'
            : 'bg-primary-soft text-ink',
      )}
    >
      {stageLabel(stage)}
    </span>
  );
}

const URGENCY: Record<UrgencyLevel, { label: string; className: string } | null> = {
  low: null,
  normal: null,
  high: { label: 'High', className: 'bg-accent-soft text-accent-ink' },
  urgent: { label: 'Urgent', className: 'bg-danger-soft text-danger' },
};

export function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  const style = URGENCY[urgency];
  return style ? <span className={cx(pill, style.className)}>{style.label}</span> : null;
}

/** First-response SLA: countdown, warning, or overdue. */
export function SlaBadge({
  createdAt,
  urgency,
  firstResponseAt,
  now,
  showMet = false,
}: {
  createdAt: Date | string;
  urgency: UrgencyLevel;
  firstResponseAt: Date | string | null;
  now: Date;
  showMet?: boolean;
}) {
  const status = slaStatus(
    { createdAt: new Date(createdAt), urgency, firstResponseAt: firstResponseAt ? new Date(firstResponseAt) : null },
    sla,
    now,
  );
  if (status.state === 'met' || status.state === 'met_late') {
    return showMet ? (
      <span
        className={cx(
          pill,
          status.state === 'met' ? 'bg-success-soft text-success' : 'bg-surface-muted text-ink-muted',
        )}
      >
        {status.state === 'met' ? 'Responded in time' : 'Responded late'}
      </span>
    ) : null;
  }
  const left = status.minutesLeft ?? 0;
  const className =
    status.state === 'overdue'
      ? 'bg-danger text-surface'
      : status.state === 'due_soon'
        ? 'bg-accent-soft text-accent-ink'
        : 'bg-surface-muted text-ink-muted';
  const label = status.state === 'overdue' ? `Overdue ${formatDuration(left)}` : `Reply in ${formatDuration(left)}`;
  return (
    <span className={cx(pill, className)}>
      <ClockIcon className="text-[0.95em]" />
      <span>
        <span className="sr-only">First response: </span>
        {label}
      </span>
    </span>
  );
}

export function ScoreBadge({ score, band }: { score: number | null; band: string | null }) {
  if (score === null) return null;
  const className =
    band === 'hot'
      ? 'bg-accent text-on-accent'
      : band === 'warm'
        ? 'bg-accent-soft text-accent-ink'
        : 'bg-surface-muted text-ink-muted';
  return (
    <span className={cx(pill, className)} title="Lead score (rule-based)">
      <span className="sr-only">Score </span>
      {score}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const Icon = channel === 'email' ? MailIcon : channel === 'sms' ? PhoneMsgIcon : ChatIcon;
  return (
    <span className={cx(pill, 'bg-surface-muted text-ink')}>
      <Icon />
      {CHANNEL_LABELS[channel] ?? channel}
    </span>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  sent: { label: 'Sent', className: 'bg-success-soft text-success' },
  simulated: { label: 'Simulated', className: 'border border-dashed border-line-strong text-ink-muted' },
  logged: { label: 'Logged, not sent', className: 'border border-dashed border-line-strong text-ink-muted' },
  failed: { label: 'Failed', className: 'bg-danger-soft text-danger' },
  received: { label: 'Received', className: 'bg-primary-soft text-ink' },
};

export function MessageStatusBadge({ status }: { status: string }) {
  const style = STATUS[status] ?? { label: status, className: 'bg-surface-muted text-ink-muted' };
  return <span className={cx(pill, style.className)}>{style.label}</span>;
}

export function Avatar({ name, className }: { name: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid size-7 shrink-0 place-items-center rounded-full bg-surface-teal text-[0.7rem] font-bold text-primary',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
