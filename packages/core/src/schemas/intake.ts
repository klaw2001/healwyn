import { z } from 'zod';
import { consentFieldName } from '../consent';
import { formQuestions } from '../industries';
import type { IndustryPack } from '../industries/types';
import {
  boundedTextSchema,
  choiceSchema,
  consentSchema,
  indianMobileSchema,
  languageSchema,
  optionalEmailSchema,
  personNameSchema,
  questionSchema,
  requiredEmailSchema,
} from './fields';

/** Form field names shared by every pack. Question ids and consent fields are added per pack. */
export const INTAKE_FIELDS = {
  fullName: 'full_name',
  phone: 'phone',
  email: 'email',
  preferredLanguage: 'preferred_language',
} as const;

export const PARTNER_FIELDS = {
  organisation: 'organisation',
  contactName: 'contact_name',
  role: 'role',
  phone: 'phone',
  email: 'email',
  partnerType: 'partner_type',
  message: 'message',
} as const;

/** Hidden spam trap. Real people never see or fill it. */
export const HONEYPOT_FIELD = 'website';

export interface IntakeSubmission {
  fullName: string;
  /** E.164, e.g. +919876543210 */
  phone: string;
  email: string | null;
  preferredLanguage: string;
  /** Qualifying answers keyed by question id. Blank optional answers are omitted. */
  answers: Record<string, string>;
  /** Consent decisions keyed by consent id. */
  consents: Record<string, boolean>;
}

export interface PartnerSubmission {
  organisation: string;
  contactName: string;
  role: string;
  phone: string;
  email: string;
  partnerType: string;
  message: string;
  consents: Record<string, boolean>;
}

/** Raw values as they come from a form post or client state. */
export type FormValues = Record<string, unknown>;

/**
 * Builds the patient-enquiry schema from an industry pack, so the form, the
 * server and Phase 4's other industries all share one definition.
 */
export function buildIntakeSchema(pack: IndustryPack): z.ZodType<IntakeSubmission, FormValues> {
  const questions = formQuestions(pack);
  const shape: Record<string, z.ZodType> = {
    [INTAKE_FIELDS.fullName]: personNameSchema,
    [INTAKE_FIELDS.phone]: indianMobileSchema,
    [INTAKE_FIELDS.email]: optionalEmailSchema,
    [INTAKE_FIELDS.preferredLanguage]: languageSchema(pack),
  };
  for (const question of questions) shape[question.id] = questionSchema(question);
  for (const consent of pack.intake.consents) shape[consentFieldName(consent.id)] = consentSchema(consent);

  return z.object(shape).transform((values): IntakeSubmission => {
    const answers: Record<string, string> = {};
    for (const question of questions) {
      const value = values[question.id];
      if (typeof value === 'string' && value !== '') answers[question.id] = value;
    }
    const consents: Record<string, boolean> = {};
    for (const consent of pack.intake.consents) {
      consents[consent.id] = values[consentFieldName(consent.id)] === true;
    }
    return {
      fullName: values[INTAKE_FIELDS.fullName] as string,
      phone: values[INTAKE_FIELDS.phone] as string,
      email: (values[INTAKE_FIELDS.email] as string | undefined) ?? null,
      preferredLanguage: values[INTAKE_FIELDS.preferredLanguage] as string,
      answers,
      consents,
    };
  }) as unknown as z.ZodType<IntakeSubmission, FormValues>;
}

export function buildPartnerSchema(pack: IndustryPack): z.ZodType<PartnerSubmission, FormValues> {
  const { partnerIntake } = pack;
  const shape: Record<string, z.ZodType> = {
    [PARTNER_FIELDS.organisation]: boundedTextSchema({
      required: true,
      maxLength: 150,
      requiredMessage: 'Please enter your organisation name.',
    }),
    [PARTNER_FIELDS.contactName]: personNameSchema,
    [PARTNER_FIELDS.role]: boundedTextSchema({
      required: true,
      maxLength: 100,
      requiredMessage: 'Please enter your role.',
    }),
    [PARTNER_FIELDS.phone]: indianMobileSchema,
    [PARTNER_FIELDS.email]: requiredEmailSchema,
    [PARTNER_FIELDS.partnerType]: choiceSchema(
      partnerIntake.partnerTypes.map((t) => t.value),
      true,
      'Please choose a partnership type.',
    ),
    [PARTNER_FIELDS.message]: boundedTextSchema({
      required: true,
      maxLength: partnerIntake.messageMaxLength,
      requiredMessage: 'Please tell us briefly what you have in mind.',
    }),
  };
  for (const consent of partnerIntake.consents) shape[consentFieldName(consent.id)] = consentSchema(consent);

  return z.object(shape).transform((values): PartnerSubmission => {
    const consents: Record<string, boolean> = {};
    for (const consent of partnerIntake.consents) {
      consents[consent.id] = values[consentFieldName(consent.id)] === true;
    }
    return {
      organisation: values[PARTNER_FIELDS.organisation] as string,
      contactName: values[PARTNER_FIELDS.contactName] as string,
      role: values[PARTNER_FIELDS.role] as string,
      phone: values[PARTNER_FIELDS.phone] as string,
      email: values[PARTNER_FIELDS.email] as string,
      partnerType: values[PARTNER_FIELDS.partnerType] as string,
      message: values[PARTNER_FIELDS.message] as string,
      consents,
    };
  }) as unknown as z.ZodType<PartnerSubmission, FormValues>;
}

/** Field name -> first error message, ready for a form to display. */
export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) errors[field] = issue.message;
  }
  return errors;
}

/** Converts a posted FormData into plain values (honeypot excluded). */
export function formDataToValues(formData: FormData): FormValues {
  const values: FormValues = {};
  for (const [key, value] of formData.entries()) {
    if (key === HONEYPOT_FIELD || key.startsWith('$')) continue;
    if (typeof value === 'string') values[key] = value;
  }
  return values;
}
