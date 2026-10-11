/**
 * Razorpay, test mode only, plus a simulated provider for demos without test
 * keys. Both produce the same webhook-shaped events, signed the same way, and
 * go through the same handler, so the simulated path exercises the real
 * verification and idempotency code.
 *
 * - Orders: POST https://api.razorpay.com/v1/orders (basic auth key id and secret).
 * - Webhooks: `X-Razorpay-Signature` is HMAC-SHA256 (hex) of the raw body with
 *   the webhook secret; `X-Razorpay-Event-Id` identifies the delivery.
 * - Checkout: the browser gets `razorpay_signature`, HMAC-SHA256 (hex) of
 *   "<order_id>|<payment_id>" with the key secret.
 */
import { assertTestModePayments } from '@healwyn/core';

const encoder = new TextEncoder();

export interface PaymentsEnv {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  /** Fallback secret for the simulated provider's webhook signatures. */
  UNSUBSCRIBE_SECRET?: string;
  [key: string]: string | undefined;
}

export type PaymentProvider = 'razorpay' | 'simulated';

/** Razorpay when test keys are configured, otherwise the simulated provider. Throws on live keys. */
export function paymentProvider(env: PaymentsEnv): PaymentProvider {
  assertTestModePayments(env);
  return env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? 'razorpay' : 'simulated';
}

/** The secret webhooks are signed with: Razorpay's, or for the simulated provider a derived one. */
export function webhookSecret(provider: PaymentProvider, env: PaymentsEnv): string {
  if (provider === 'razorpay') {
    if (!env.RAZORPAY_WEBHOOK_SECRET) throw new Error('RAZORPAY_WEBHOOK_SECRET must be set for Razorpay webhooks');
    return env.RAZORPAY_WEBHOOK_SECRET;
  }
  if (!env.UNSUBSCRIBE_SECRET || env.UNSUBSCRIBE_SECRET.length < 16) {
    throw new Error('UNSUBSCRIBE_SECRET must be set (16+ characters) for simulated payments');
  }
  return `simulated-payments:${env.UNSUBSCRIBE_SECRET}`;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Buffer.from(signature).toString('hex');
}

function equalTimingSafe(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWebhook(rawBody: string, secret: string): Promise<string> {
  return hmacHex(secret, rawBody);
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  return equalTimingSafe(await hmacHex(secret, rawBody), signature.toLowerCase());
}

/** Checks the signature Razorpay Checkout hands the browser after a payment. */
export async function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  return equalTimingSafe(await hmacHex(keySecret, `${orderId}|${paymentId}`), signature.toLowerCase());
}

/** Creates a Razorpay test-mode order. The receipt is our payment id. */
export async function createRazorpayOrder(
  input: { amountPaise: number; receipt: string; notes?: Record<string, string> },
  env: PaymentsEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  assertTestModePayments(env);
  if (!env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay test keys (rzp_test_…) are not configured');
  }
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetchImpl('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Razorpay order failed (${response.status})`);
  const body = (await response.json()) as { id?: unknown };
  if (typeof body.id !== 'string' || !body.id.startsWith('order_')) throw new Error('Razorpay returned no order id');
  return { id: body.id };
}

/** A random simulated order or payment id, shaped like Razorpay's. */
export function simulatedId(prefix: 'order' | 'pay' | 'evt'): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(14));
  return `${prefix}_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

export interface PaymentEvent {
  /** e.g. payment.captured, payment.failed, order.paid */
  type: string;
  orderId: string;
  paymentId: string | null;
  status: 'authorized' | 'paid' | 'failed';
  failureCode: string | null;
}

/**
 * Reads the parts of a Razorpay webhook body this app uses. Only ids, a status
 * and an error code: the payer's email and phone in the payload are ignored.
 * Returns null for events the app does not act on.
 */
export function parsePaymentEvent(rawBody: string): PaymentEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  const event = (body as { event?: unknown }).event;
  const payload = (body as { payload?: Record<string, { entity?: Record<string, unknown> }> }).payload ?? {};
  const payment = payload.payment?.entity ?? {};
  const order = payload.order?.entity ?? {};
  const orderId =
    typeof payment.order_id === 'string' ? payment.order_id : typeof order.id === 'string' ? order.id : null;
  const paymentId = typeof payment.id === 'string' && /^pay_[A-Za-z0-9_]{6,40}$/.test(payment.id) ? payment.id : null;
  if (!orderId || !/^order_[A-Za-z0-9_]{6,40}$/.test(orderId)) return null;
  const code =
    typeof payment.error_code === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(payment.error_code)
      ? payment.error_code
      : null;
  switch (event) {
    case 'payment.authorized':
      return { type: event, orderId, paymentId, status: 'authorized', failureCode: null };
    case 'payment.captured':
    case 'order.paid':
      return { type: event, orderId, paymentId, status: 'paid', failureCode: null };
    case 'payment.failed':
      return { type: event, orderId, paymentId, status: 'failed', failureCode: code ?? 'failed' };
    default:
      return null;
  }
}

/** A Razorpay-shaped webhook body, for the simulated provider (and tests). No personal data. */
export function simulatedWebhookBody(input: {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  outcome: 'paid' | 'failed';
}): string {
  const captured = input.outcome === 'paid';
  return JSON.stringify({
    entity: 'event',
    event: captured ? 'payment.captured' : 'payment.failed',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: input.paymentId,
          entity: 'payment',
          amount: input.amountPaise,
          currency: 'INR',
          status: captured ? 'captured' : 'failed',
          order_id: input.orderId,
          error_code: captured ? null : 'simulated_decline',
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  });
}
