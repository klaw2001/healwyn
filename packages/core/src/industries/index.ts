import { clinicPack } from './clinic';
import { homeInteriorsPack } from './home-interiors';
import { realEstatePack } from './real-estate';
import type { ChoiceQuestion, IndustryPack, PipelineStage, QualifyingQuestion } from './types';
import { wealthAdvisoryPack } from './wealth-advisory';

export * from './ids';
export * from './types';
export { clinicPack } from './clinic';

/** Every available pack, keyed by id (the ids are listed in ids.ts). */
export const industryPacks = {
  clinic: clinicPack,
  home_interiors: homeInteriorsPack,
  real_estate: realEstatePack,
  wealth_advisory: wealthAdvisoryPack,
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
 * The default pack, for code with no request or lead in hand. The website picks
 * a pack per request (the demo cookie or INDUSTRY), the CRM uses the signed-in
 * staff member's industry, and anything acting on a lead uses that lead's pack.
 */
export function getActivePack(): IndustryPack {
  return getIndustryPack(DEFAULT_INDUSTRY_ID);
}

/** Questions shown on the web form, in order. */
export function formQuestions(pack: Pick<IndustryPack, 'intake'>): readonly QualifyingQuestion[] {
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
