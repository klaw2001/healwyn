/** Phase 2 additions to an industry pack: nurture steps, templates, SLA and scoring rules. */

export const MESSAGE_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export interface SequenceStep {
  /** Minutes after enrolment (not after the previous step). */
  readonly delayMinutes: number;
  readonly channel: MessageChannel;
  readonly templateId: string;
}

export interface SequenceDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Entering this stage enrols the lead. Null means enrolment is triggered elsewhere (e.g. a no-show). */
  readonly enrolOnStage: string | null;
  /** Entering any of these stages stops the sequence. */
  readonly cancelOnStages: readonly string[];
  readonly steps: readonly SequenceStep[];
}

export interface MessageTemplate {
  readonly id: string;
  readonly channel: MessageChannel;
  /** Email only. Tokens: {firstName} {brand} {specialty} {reference} {contactEmail}. */
  readonly subject?: string;
  readonly body: string;
}

export interface NoteTemplate {
  readonly id: string;
  readonly label: string;
  readonly body: string;
}

export const URGENCIES = ['low', 'normal', 'high', 'urgent'] as const;
export type UrgencyLevel = (typeof URGENCIES)[number];

export interface SlaTargets {
  /** Minutes allowed for the first response, per urgency. */
  readonly firstResponseMinutes: Readonly<Record<UrgencyLevel, number>>;
}

export type ScoreCondition =
  | { readonly kind: 'answer'; readonly questionId: string; readonly equals: string }
  | { readonly kind: 'offeringChosen' }
  | { readonly kind: 'hasEmail' }
  | { readonly kind: 'hasMessage' }
  | { readonly kind: 'consent'; readonly purpose: string }
  | { readonly kind: 'urgency'; readonly in: readonly UrgencyLevel[] }
  | { readonly kind: 'stage'; readonly in: readonly string[] }
  | { readonly kind: 'createdWithinHours'; readonly hours: number }
  | { readonly kind: 'replied' }
  | { readonly kind: 'optedOut' };

export interface ScoreRule {
  readonly id: string;
  readonly label: string;
  readonly points: number;
  readonly when: ScoreCondition;
}

export interface CrmConfig {
  readonly sequences: readonly SequenceDefinition[];
  readonly templates: readonly MessageTemplate[];
  readonly noteTemplates: readonly NoteTemplate[];
  readonly sla: SlaTargets;
  readonly scoring: readonly ScoreRule[];
}
