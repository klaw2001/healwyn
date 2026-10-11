/**
 * Voice assistant configuration, part of an industry pack. Everything the
 * assistant says, and every phrase list it listens for, lives here, so the
 * Python agent stays industry-neutral. Text is keyed by language code; English
 * (`en`) is required, other pack languages are optional and fall back to it.
 * Tokens: `{brand}`, `{assistant}`, `{emergency}`, `{time}`, `{summary}`.
 */

export type Localized = Readonly<{ en: string } & Partial<Record<string, string>>>;
export type LocalizedList = Readonly<{ en: readonly string[] } & Partial<Record<string, readonly string[]>>>;

export interface RedFlag {
  /** Stable code stored on the call (never the caller's words). */
  readonly id: string;
  readonly label: string;
  /** Phrases that indicate it, per language (lower case; matched on word boundaries). */
  readonly phrases: LocalizedList;
}

export interface VoiceQuestionConfig {
  /** An intake question id; its English prompt is the question's `voicePrompt`. */
  readonly id: string;
  /** Prompts in other languages. */
  readonly prompt?: Partial<Record<string, string>>;
  /** Option labels in other languages, by option value. */
  readonly optionLabels?: Readonly<Record<string, Partial<Record<string, string>>>>;
  /** Extra words that mean each option, by option value. */
  readonly synonyms?: Readonly<Record<string, LocalizedList>>;
  /** How the answer is read back when confirming; `{answer}` is the option label. Omit to leave it out. */
  readonly confirm?: Localized;
}

export interface VoicePackConfig {
  readonly assistantName: string;
  /** The consent that allows assistant calls; declining on a call withdraws it. */
  readonly callConsentId: string;
  /** The stage a lead moves to after the assistant qualifies it (from the initial stage only). */
  readonly triagedStageId: string;
  /** The opening: says it is an AI assistant and asks consent to continue. */
  readonly greeting: Localized;
  /** Asked again when the answer to the greeting was unclear. */
  readonly consentQuestion: Localized;
  readonly consentDeclined: Localized;
  /** The caller ends the call before the end. */
  readonly goodbye: Localized;
  /** The call reached its time or turn limit. */
  readonly limitReached: Localized;
  readonly questions: readonly VoiceQuestionConfig[];
  readonly reprompts: {
    /** The answer did not match an option. */
    readonly unclear: Localized;
    /** Second miss on a required question: move on, a person will confirm. */
    readonly moveOn: Localized;
    /** The caller wants to skip an optional question. */
    readonly skipped: Localized;
    /** The caller talked about something else. */
    readonly offTopic: Localized;
  };
  readonly confirm: {
    /** "Let me check I have this right: {summary}. Is that right?" */
    readonly ask: Localized;
    /** The caller said something is wrong. */
    readonly fix: Localized;
  };
  readonly closing: Localized;
  /** `{time}` in the closing line: a phrase per answer to this question, or the fallback. */
  readonly callback: {
    readonly questionId: string;
    readonly phrases: Readonly<Record<string, Localized>>;
    readonly fallback: Localized;
  };
  readonly identity: { readonly phrases: LocalizedList; readonly reply: Localized };
  readonly safety: {
    readonly emergencyNumber: string;
    /** Said when a red flag is heard; the intake stops. */
    readonly emergencyMessage: Localized;
    readonly redFlags: readonly RedFlag[];
    /** Words that negate a red flag just before it ("no chest pain"). */
    readonly negations: LocalizedList;
    /** Requests for diagnosis, treatment, medication or result interpretation. */
    readonly adviceRequests: LocalizedList;
    /** Also an advice request: a question cue ("can I", "which") together with a medical topic ("tablet"). */
    readonly adviceCues: LocalizedList;
    readonly adviceTopics: LocalizedList;
    readonly adviceDecline: Localized;
    /** Attempts to change the assistant's rules or extract its instructions. */
    readonly injection: LocalizedList;
    readonly injectionReply: Localized;
    /** Phrases that make a lead high urgency without being an emergency. */
    readonly highUrgency: LocalizedList;
  };
  readonly yes: LocalizedList;
  readonly no: LocalizedList;
  /** "Skip", "nothing", "I'd rather not say" for optional questions. */
  readonly skip: LocalizedList;
  /** The caller wants to end the call. */
  readonly hangup: LocalizedList;
  /** Summary lines; `{question_id}` becomes the answer's label. Lines with a missing answer are dropped. */
  readonly summary: readonly string[];
  readonly limits: {
    readonly maxCallSeconds: number;
    readonly maxTurns: number;
    /** Per cap group (website, phone, simulated), across the deployment. */
    readonly maxCallsPerDay: number;
    /** Website calls from one phone number in a day. */
    readonly maxCallsPerPhonePerDay: number;
    /** Calls only between these hours, local time (the phone path). */
    readonly callWindow: { readonly startHour: number; readonly endHour: number; readonly timeZone: string };
  };
}
