import type { Brand } from '../brand';
import type { MessageTemplate, NoteTemplate, ScoreRule, SequenceDefinition, SlaTargets } from '../crm/types';
import type { StaffRole } from '../permissions';
import type { RoutingConfig } from '../routing/types';
import type { VoicePackConfig } from '../voice/types';
import type { DemoLead, DemoStaffMember } from './demo-kit';

/**
 * An industry pack is the complete configuration for one vertical: clinic, real
 * estate, wealth advisory and home interiors. The brand, the public site's copy
 * and theme, forms, pipeline stages, staff levels, nurture sequences, routing,
 * the voice assistant's script and safety rules, booking, payments and demo data
 * are all read from a pack, so switching verticals never needs code changes.
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

// -- Public site ---------------------------------------------------------------------------------

/** Colour tokens a pack overrides (the rest of the palette is shared). Every pairing is contrast-tested. */
export interface ThemeTokens {
  readonly primary: string;
  readonly primaryHover: string;
  readonly primarySoft: string;
  readonly onPrimary: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentInk: string;
  readonly onAccent: string;
  /** Tinted section background (the clinic's teal wash). */
  readonly surfaceTint: string;
  readonly focus: string;
}

export interface PackTheme {
  readonly light: ThemeTokens;
  readonly dark: ThemeTokens;
}

/** Icons the site can draw for an offering (apps/web/components/illustrations/offering-icon.tsx). */
export type OfferingIcon =
  | 'stethoscope'
  | 'skin'
  | 'tooth'
  | 'movement'
  | 'womens-health'
  | 'diagnostics'
  | 'apartment'
  | 'villa'
  | 'plot'
  | 'key'
  | 'office'
  | 'loan'
  | 'chart'
  | 'shield'
  | 'piggy-bank'
  | 'graduation'
  | 'scales'
  | 'family'
  | 'sofa'
  | 'kitchen'
  | 'bed'
  | 'ruler'
  | 'paint'
  | 'lamp';

/** Hero illustration motif for the home page. */
export type HeroMotif = 'clinic' | 'home' | 'growth' | 'room';

export interface OfferingDetail {
  readonly slug: string;
  readonly icon: OfferingIcon;
  readonly tagline: string;
  readonly intro: string;
  /** Why people get in touch. Informational only, never advice. */
  readonly reasons: readonly string[];
  /** What happens at the first meeting or visit. */
  readonly firstSteps: readonly string[];
}

/** An illustrative package or plan. Never a real price or a real product. */
export interface Plan {
  readonly id: string;
  readonly name: string;
  readonly forWhom: string;
  readonly includes: readonly string[];
  readonly duration: string;
  readonly offeringSlug: string;
}

export interface SiteLocation {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  /** Fictional address lines in a real city. */
  readonly addressLines: readonly string[];
  readonly hours: readonly { readonly days: string; readonly time: string }[];
  /** Offering slugs available here. */
  readonly offerings: readonly string[];
  readonly access: readonly string[];
}

export interface PartnerAudience {
  /** A partner type value from `partnerIntake.partnerTypes`. */
  readonly type: string;
  readonly title: string;
  readonly summary: string;
  readonly offers: readonly string[];
}

export interface TitledText {
  readonly title: string;
  readonly body: string;
}

/** A page's header and its meta description. */
export interface PageIntro {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  /** For <meta name="description">. */
  readonly description: string;
}

