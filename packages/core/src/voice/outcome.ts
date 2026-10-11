import type { IndustryPack } from '../industries/types';
import type { VoiceCallResult } from './contract';

/** Lead fields the CRM derives from a finished call (snake_case: passed straight to SQL). */
export interface VoiceLeadUpdate {
  answers: Record<string, string>;
  specialty_slug?: string | null;
  billing_flag?: boolean;
  urgency: VoiceCallResult['urgency'];
  preferred_language?: string;
  message?: string;
  withdraw_purpose?: string;
}

export class VoiceResultError extends Error {
  override readonly name = 'VoiceResultError';
}

/**
 * Checks a call's answers against the pack (only voice questions, only known
 * option values, free text within its limit) and derives the lead update.
 * Throws VoiceResultError on anything the pack does not allow.
 */
export function leadUpdateFromCall(result: VoiceCallResult, pack: IndustryPack): VoiceLeadUpdate {
  const voiceIds = new Set(pack.voice.questions.map((q) => q.id));
  const answers: Record<string, string> = {};
  let message: string | undefined;
  for (const [id, value] of Object.entries(result.answers)) {
    const question = pack.intake.questions.find((q) => q.id === id);
    if (!question || !voiceIds.has(id)) throw new VoiceResultError(`unknown question ${id}`);
    if ('options' in question) {
      if (!question.options.some((o) => o.value === value)) throw new VoiceResultError(`unknown answer for ${id}`);
      answers[id] = value;
    } else {
      const text = value.trim().slice(0, question.maxLength);
      if (id === pack.intake.messageQuestionId) message = text || undefined;
      else if (text) answers[id] = text;
    }
  }
  if (!pack.languages.some((l) => l.code === result.language)) throw new VoiceResultError('unknown language');

  const update: VoiceLeadUpdate = { answers, urgency: result.urgency, preferred_language: result.language };
  const offering = answers[pack.intake.offeringQuestionId];
  if (offering !== undefined) {
    update.specialty_slug = offering === pack.intake.offeringUnsureValue ? null : offering;
  }
  if (pack.billingRule && answers[pack.billingRule.questionId] !== undefined) {
    update.billing_flag = answers[pack.billingRule.questionId] === pack.billingRule.equals;
  }
  if (message) update.message = message;
  if (result.outcome === 'consent_declined') update.withdraw_purpose = pack.voice.callConsentId;
  return update;
}

/**
 * Where a lead goes after a call: to the pack's triaged stage when the call
 * qualified it (or ended in an emergency, so a human picks it up) and the lead
 * is still in the initial stage. Leads further along stay where they are.
 */
export function stageAfterCall(result: VoiceCallResult, currentStage: string, pack: IndustryPack): string | null {
  if (currentStage !== pack.initialStageId) return null;
  const qualified =
    result.outcome === 'completed' ||
    result.outcome === 'emergency' ||
    ((result.outcome === 'caller_ended' || result.outcome === 'limit_reached') &&
      Object.keys(result.answers).length > 0);
  return qualified ? pack.voice.triagedStageId : null;
}

/** Whether the routing engine should run after a call. */
export function shouldRouteAfterCall(result: VoiceCallResult, assignedStaffId: string | null): boolean {
  if (result.outcome === 'consent_declined' || result.outcome === 'no_consent') return false;
  // Nothing was collected before consent, except an emergency, which a person must pick up.
  return assignedStaffId === null && (result.consentToContinue || result.outcome === 'emergency');
}
