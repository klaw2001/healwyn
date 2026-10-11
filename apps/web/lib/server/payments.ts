import 'server-only';
import { fullStagePlan, getIndustryPack, isIndustryId, type IndustryPack, type PaymentProduct } from '@healwyn/core';
import {
  createRazorpayOrder,
  parsePaymentEvent,
  paymentProvider,
  signWebhook,
  simulatedId,
  simulatedWebhookBody,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  webhookSecret,
  type PaymentProvider,
} from '@healwyn/messaging';
import { getLeadStore } from './lead-store';
import { errorFields, log } from './log';

/**
 * Test-mode payments for the website. A person pays from their own signed link
 * (the same link as booking). The server creates the order (Razorpay test mode,
 * or the simulated provider without test keys); the provider's signed webhook
 * marks the payment, once, and moves the lead to the pack's won stage. Live
 * keys are refused here and at start-up.
 */

export function currentProvider(): PaymentProvider {
  return paymentProvider(process.env);
}

export function productOf(pack: IndustryPack, productId: string): PaymentProduct | undefined {
  return pack.payments.products.find((p) => p.id === productId);
}

export interface StartedPayment {
  paymentId: string;
  orderId: string;
  provider: PaymentProvider;
  amountPaise: number;
}

/** Creates the provider order and records the attempt. */
export async function startPayment(
  leadId: string,
  pack: IndustryPack,
  product: PaymentProduct,
  requestedBy: 'lead' | 'staff' = 'lead',
): Promise<StartedPayment> {
  const provider = currentProvider();
  const paymentId = globalThis.crypto.randomUUID();
  const orderId =
    provider === 'razorpay'
      ? (
          await createRazorpayOrder(
            {
              amountPaise: product.amountPaise,
              receipt: paymentId.replaceAll('-', '').slice(0, 32),
              notes: { pack: pack.id },
            },
            process.env,
          )
        ).id
      : simulatedId('order');
  await getLeadStore().createPayment({
    paymentId,
    leadId,
    productId: product.id,
    amountPaise: product.amountPaise,
    provider,
    orderId,
    requestedBy,
  });
  log.info('payment.created', { provider, product: product.id });
  return { paymentId, orderId, provider, amountPaise: product.amountPaise };
}

export type WebhookOutcome = 'applied' | 'duplicate' | 'ignored' | 'unknown_order' | 'bad_signature';

/**
 * The one place a provider event is applied: signature over the raw body,
 * then the event, once (the database ignores a repeated event id).
 */
export async function handlePaymentWebhook(
  provider: PaymentProvider,
  rawBody: string,
  signature: string | null,
  eventId: string | null,
): Promise<WebhookOutcome> {
  if (!(await verifyWebhookSignature(rawBody, signature, webhookSecret(provider, process.env)))) {
    log.warn('payment.webhook_rejected', { provider, reason: 'signature' });
    return 'bad_signature';
  }
  const event = parsePaymentEvent(rawBody);
  if (!event) return 'ignored';
  return applyEvent(provider, event, eventId ?? `body:${await bodyId(rawBody)}`);
}

async function applyEvent(
  provider: PaymentProvider,
  event: NonNullable<ReturnType<typeof parsePaymentEvent>>,
  eventId: string,
): Promise<WebhookOutcome> {
  const store = getLeadStore();
  const payment = await store.paymentForOrder(provider, event.orderId);
  if (!payment || !isIndustryId(payment.industry)) {
    log.warn('payment.webhook_unknown_order', { provider, type: event.type });
    return 'unknown_order';
  }
  const pack = getIndustryPack(payment.industry);
  const paidStage = pack.payments.paidStageId;
  const result = await store.recordPaymentEvent({
    provider,
    eventId: eventId.slice(0, 100),
    type: event.type,
    orderId: event.orderId,
    paymentId: event.paymentId,
    status: event.status,
    failureCode: event.failureCode,
    paidStage,
    plan: fullStagePlan(pack.sequences, paidStage),
  });
  log.info('payment.event', { provider, type: event.type, duplicate: result.duplicate, status: result.status });
  return result.duplicate ? 'duplicate' : 'applied';
}

async function bodyId(rawBody: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
  return Buffer.from(digest).toString('hex').slice(0, 40);
}

/**
 * The simulated provider's checkout: builds the webhook Razorpay would send,
 * signs it, and runs it through the same handler as a real delivery.
 */
export async function completeSimulatedCheckout(
  leadId: string,
  orderId: string,
  outcome: 'paid' | 'failed',
): Promise<WebhookOutcome> {
  if (!/^order_[A-Za-z0-9_]{6,40}$/.test(orderId)) return 'unknown_order';
  const payment = await getLeadStore().paymentForOrder('simulated', orderId);
  // Only the person whose link this is can complete their own order.
  if (!payment || payment.lead_id !== leadId) return 'unknown_order';
  const body = simulatedWebhookBody({
    orderId,
    paymentId: simulatedId('pay'),
    amountPaise: payment.amount_paise,
    outcome,
  });
  const signature = await signWebhook(body, webhookSecret('simulated', process.env));
  return handlePaymentWebhook('simulated', body, signature, simulatedId('evt'));
}

/**
 * Razorpay Checkout's success callback: the browser hands back the payment id
 * and a signature over "<order>|<payment>" with our key secret. A valid one
 * proves the payment went through, so it counts like `payment.captured`; the
 * webhook that follows is then a no-op.
 */
export async function confirmRazorpayCheckout(
  leadId: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || currentProvider() !== 'razorpay') return false;
  if (!/^order_[A-Za-z0-9_]{6,40}$/.test(orderId) || !/^pay_[A-Za-z0-9_]{6,40}$/.test(paymentId)) return false;
  if (!(await verifyCheckoutSignature(orderId, paymentId, signature, secret))) {
    log.warn('payment.checkout_rejected', { reason: 'signature' });
    return false;
  }
  try {
    const payment = await getLeadStore().paymentForOrder('razorpay', orderId);
    if (!payment || payment.lead_id !== leadId) return false;
    await applyEvent(
      'razorpay',
      { type: 'checkout.verified', orderId, paymentId, status: 'paid', failureCode: null },
      `checkout:${paymentId}`,
    );
    return true;
  } catch (error) {
    log.error('payment.checkout_failed', errorFields(error));
    return false;
  }
}
