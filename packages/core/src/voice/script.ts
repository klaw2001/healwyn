import { BRAND } from '../brand';
import type { IndustryPack } from '../industries/types';
import { voiceScriptSchema, type VoiceScript } from './contract';
import type { Localized, LocalizedList } from './types';

const fill = (text: string, brand: string, assistant: string, emergency: string) =>
  text.replaceAll('{brand}', brand).replaceAll('{assistant}', assistant).replaceAll('{emergency}', emergency);

/**
 * Builds the voice agent's script from an industry pack: the voice questions
 * in order with prompts, option labels and synonyms in each language, and
 * every line the assistant says with `{brand}` and `{emergency}` filled in.
 * The result is validated against the contract.
 */
export function buildVoiceScript(pack: IndustryPack): VoiceScript {
  const voice = pack.voice;
  const brand = BRAND.name;
  const assistant = voice.assistantName.replaceAll('{brand}', brand);
  const emergency = voice.safety.emergencyNumber;
  const text = (value: Localized): Record<string, string> =>
    Object.fromEntries(Object.entries(value).map(([lang, t]) => [lang, fill(t ?? '', brand, assistant, emergency)]));
  const list = (value: LocalizedList | undefined): Record<string, string[]> =>
    Object.fromEntries(Object.entries(value ?? { en: [] }).map(([lang, items]) => [lang, [...(items ?? [])]]));

  const questions = voice.questions.map((config) => {
    const question = pack.intake.questions.find((q) => q.id === config.id);
    if (!question) throw new Error(`Voice question ${config.id} is not an intake question.`);
    if (!question.channels.includes('voice')) throw new Error(`Question ${config.id} is not asked by voice.`);
    const options = 'options' in question ? question.options : [];
    return {
      id: question.id,
      kind: question.kind,
      required: question.required,
      prompt: text({ en: question.voicePrompt, ...config.prompt }),
      maxLength: 'maxLength' in question ? question.maxLength : null,
      confirm: config.confirm ? text(config.confirm) : null,
      options: options.map((option) => ({
        value: option.value,
        label: text({ en: option.label, ...config.optionLabels?.[option.value] }),
        synonyms: list(config.synonyms?.[option.value]),
      })),
    };
  });

  const script: VoiceScript = {
    version: 1,
    packId: pack.id,
    brand,
    assistantName: assistant,
    languages: pack.languages.map((l) => ({ code: l.code, label: l.label, nativeLabel: l.nativeLabel })),
    greeting: text(voice.greeting),
    consentQuestion: text(voice.consentQuestion),
    consentDeclined: text(voice.consentDeclined),
    goodbye: text(voice.goodbye),
    limitReached: text(voice.limitReached),
    questions,
    offeringQuestionId: pack.intake.offeringQuestionId,
    offeringUnsureValue: pack.intake.offeringUnsureValue,
    messageQuestionId: pack.intake.messageQuestionId,
    billingRule: pack.billingRule ? { ...pack.billingRule } : null,
    reprompts: {
      unclear: text(voice.reprompts.unclear),
      moveOn: text(voice.reprompts.moveOn),
      skipped: text(voice.reprompts.skipped),
      offTopic: text(voice.reprompts.offTopic),
    },
    confirm: { ask: text(voice.confirm.ask), fix: text(voice.confirm.fix) },
    closing: text(voice.closing),
    callback: {
      questionId: voice.callback.questionId,
      phrases: Object.fromEntries(Object.entries(voice.callback.phrases).map(([k, v]) => [k, text(v)])),
      fallback: text(voice.callback.fallback),
    },
    identity: { phrases: list(voice.identity.phrases), reply: text(voice.identity.reply) },
    safety: {
      emergencyNumber: emergency,
      emergencyMessage: text(voice.safety.emergencyMessage),
      redFlags: voice.safety.redFlags.map((f) => ({ id: f.id, label: f.label, phrases: list(f.phrases) })),
      negations: list(voice.safety.negations),
      adviceRequests: list(voice.safety.adviceRequests),
      adviceCues: list(voice.safety.adviceCues),
      adviceTopics: list(voice.safety.adviceTopics),
      adviceDecline: text(voice.safety.adviceDecline),
      injection: list(voice.safety.injection),
      injectionReply: text(voice.safety.injectionReply),
      highUrgency: list(voice.safety.highUrgency),
    },
    yes: list(voice.yes),
    no: list(voice.no),
    skip: list(voice.skip),
    hangup: list(voice.hangup),
    summary: [...voice.summary],
    limits: {
      maxCallSeconds: voice.limits.maxCallSeconds,
      maxTurns: voice.limits.maxTurns,
      maxCallsPerDay: voice.limits.maxCallsPerDay,
      callWindow: { ...voice.limits.callWindow },
    },
  };
  return voiceScriptSchema.parse(script);
}
