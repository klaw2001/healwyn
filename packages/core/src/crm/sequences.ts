import type { MessageChannel, SequenceDefinition } from './types';

export interface PlannedStep {
  stepIndex: number;
  channel: MessageChannel;
  templateId: string;
  /** ISO timestamp. */
  dueAt: string;
}

export interface SequencePlan {
  enroll: { sequenceId: string; steps: PlannedStep[] }[];
  cancel: { sequenceId: string; reason: StopReason }[];
}

export type StopReason =
  'replied' | 'opted_out' | 'consent_withdrawn' | 'lead_erased' | 'stage_changed' | 'manual' | 'completed';

export function scheduleSteps(sequence: SequenceDefinition, enrolledAt: Date): PlannedStep[] {
  return sequence.steps.map((step, stepIndex) => ({
    stepIndex,
    channel: step.channel,
    templateId: step.templateId,
    dueAt: new Date(enrolledAt.getTime() + step.delayMinutes * 60_000).toISOString(),
  }));
}

/**
 * What should happen to nurture sequences when a lead enters `toStage`:
 * sequences that cancel on the new stage stop; sequences that enrol on it start
 * (unless already running). Pure: the caller applies the plan in one transaction.
 */
export function planStageEntry(
  sequences: readonly SequenceDefinition[],
  toStage: string,
  activeSequenceIds: readonly string[],
  now: Date = new Date(),
): SequencePlan {
  const cancel = sequences
    .filter((s) => activeSequenceIds.includes(s.id) && s.cancelOnStages.includes(toStage))
    .map((s) => ({ sequenceId: s.id, reason: 'stage_changed' as const }));
  const stillActive = new Set(activeSequenceIds.filter((id) => !cancel.some((c) => c.sequenceId === id)));
  const enroll = sequences
    .filter((s) => s.enrolOnStage === toStage && !stillActive.has(s.id))
    .map((s) => ({ sequenceId: s.id, steps: scheduleSteps(s, now) }));
  return { enroll, cancel };
}

/**
 * The plan for entering a stage without knowing which sequences are running:
 * cancel every sequence that this stage cancels, enrol every sequence that
 * starts on it. The SQL that applies plans makes this equivalent to
 * planStageEntry: stopping a sequence that is not running does nothing, and
 * enrolling one that is already running is skipped (one active enrolment per
 * sequence). For callers without database read access (the payment webhook).
 */
export function fullStagePlan(
  sequences: readonly SequenceDefinition[],
  toStage: string,
  now: Date = new Date(),
): SequencePlan {
  return {
    cancel: sequences
      .filter((s) => s.cancelOnStages.includes(toStage))
      .map((s) => ({ sequenceId: s.id, reason: 'stage_changed' as const })),
    enroll: sequences
      .filter((s) => s.enrolOnStage === toStage)
      .map((s) => ({ sequenceId: s.id, steps: scheduleSteps(s, now) })),
  };
}

/** Everything the worker re-checks just before sending a step. */
export interface SendContext {
  enrollmentStatus: 'active' | 'completed' | 'stopped';
  leadStage: string;
  optedOut: boolean;
  erased: boolean;
  contactConsent: boolean;
  replied: boolean;
}

/**
 * Why a step must not be sent, or null when it may go out. Checked at send
 * time, so a reply, opt-out or withdrawal is honoured immediately even for
 * messages already scheduled.
 */
export function stopReasonFor(sequence: SequenceDefinition, context: SendContext): StopReason | null {
  if (context.erased) return 'lead_erased';
  if (!context.contactConsent) return 'consent_withdrawn';
  if (context.optedOut) return 'opted_out';
  if (context.replied) return 'replied';
  if (context.enrollmentStatus !== 'active') return context.enrollmentStatus === 'completed' ? 'completed' : 'manual';
  if (sequence.cancelOnStages.includes(context.leadStage)) return 'stage_changed';
  return null;
}

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  replied: 'Lead replied',
  opted_out: 'Lead unsubscribed',
  consent_withdrawn: 'Consent withdrawn',
  lead_erased: 'Lead data erased',
  stage_changed: 'Stage changed',
  manual: 'Stopped by staff',
  completed: 'Completed',
};
