import 'server-only';
import { BRAND } from '@healwyn/core';
import { errorFields, log } from './log';

export interface LeadNotification {
  leadId: string;
  reference: string;
  kind: 'patient' | 'partner';
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
  const noun = notification.kind === 'partner' ? 'partner enquiry' : 'patient enquiry';
  const headline = notification.summary[0]?.value;
  const lines = [
    `A new ${noun} has arrived.`,
    '',
    `Reference: ${notification.reference}`,
    ...notification.summary.map((item) => `${item.label}: ${item.value}`),
    '',
    'Names, full phone numbers and free-text details are not included in email.',
    'Open the lead in the CRM to see them (the CRM arrives in Phase 2).',
    '',
    `${BRAND.name}: ${BRAND.demoNotice}.`,
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
 * a recipient) the email is logged instead. Never throws: a notification
 * problem must never fail a submission.
 */
export async function sendLeadNotification(
  notification: LeadNotification,
  env: NotifyEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  try {
    const email = buildLeadEmail(notification, env);
    if (!env.RESEND_API_KEY || !env.LEAD_NOTIFY_EMAIL) {
      const reason = env.RESEND_API_KEY ? 'LEAD_NOTIFY_EMAIL is not set' : 'RESEND_API_KEY is not set';
      console.info(
        `[email:console] ${reason}, so the email is printed here instead.\nSubject: ${email.subject}\n${email.text}`,
      );
      return 'logged';
    }

    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        'idempotency-key': `lead-${notification.leadId}`,
      },
      body: JSON.stringify({ from: email.from, to: [email.to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      log.warn('notify.failed', { reference: notification.reference, status: response.status });
      return 'failed';
    }
    log.info('notify.sent', { reference: notification.reference });
    return 'sent';
  } catch (error) {
    log.warn('notify.failed', { reference: notification.reference, ...errorFields(error) });
    return 'failed';
  }
}
