import 'server-only';
import {
  buildIntakeSchema,
  buildPartnerSchema,
  formatLeadReference,
  formDataToValues,
  getOfferingQuestion,
  getQuestion,
  HONEYPOT_FIELD,
  intakeToLeadPayload,
  maskPhone,
  optionLabel,
  partnerToLeadPayload,
  toFieldErrors,
  type Brand,
  type IndustryPack,
  type NewLeadPayload,
} from '@healwyn/core';
import type { LeadStore } from '@healwyn/db';
import type { ZodType } from 'zod';
import type { FormState } from '../form-state';
import { clientIp, rateLimitKey } from './client-key';
import { leadOptions } from './demo';
import { errorFields, log } from './log';
import type { LeadNotification } from './notify';

export interface SubmissionDeps {
  store: LeadStore;
  pack: IndustryPack;
  notify: (notification: LeadNotification) => Promise<unknown>;
  /** Runs work after the response is sent (Next.js `after`). */
  schedule: (task: () => Promise<unknown>) => void;
  /** The lead's own booking page (a signed link), offered on the thank-you panel; null when booking is unavailable. */
  bookingPath?: (leadId: string) => Promise<string | null>;
}

export const RATE_LIMIT = { limit: 5, windowSeconds: 600 } as const;

type FormKind = 'patient' | 'partner';

const MESSAGES = {
  rateLimited: (brand: Brand) =>
    `You have sent several enquiries in a short time. Please wait ten minutes and try again, or email ${brand.contactEmail}.`,
  storeFailed: (brand: Brand) =>
    `Sorry, we could not send your enquiry just now. Nothing was saved. Please try again in a few minutes, or email ${brand.contactEmail}.`,
};

function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && key !== HONEYPOT_FIELD && !key.startsWith('$')) values[key] = value;
  }
  return values;
}

async function processSubmission<T>(
  kind: FormKind,
  formData: FormData,
  headers: Headers,
  deps: SubmissionDeps,
  schema: ZodType<T, Record<string, unknown>>,
  toPayload: (data: T) => Promise<NewLeadPayload>,
  summarize: (payload: NewLeadPayload) => LeadNotification['summary'],
): Promise<FormState> {
  const values = echoValues(formData);

  // 1. Honeypot: pretend success so bots learn nothing; store nothing.
  const trap = formData.get(HONEYPOT_FIELD);
  if (typeof trap === 'string' && trap.trim() !== '') {
    log.info('form.honeypot', { form: kind });
    return { status: 'success', reference: formatLeadReference(globalThis.crypto.randomUUID()) };
  }

  // 2. Server-side validation with the same schema the browser uses. Mistakes
  //    do not count towards the rate limit: only submissions that would be stored.
  const parsed = schema.safeParse(formDataToValues(formData));
  if (!parsed.success) {
    return { status: 'invalid', fieldErrors: toFieldErrors(parsed.error), values };
  }

  // 3. Rate limit per hashed client IP (IPv6 per /64). If the host gives no IP
  //    there is nothing fair to limit on, so skip rather than share one bucket.
  //    If the check itself fails, carry on: storage reports its own failure.
  const ip = clientIp(headers);
  if (!ip) {
    log.warn('form.rate_limit_skipped', { form: kind, reason: 'no_client_ip' });
  } else {
    try {
      const allowed = await deps.store.hitRateLimit(
        await rateLimitKey(kind, ip),
        RATE_LIMIT.limit,
        RATE_LIMIT.windowSeconds,
      );
      if (!allowed) {
        log.warn('form.rate_limited', { form: kind });
        return { status: 'error', message: MESSAGES.rateLimited(deps.pack.brand), values };
      }
    } catch (error) {
      log.warn('form.rate_limit_unavailable', { form: kind, ...errorFields(error) });
    }
  }

  // 4. Store the lead, its consent evidence and its first events atomically.
  const payload = await toPayload(parsed.data);
  let leadId: string;
  try {
    ({ id: leadId } = await deps.store.submitLead(payload));
  } catch (error) {
    log.error('lead.store_failed', { form: kind, store: deps.store.kind, ...errorFields(error) });
    return { status: 'error', message: MESSAGES.storeFailed(deps.pack.brand), values };
  }

  const reference = formatLeadReference(leadId);
  log.info('lead.submitted', { form: kind, reference, store: deps.store.kind });

  // 5. Notify after responding. Failures are logged, never surfaced.
  const notification: LeadNotification = {
    leadId,
    reference,
    kind,
    brand: deps.pack.brand,
    leadNoun: deps.pack.leadNoun,
    summary: summarize(payload),
  };
  deps.schedule(async () => {
    await deps.notify(notification);
  });

  let bookingPath: string | null = null;
  if (kind === 'patient' && deps.bookingPath) {
    try {
      bookingPath = await deps.bookingPath(leadId);
    } catch (error) {
      log.warn('booking.link_failed', { reference, ...errorFields(error) });
    }
  }
  return bookingPath ? { status: 'success', reference, bookingPath } : { status: 'success', reference };
}

function patientSummary(pack: IndustryPack, payload: NewLeadPayload): LeadNotification['summary'] {
  const answer = (id: string) => {
    const value = payload.answers[id];
    return value ? optionLabel(getQuestion(pack, id), value) : 'Not given';
  };
  const callConsent = payload.consents.find((c) => c.purpose === 'assistant_call')?.granted;
  const language = pack.languages.find((l) => l.code === payload.preferredLanguage)?.label ?? payload.preferredLanguage;
  return [
    { label: 'Looking for', value: answer(getOfferingQuestion(pack).id) },
    ...pack.intake.questions
      .filter(
        (q) =>
          q.channels.includes('form') &&
          q.id !== pack.intake.offeringQuestionId &&
          q.id !== pack.intake.messageQuestionId,
      )
      .map((q) => ({ label: q.label.replace(/\?$/, ''), value: answer(q.id) })),
    { label: 'Language', value: language },
    { label: 'AI assistant call', value: callConsent ? 'Agreed (9am to 9pm)' : 'Not agreed' },
    { label: 'Phone', value: maskPhone(payload.phone) },
    { label: 'Email given', value: payload.email ? 'Yes' : 'No' },
    { label: 'Details written', value: payload.message ? 'Yes (see CRM)' : 'No' },
  ];
}

function partnerSummary(pack: IndustryPack, payload: NewLeadPayload): LeadNotification['summary'] {
  const type = pack.partnerIntake.partnerTypes.find((t) => t.value === payload.answers.partner_type);
  return [
    { label: 'Partner type', value: type?.label ?? 'Unknown' },
    { label: 'Phone', value: maskPhone(payload.phone) },
  ];
}

export function handlePatientEnquiry(formData: FormData, headers: Headers, deps: SubmissionDeps) {
  const { pack } = deps;
  return processSubmission(
    'patient',
    formData,
    headers,
    deps,
    buildIntakeSchema(pack),
    (data) => intakeToLeadPayload(data, pack, leadOptions()),
    (payload) => patientSummary(pack, payload),
  );
}

export function handlePartnerEnquiry(formData: FormData, headers: Headers, deps: SubmissionDeps) {
  const { pack } = deps;
  return processSubmission(
    'partner',
    formData,
    headers,
    deps,
    buildPartnerSchema(pack),
    (data) => partnerToLeadPayload(data, pack, leadOptions()),
    (payload) => partnerSummary(pack, payload),
  );
}
