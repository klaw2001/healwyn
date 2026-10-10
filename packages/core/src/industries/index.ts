import { clinicPack } from './clinic';
import type { ChoiceQuestion, IndustryPack, PipelineStage, QualifyingQuestion } from './types';

export * from './types';
export { clinicPack } from './clinic';

/** Every available pack. Phase 4 adds real estate, wealth advisory and home interiors. */
export const industryPacks = {
  clinic: clinicPack,
} as const satisfies Record<string, IndustryPack>;

export type IndustryId = keyof typeof industryPacks;

export const DEFAULT_INDUSTRY_ID: IndustryId = 'clinic';

export function isIndustryId(value: string): value is IndustryId {
  return Object.hasOwn(industryPacks, value);
}

export function getIndustryPack(id: string = DEFAULT_INDUSTRY_ID): IndustryPack {
  if (!isIndustryId(id)) throw new Error(`Unknown industry pack: ${id}`);
  return industryPacks[id];
}

/**
 * The pack the running app uses. Phase 1 always returns the clinic pack;
 * Phase 4 adds a runtime switch (demo bar) behind this same function.
 */
export function getActivePack(): IndustryPack {
  return getIndustryPack(DEFAULT_INDUSTRY_ID);
}

/** Questions shown on the web form, in order. */
export function formQuestions(pack: IndustryPack): readonly QualifyingQuestion[] {
  return pack.intake.questions.filter((q) => q.channels.includes('form'));
}

export function getQuestion(pack: IndustryPack, id: string): QualifyingQuestion {
  const question = pack.intake.questions.find((q) => q.id === id);
  if (!question) throw new Error(`Pack ${pack.id} has no question ${id}`);
  return question;
}

export function getOfferingQuestion(pack: IndustryPack): ChoiceQuestion {
  const question = getQuestion(pack, pack.intake.offeringQuestionId);
  if (question.kind !== 'select' && question.kind !== 'radio') {
    throw new Error(`Offering question ${question.id} must be a choice question`);
  }
  return question;
}

export function getStage(pack: IndustryPack, id: string): PipelineStage {
  const stage = pack.stages.find((s) => s.id === id);
  if (!stage) throw new Error(`Pack ${pack.id} has no stage ${id}`);
  return stage;
}

export function optionLabel(question: QualifyingQuestion, value: string): string {
  if (question.kind === 'select' || question.kind === 'radio') {
    return question.options.find((o) => o.value === value)?.label ?? value;
  }
  return value;
}
