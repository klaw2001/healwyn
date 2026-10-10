/**
 * Email through Resend's HTTP API. Without RESEND_API_KEY the email is printed
 * to the console instead ("logged"). Never throws.
 */

export interface EmailEnv {
  [key: string]: string | undefined;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  /** Makes retries safe: Resend sends at most one email per key. */
  idempotencyKey: string;
  /** One-click unsubscribe endpoint (RFC 8058) for the List-Unsubscribe header. */
  unsubscribeUrl?: string;
}

export interface DeliveryResult {
  status: 'sent' | 'logged' | 'failed';
  providerMessageId?: string;
  error?: string;
}

export const DEFAULT_FROM = 'onboarding@resend.dev';

export async function sendEmail(
  email: OutgoingEmail,
  env: EmailEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  options: {
    /**
     * What the console fallback prints. 'full' suits staff notifications that
     * carry no personal data; 'redacted' (no subject or body) suits messages to
     * leads, which do.
     */
    consoleMode?: 'full' | 'redacted';
    redactedLabel?: string;
  } = {},
): Promise<DeliveryResult> {
  if (!env.RESEND_API_KEY) {
    if (options.consoleMode === 'redacted') {
      console.info(`[email:console] RESEND_API_KEY is not set; not sent: ${options.redactedLabel ?? 'email'}`);
    } else {
      console.info(
        `[email:console] RESEND_API_KEY is not set, so the email is printed here instead.\nSubject: ${email.subject}\n${email.text}`,
      );
    }
    return { status: 'logged' };
  }
  try {
    const headers: Record<string, string> = {};
    if (email.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${email.unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        'idempotency-key': email.idempotencyKey,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || DEFAULT_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(Object.keys(headers).length ? { headers } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!response.ok) {
      return { status: 'failed', error: `resend_${response.status}${body.name ? `_${body.name}` : ''}`.slice(0, 120) };
    }
    return { status: 'sent', providerMessageId: body.id };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.name : 'unknown_error' };
  }
}
