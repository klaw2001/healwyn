import type { IndustryPack } from '../industries/types';

/**
 * What a simulated caller says on the dialer's simulated call: they agree to
 * continue, answer each voice question with what they already wrote on the
 * form (in their language), and confirm. This runs the real conversation
 * engine end to end without a phone line.
 */
export function simulatedCallerTurns(
  pack: IndustryPack,
  lead: { answers: Readonly<Record<string, string>>; message: string | null; language: string },
): string[] {
  const voice = pack.voice;
  const lang = pack.languages.some((l) => l.code === lead.language) ? lead.language : 'en';
  const pick = (list: { en: readonly string[] } & Partial<Record<string, readonly string[]>>) =>
    (list[lang] ?? list.en)[0] ?? list.en[0] ?? '';
  const turns = [pick(voice.yes)];
  for (const config of voice.questions) {
    const question = pack.intake.questions.find((q) => q.id === config.id);
    if (!question) continue;
    if (!('options' in question)) {
      turns.push(config.id === pack.intake.messageQuestionId && lead.message ? lead.message : pick(voice.skip));
      continue;
    }
    const value =
      lead.answers[question.id] ??
      (question.id === pack.intake.offeringQuestionId ? pack.intake.offeringUnsureValue : undefined);
    const option = question.options.find((o) => o.value === value);
    turns.push(option ? (config.optionLabels?.[option.value]?.[lang] ?? option.label) : pick(voice.skip));
  }
  turns.push(pick(voice.yes));
  return turns;
}
