import 'server-only';
import type { Brand } from '@healwyn/core';
import { sendEmail } from '@healwyn/messaging';
import { errorFields, log } from './log';

export interface LeadNotification {
  leadId: string;
  reference: string;
  kind: 'patient' | 'partner';
  /** The industry pack's brand and what it calls a lead ("patient", "home buyer"). */
  brand: Brand;
  leadNoun: string;
  /** Non-sensitive fields only: no names, full phone numbers or free text. */
  summary: readonly { label: string; value: string }[];
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface NotifyEnv {
  [key: string]: string | undefined;
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  EMAIL_FROM?: string;
}

export type NotifyResult = 'sent' | 'logged' | 'failed';

export function buildLeadEmail(notification: LeadNotification, env: NotifyEnv): EmailMessage {
  const noun = notification.kind === 'partner' ? 'partner enquiry' : `${notification.leadNoun} enquiry`;
  const headline = notification.summary[0]?.value;
  const lines = [
    `A new ${noun} has arrived.`,
    '',
    `Reference: ${notification.reference}`,
    ...notification.summary.map((item) => `${item.label}: ${item.value}`),
    '',
    'Names, full phone numbers and free-text details are not included in email.',
    'Open the lead in the CRM to see them.',
    '',
    `${notification.brand.name}: ${notification.brand.demoNotice}.`,
  ];
  return {
    from: env.EMAIL_FROM || 'onboarding@resend.dev',
    to: env.LEAD_NOTIFY_EMAIL ?? '',
    subject: `New ${noun}${headline ? `: ${headline}` : ''} (ref ${notification.reference})`,
    text: lines.join('\n'),
  };
}

/**
 * Emails the team about a new lead through Resend. Without RESEND_API_KEY (or
 * a recipient) the email is logged instead; it carries no personal data, so the
 * whole email can be printed. Never throws: a notification problem must never
 * fail a submission.
 */
export async function sendLeadNotification(
  notification: LeadNotification,
  env: NotifyEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  try {
    const email = buildLeadEmail(notification, env);
    if (!env.LEAD_NOTIFY_EMAIL) {
      console.info(
        `[email:console] LEAD_NOTIFY_EMAIL is not set, so the email is printed here instead.\nSubject: ${email.subject}\n${email.text}`,
      );
      return 'logged';
    }
    const result = await sendEmail(
      { to: email.to, subject: email.subject, text: email.text, idempotencyKey: `lead-${notification.leadId}` },
      { RESEND_API_KEY: env.RESEND_API_KEY, EMAIL_FROM: env.EMAIL_FROM },
      fetchImpl,
    );
    if (result.status === 'failed')
      log.warn('notify.failed', { reference: notification.reference, error: result.error });
    else log.info(result.status === 'sent' ? 'notify.sent' : 'notify.logged', { reference: notification.reference });
    return result.status;
  } catch (error) {
    log.warn('notify.failed', { reference: notification.reference, ...errorFields(error) });
    return 'failed';
  }
}
