import { z } from 'zod';

/**
 * Contracts between the TypeScript apps and the Python voice agent. JSON
 * Schema files are generated from these (packages/core/contracts) and the
 * agent's pydantic models are generated from those (`pnpm contracts`).
 * Change a contract here, run `pnpm contracts`, and commit both sides;
 * `pnpm contracts:check` fails when they drift.
 */

const code = z.string().regex(/^[a-z0-9_.:-]{1,64}$/);
/** Text by language code; `en` is always present (checked when the script is built). */
const localized = z.record(z.string(), z.string());
const localizedList = z.record(z.string(), z.array(z.string()));

export const voiceScriptSchema = z
  .object({
    version: z.literal(1),
    packId: z.string(),
    /** The industry, for the classifier's instructions (e.g. "Multi-specialty clinic"). */
    industry: z.string(),
    brand: z.string(),
    assistantName: z.string(),
    languages: z.array(z.object({ code: z.string(), label: z.string(), nativeLabel: z.string() })).min(1),
    greeting: localized,
    consentQuestion: localized,
    consentDeclined: localized,
    goodbye: localized,
    limitReached: localized,
    questions: z
      .array(
        z
          .object({
            id: z.string(),
            kind: z.enum(['select', 'radio', 'text', 'textarea']).meta({ title: 'QuestionKind' }),
            required: z.boolean(),
            prompt: localized,
            maxLength: z.number().int().nullable(),
            confirm: localized.nullable(),
            options: z.array(
              z.object({ value: z.string(), label: localized, synonyms: localizedList }).meta({ title: 'VoiceOption' }),
            ),
          })
          .meta({ title: 'VoiceQuestion' }),
      )
      .min(1),
    offeringQuestionId: z.string(),
    offeringUnsureValue: z.string(),
    messageQuestionId: z.string(),
    billingRule: z.object({ questionId: z.string(), equals: z.string() }).nullable(),
    reprompts: z.object({ unclear: localized, moveOn: localized, skipped: localized, offTopic: localized }),
    confirm: z.object({ ask: localized, fix: localized }),
    closing: localized,
    callback: z.object({ questionId: z.string(), phrases: z.record(z.string(), localized), fallback: localized }),
    identity: z.object({ phrases: localizedList, reply: localized }),
    safety: z.object({
      emergencyNumber: z.string(),
      emergencyMessage: localized,
      redFlags: z.array(z.object({ id: code, label: z.string(), phrases: localizedList }).meta({ title: 'RedFlag' })),
      negations: localizedList,
      adviceRequests: localizedList,
      adviceCues: localizedList,
      adviceTopics: localizedList,
      adviceDecline: localized,
      adviceCode: code,
      injection: localizedList,
      injectionReply: localized,
      highUrgency: localizedList,
    }),
    yes: localizedList,
    no: localizedList,
    skip: localizedList,
    hangup: localizedList,
    summary: z.array(z.string()),
    staffNotes: z.object({ redFlag: z.string(), advice: z.string() }),
    limits: z.object({
      maxCallSeconds: z.number().int().positive(),
      maxTurns: z.number().int().positive(),
      maxCallsPerDay: z.number().int().positive(),
      maxCallsPerPhonePerDay: z.number().int().positive(),
      callWindow: z.object({ startHour: z.number().int(), endHour: z.number().int(), timeZone: z.string() }),
    }),
  })
  .meta({
    title: 'VoiceScript',
    description: 'Everything the voice agent says and listens for, built from an industry pack.',
  });

export type VoiceScript = z.infer<typeof voiceScriptSchema>;

export const VOICE_CHANNELS = ['browser', 'phone', 'simulated', 'text'] as const;
export type VoiceChannel = (typeof VOICE_CHANNELS)[number];
export const VOICE_OUTCOMES = [
  'completed',
  'consent_declined',
  'no_consent',
  'emergency',
  'caller_ended',
  'limit_reached',
  'error',
] as const;
export const SAFETY_FLAG_KINDS = ['red_flag', 'advice_request', 'prompt_injection'] as const;

export const voiceCallResultSchema = z
  .object({
    version: z.literal(1),
    callId: z.uuid(),
    leadId: z.uuid(),
    channel: z.enum(VOICE_CHANNELS).meta({ title: 'CallChannel' }),
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }),
    durationSeconds: z.number().int().min(0).max(7200),
    language: z.string().regex(/^[a-z]{2}$/),
    /** The caller agreed to continue with the assistant. */
    consentToContinue: z.boolean(),
    outcome: z.enum(VOICE_OUTCOMES).meta({ title: 'CallOutcome' }),
    urgency: z.enum(['low', 'normal', 'high', 'urgent']).meta({ title: 'Urgency' }),
    /** Answers by intake question id (option values, or short text for free-text questions). */
    answers: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,49}$/), z.string().max(500)),
    safetyFlags: z
      .array(
        z
          .object({
            kind: z.enum(SAFETY_FLAG_KINDS).meta({ title: 'SafetyFlagKind' }),
            code,
            turn: z.number().int().min(0),
          })
          .meta({ title: 'SafetyFlag' }),
      )
      .max(50),
    /** Three to five plain lines for the care team (fewer when the call ended early). */
    summary: z.array(z.string().min(1).max(300)).max(5),
    transcript: z
      .array(
        z.object({
          speaker: z.enum(['assistant', 'caller']).meta({ title: 'Speaker' }),
          text: z.string().max(2000),
          atSeconds: z.number().min(0),
        }),
      )
      .max(200),
    usage: z.object({
      llmRequests: z.number().int().min(0),
      sttSeconds: z.number().min(0),
      ttsCharacters: z.number().int().min(0),
    }),
    agentVersion: z.string().max(40),
  })
  .meta({ title: 'VoiceCallResult', description: 'What the voice agent posts to the CRM at the end of every call.' });

export type VoiceCallResult = z.infer<typeof voiceCallResultSchema>;
