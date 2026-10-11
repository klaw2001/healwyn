'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { loadBooking } from '@/lib/server/booking';
import { getLeadStore } from '@/lib/server/lead-store';
import { errorFields, log } from '@/lib/server/log';
import { completeSimulatedCheckout, confirmRazorpayCheckout, productOf, startPayment } from '@/lib/server/payments';

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const page = (token: string, industry: string, query: string) =>
  `/pay?t=${encodeURIComponent(token)}&i=${encodeURIComponent(industry)}&${query}`;

/** Creates a test-mode order for the chosen product and shows the checkout. */
export async function startCheckout(formData: FormData) {
  const loaded = await loadBooking(text(formData, 't')).catch(() => null);
  if (!loaded) redirect('/pay?error=link');
  const { token, context, pack } = loaded;
  const product = productOf(pack, text(formData, 'product'));
  let destination: string;
  try {
    if (!product) redirect(page(token, pack.id, 'error=choose'));
    if (!(await getLeadStore().hitRateLimit(`payment:${context.lead_id}`, 10, 3600))) {
      redirect(page(token, pack.id, 'error=busy'));
    }
    const started = await startPayment(context.lead_id, pack, product);
    destination = page(token, pack.id, `order=${encodeURIComponent(started.orderId)}`);
  } catch (error) {
    unstable_rethrow(error);
    log.error('payment.start_failed', errorFields(error));
    destination = page(token, pack.id, 'error=failed');
  }
  redirect(destination);
}

/** The simulated provider's buttons: succeed or decline, through the real webhook handling. */
export async function simulateCheckout(formData: FormData) {
  const loaded = await loadBooking(text(formData, 't')).catch(() => null);
  if (!loaded) redirect('/pay?error=link');
  const { token, pack, context } = loaded;
  const outcome = text(formData, 'outcome') === 'paid' ? 'paid' : 'failed';
  let destination: string;
  try {
    const result = await completeSimulatedCheckout(context.lead_id, text(formData, 'order'), outcome);
    destination = page(token, pack.id, result === 'unknown_order' ? 'error=failed' : `result=${outcome}`);
  } catch (error) {
    log.error('payment.simulated_failed', errorFields(error));
    destination = page(token, pack.id, 'error=failed');
  }
  redirect(destination);
}

/** Razorpay Checkout's success callback (called from the browser). */
export async function confirmCheckout(token: string, orderId: string, paymentId: string, signature: string) {
  const loaded = await loadBooking(token).catch(() => null);
  if (!loaded) return { ok: false };
  return { ok: await confirmRazorpayCheckout(loaded.context.lead_id, orderId, paymentId, signature) };
}