/** Every piece of public copy that differs by industry. No real people, prices or advice. */
export interface SiteCopy {
  readonly hero: HeroMotif;
  /** Navigation labels for the shared routes (/services, /team, /plans, /locations, /partners). */
  readonly nav: {
    readonly services: string;
    readonly team: string;
    readonly plans: string;
    readonly locations: string;
    readonly partners: string;
  };
  /** The talk-to-us button, e.g. "Talk to us". */
  readonly ctaLabel: string;
  readonly home: {
    readonly eyebrow: string;
    readonly intro: string;
    readonly assistantNote: string;
    readonly highlights: readonly string[];
    readonly howItWorks: { readonly title: string; readonly intro: string; readonly steps: readonly TitledText[] };
    readonly services: { readonly eyebrow: string; readonly title: string; readonly intro: string };
    readonly partnersStrip: string;
    readonly trust: {
      readonly eyebrow: string;
      readonly title: string;
      readonly intro: string;
      readonly points: readonly TitledText[];
    };
    readonly cta: { readonly title: string; readonly body: string };
  };
  readonly services: PageIntro & {
    readonly reasonsHeading: string;
    readonly firstStepsHeading: string;
    /** Singular and plural for the people in a team, e.g. ["clinician", "clinicians"]. */
    readonly memberNoun: readonly [string, string];
    readonly notSure: TitledText;
    readonly details: readonly OfferingDetail[];
  };
  readonly team: PageIntro & {
    readonly notice: TitledText;
    /** Card labels, e.g. "Specialty", "Clinics". */
    readonly offeringLabel: string;
    readonly locationsLabel: string;
  };
  readonly plans: PageIntro & { readonly notice: TitledText; readonly items: readonly Plan[] };
  readonly locations: PageIntro & {
    readonly notice: string;
    readonly offeringsLabel: string;
    readonly items: readonly SiteLocation[];
  };
  readonly partners: PageIntro & {
    readonly audiences: readonly PartnerAudience[];
    /** Fictional partner names for the home page strip. */
    readonly wordmarks: readonly string[];
    readonly formIntro: string;
    /** Sends individuals to the contact page: "If you are {individual}, please use the contact page." */
    readonly notPartner: { readonly title: string; readonly individual: string };
  };
  readonly contact: PageIntro & { readonly steps: readonly TitledText[]; readonly assistantBody: string };
  /** Shown in the assistant's dialog before the visitor starts. */
  readonly assistantIntro: string;
  readonly privacy: {
    /** One sentence: what the brand is, for the notice's opening. */
    readonly about: string;
    readonly contactPurpose: string;
    readonly assistantPurpose: string;
    /** Things not to put in the free-text note, e.g. "test results, diagnoses, medicines or ID numbers". */
    readonly sensitiveExamples: string;
    readonly retention: string;
  };
  readonly legal: {
    /** One line under every legal page: what it was written for. */
    readonly note: string;
    /** What the demo shows, e.g. "a patient enquiry platform". */
    readonly platform: string;
    /** "No {things} on this site exists", e.g. "clinic, doctor, package or service". */
    readonly fictionalThings: string;
    /** The disclaimer's "What is fictional" list. */
    readonly fictionalList: readonly string[];
    readonly noAdviceHeading: string;
    /** e.g. "Nothing on this site creates a doctor-patient relationship." */
    readonly relationship: string;
    /** e.g. "health information". */
    readonly sensitiveData: string;
    /** e.g. "Do not rely on anything here for health decisions." */
    readonly dontRely: string;
  };
}

// -- Booking and payments --------------------------------------------------------------------------

export interface BookingConfig {
  /** What a booking is called, e.g. "consultation", "site visit". */
  readonly noun: string;
  readonly slotMinutes: number;
  /** How many days ahead the public site offers slots. */
  readonly horizonDays: number;
  /** Staff roles whose calendars take bookings. */
  readonly bookableRoles: readonly StaffRole[];
  readonly bookedStageId: string;
  readonly attendedStageId: string;
  readonly noShowStageId: string;
  /** Default weekly hours for demo staff, India time. ISO weekdays: 1 = Monday … 7 = Sunday. */
  readonly defaultHours: { readonly weekdays: readonly number[]; readonly start: string; readonly end: string };
}

export interface PaymentProduct {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** In paise. Fictional test amounts only. */
  readonly amountPaise: number;
}

export interface PaymentConfig {
  readonly products: readonly PaymentProduct[];
  /** The stage a lead moves to when a payment is captured. */
  readonly paidStageId: string;
}

export interface IndustryPack {
  readonly id: string;
  readonly label: string;
  /** What a lead is called in this industry, e.g. "patient". */
  readonly leadNoun: string;
  /** The fictional brand (from brand.ts). */
  readonly brand: Brand;
  /** How each CRM role is named in this industry. */
  readonly roleLabels: Readonly<Record<StaffRole, string>>;
  readonly theme: PackTheme;
  readonly site: SiteCopy;
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
  /** What the voice assistant says and listens for (Phase 3). */
  readonly voice: VoicePackConfig;
  /** Nurture sequences: steps, enrolment stage and the stages that stop them. */
  readonly sequences: readonly SequenceDefinition[];
  readonly crm: {
    readonly templates: readonly MessageTemplate[];
    readonly noteTemplates: readonly NoteTemplate[];
    readonly sla: SlaTargets;
    readonly scoring: readonly ScoreRule[];
  };
  readonly booking: BookingConfig;
  readonly payments: PaymentConfig;
  /** Synthetic staff and leads for the demo (seed, team page, demo sign-in). */
  readonly demo: {
    readonly staff: readonly DemoStaffMember[];
    readonly leads: readonly DemoLead[];
  };
}

/**
 * The part of a pack the browser needs for forms (schemas, questions, consents,
 * the brand for consent wording). Server pages pass this to client components
 * instead of the whole pack, so the browser never downloads every industry.
 */
export type FormPack = Pick<IndustryPack, 'id' | 'leadNoun' | 'brand' | 'languages' | 'intake' | 'partnerIntake'> & {
  readonly voice: Pick<VoicePackConfig, 'callConsentId'>;
  readonly booking: Pick<BookingConfig, 'noun'>;
};

export function toFormPack(pack: IndustryPack): FormPack {
  const { id, leadNoun, brand, languages, intake, partnerIntake, voice, booking } = pack;
  return {
    id,
    leadNoun,
    brand,
    languages,
    intake,
    partnerIntake,
    voice: { callConsentId: voice.callConsentId },
    booking: { noun: booking.noun },
  };
}
