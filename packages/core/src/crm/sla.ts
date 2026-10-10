import type { SlaTargets, UrgencyLevel } from './types';

export type SlaState = 'met' | 'met_late' | 'on_track' | 'due_soon' | 'overdue';

export interface SlaStatus {
  state: SlaState;
  dueAt: Date;
  /** Negative when overdue. Null once responded. */
  minutesLeft: number | null;
}

/** "Due soon" when less than a quarter of the window, or under an hour, remains. */
const DUE_SOON_SHARE = 0.25;
const DUE_SOON_MINUTES = 60;

export function firstResponseDue(createdAt: Date, urgency: UrgencyLevel, targets: SlaTargets): Date {
  return new Date(createdAt.getTime() + targets.firstResponseMinutes[urgency] * 60_000);
}

export function slaStatus(
  input: { createdAt: Date; urgency: UrgencyLevel; firstResponseAt: Date | null },
  targets: SlaTargets,
  now: Date = new Date(),
): SlaStatus {
  const dueAt = firstResponseDue(input.createdAt, input.urgency, targets);
  if (input.firstResponseAt) {
    return { state: input.firstResponseAt <= dueAt ? 'met' : 'met_late', dueAt, minutesLeft: null };
  }
  const minutesLeft = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  if (minutesLeft < 0) return { state: 'overdue', dueAt, minutesLeft };
  const window = targets.firstResponseMinutes[input.urgency];
  const soon = minutesLeft <= Math.max(DUE_SOON_MINUTES, window * DUE_SOON_SHARE) && minutesLeft <= window;
  return { state: soon ? 'due_soon' : 'on_track', dueAt, minutesLeft };
}

/** "2h 05m", "3d 4h", "45m". */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs}m`;
  if (abs < 60 * 24) return `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m`;
  const days = Math.floor(abs / (60 * 24));
  const hours = Math.floor((abs % (60 * 24)) / 60);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}
