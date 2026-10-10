import { consentPlainText, sha256Hex } from './consent';
import type { IndustryPack } from './industries/types';
import type { IntakeSubmission, PartnerSubmission } from './schemas/intake';

export const LEAD_SOURCES = ['web_form', 'partner_form', 'voice', 'phone', 'staff', 'seed'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_TYPES = ['individual', 'partner'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const URGENCY_LEVELS = ['low', 'normal', 'high', 'urgent'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

/** Proof of exactly what a person agreed to, stored in `consent_records`. */
export interface ConsentEvidence {
  purpose: string;
  granted: boolean;
  textVersion: string;
  /** SHA-256 of the exact wording shown (see consentPlainText). */
  textHash: string;
}

/**
 * Everything needed to create a lead. This is the JSON contract for the
 * `submit_lead(payload jsonb)` database function.
 */
export interface NewLeadPayload {
  industry: string;
  leadType: LeadType;
  source: LeadSource;
  stage: string;
  fullName: string;
  phone: string;
  email: string | null;
  preferredLanguage: string;
  specialtySlug: string | null;
  /** Free text. Stored in the database only; never logged or emailed. */
  message: string | null;
  answers: Record<string, string>;
  consents: ConsentEvidence[];
  isDemo: boolean;
}

async function consentEvidence(
  definitions: IndustryPack['intake']['consents'],
  decisions: Record<string, boolean>,
): Promise<ConsentEvidence[]> {
  return Promise.all(
    definitions.map(async (def) => ({
      purpose: def.id,
      granted: decisions[def.id] === true,
      textVersion: def.version,
      textHash: await sha256Hex(consentPlainText(def)),
    })),
  );
}

export async function intakeToLeadPayload(
  submission: IntakeSubmission,
  pack: IndustryPack,
  options: { source?: LeadSource; isDemo?: boolean } = {},
): Promise<NewLeadPayload> {
  const { offeringQuestionId, offeringUnsureValue, messageQuestionId } = pack.intake;
  const { [messageQuestionId]: message, ...answers } = submission.answers;
  const offering = answers[offeringQuestionId];
  const specialtySlug =
    offering && offering !== offeringUnsureValue && pack.offerings.some((o) => o.slug === offering) ? offering : null;

  return {
    industry: pack.id,
    leadType: 'individual',
    source: options.source ?? 'web_form',
    stage: pack.initialStageId,
    fullName: submission.fullName,
    phone: submission.phone,
    email: submission.email,
    preferredLanguage: submission.preferredLanguage,
    specialtySlug,
    message: message ?? null,
    answers,
    consents: await consentEvidence(pack.intake.consents, submission.consents),
    isDemo: options.isDemo ?? false,
  };
}

export async function partnerToLeadPayload(
  submission: PartnerSubmission,
  pack: IndustryPack,
  options: { isDemo?: boolean; preferredLanguage?: string } = {},
): Promise<NewLeadPayload> {
  return {
    industry: pack.id,
    leadType: 'partner',
    source: 'partner_form',
    stage: pack.initialStageId,
    fullName: submission.contactName,
    phone: submission.phone,
    email: submission.email,
    preferredLanguage: options.preferredLanguage ?? pack.languages[0]?.code ?? 'en',
    specialtySlug: null,
    message: submission.message,
    answers: {
      organisation: submission.organisation,
      role: submission.role,
      partner_type: submission.partnerType,
    },
    consents: await consentEvidence(pack.partnerIntake.consents, submission.consents),
    isDemo: options.isDemo ?? false,
  };
}

/** A short, human-friendly reference for a lead id, e.g. "3F2A-91BC". */
export function formatLeadReference(id: string): string {
  const hex = id.replaceAll('-', '').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
