import type { MessageTemplate, NoteTemplate, ScoreRule, SequenceDefinition, SlaTargets } from '../crm/types';
import type { RoutingConfig } from '../routing/types';

/**
 * An industry pack is the complete configuration for one vertical (clinic today;
 * real estate, wealth advisory and home interiors in Phase 4). Forms, pipeline
 * stages, staff levels and nurture sequences are all read from the active pack,
 * so swapping verticals never needs code changes elsewhere.
 */

export interface Option<V extends string = string> {
  readonly value: V;
  readonly label: string;
  readonly description?: string;
}

export interface LanguageOption {
  /** BCP 47 code used for the `lang` attribute and stored on the lead. */
  readonly code: string;
  /** The language's own name, e.g. "हिन्दी". */
  readonly nativeLabel: string;
  /** The English name, e.g. "Hindi". */
  readonly label: string;
}

export type Channel = 'form' | 'voice';

interface QuestionBase {
  /** Stable key stored in `leads.answers`. Never rename once leads exist. */
  readonly id: string;
  /** Label shown on the web form. */
  readonly label: string;
  /** How the voice assistant asks the same question (Phase 3). */
  readonly voicePrompt: string;
  readonly required: boolean;
  readonly hint?: string;
  /** Where this question is asked. */
  readonly channels: readonly Channel[];
}

export interface ChoiceQuestion extends QuestionBase {
  readonly kind: 'select' | 'radio';
  readonly options: readonly Option[];
}

export interface TextQuestion extends QuestionBase {
  readonly kind: 'text' | 'textarea';
  readonly maxLength: number;
}

export type QualifyingQuestion = ChoiceQuestion | TextQuestion;

export interface ConsentDefinition {
  /** Stable purpose id stored in `consent_records.purpose`. */
  readonly id: string;
  /** Bump whenever `text` changes; stored with every consent record. */
  readonly version: string;
  readonly required: boolean;
  /** Short name for staff screens and audit views. */
  readonly title: string;
  /**
   * The exact wording shown next to the checkbox. Tokens: `{brand}`, `{email}`
   * and `{privacy}` (rendered as a link to the privacy notice).
   */
  readonly text: string;
  /** Shown when a required consent is missing. */
  readonly requiredMessage?: string;
  /** Withdrawing this consent erases the lead's personal data (DPDP). */
  readonly erasesDataOnWithdrawal: boolean;
}

export type StageKind = 'open' | 'won' | 'lost';

export interface PipelineStage {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kind: StageKind;
}

export interface StaffLevel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Higher rank handles more complex or urgent work (used by routing in Phase 3). */
  readonly rank: number;
}

/** Which qualifying answer flags a lead for the billing desk (clinic: has insurance). */
export interface BillingRule {
  readonly questionId: string;
  readonly equals: string;
}

/** A thing a lead can be routed to: a specialty for clinics, a service line elsewhere. */
export interface Offering {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
}

export interface IndustryPack {
  readonly id: string;
  readonly label: string;
  /** What a lead is called in this industry, e.g. "patient". */
  readonly leadNoun: string;
  readonly offerings: readonly Offering[];
  readonly languages: readonly LanguageOption[];
  readonly intake: {
    readonly questions: readonly QualifyingQuestion[];
    /** The question whose answer selects an offering (stored as `leads.specialty_slug`). */
    readonly offeringQuestionId: string;
    /** Answer value meaning "not sure": no offering, a coordinator triages. */
    readonly offeringUnsureValue: string;
    /** The free-text question (stored in `leads.message`, never logged). */
    readonly messageQuestionId: string;
    readonly consents: readonly ConsentDefinition[];
  };
  readonly partnerIntake: {
    readonly partnerTypes: readonly Option[];
    readonly messageMaxLength: number;
    readonly consents: readonly ConsentDefinition[];
  };
  readonly stages: readonly PipelineStage[];
  readonly initialStageId: string;
  readonly staffLevels: readonly StaffLevel[];
  readonly billingRule: BillingRule | null;
  /** Routing weights and rules (Phase 3): who a qualified lead goes to, and why. */
  readonly routing: RoutingConfig;
  /** Nurture sequences: steps, enrolment stage and the stages that stop them. */
  readonly sequences: readonly SequenceDefinition[];
  readonly crm: {
    readonly templates: readonly MessageTemplate[];
    readonly noteTemplates: readonly NoteTemplate[];
    readonly sla: SlaTargets;
    readonly scoring: readonly ScoreRule[];
  };
}
