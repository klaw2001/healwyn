import { z } from 'zod';
import { consentFieldName } from '../consent';
import type { IndustryPack } from '../industries/types';
import { consentSchema, indianMobileSchema, languageSchema, personNameSchema } from './fields';
import type { FormValues } from './intake';

/**
 * Starting a call with the assistant from the website: who is calling and how
 * to reach them (typed, which is more reliable than speech for a phone number),
 * plus the pack's consents. The call consent is required here: starting the
 * call is the reason for the form. The qualifying questions are asked on the call.
 */
export interface AssistantStart {
  fullName: string;
  phone: string;
  preferredLanguage: string;
  mode: 'voice' | 'text';
  consents: Record<string, boolean>;
}

export function buildAssistantSchema(pack: IndustryPack): z.ZodType<AssistantStart, FormValues> {
  const shape: Record<string, z.ZodType> = {
    full_name: personNameSchema,
    phone: indianMobileSchema,
    preferred_language: languageSchema(pack),
    mode: z.enum(['voice', 'text']).default('voice'),
  };
  for (const consent of pack.intake.consents) {
    shape[consentFieldName(consent.id)] =
      consent.id === pack.voice.callConsentId
        ? consentSchema({
            ...consent,
            required: true,
            requiredMessage: 'To talk to the assistant, please agree to this.',
          })
        : consentSchema(consent);
  }
  return z.object(shape).transform((values): AssistantStart => ({
    fullName: values.full_name as string,
    phone: values.phone as string,
    preferredLanguage: values.preferred_language as string,
    mode: values.mode as 'voice' | 'text',
    consents: Object.fromEntries(pack.intake.consents.map((c) => [c.id, values[consentFieldName(c.id)] === true])),
  })) as unknown as z.ZodType<AssistantStart, FormValues>;
}
