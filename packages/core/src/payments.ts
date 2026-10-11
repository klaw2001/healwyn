/**
 * Test-mode payments. Amounts are in paise (integers). Live Razorpay keys are
 * refused: both apps check at start-up (next.config.ts) and again before every
 * order, so a live key can never take real money in this demo.
 */

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

/** "₹1,999" (or "₹1,999.50"). */
export function formatRupees(paise: number): string {
  return rupees.format(paise / 100).replace(/\.00$/, '');
}

/** True for a Razorpay live key id (`rzp_live_…`). */
export function isLiveRazorpayKey(keyId: string | undefined | null): boolean {
  return typeof keyId === 'string' && /^rzp_live_/i.test(keyId.trim());
}

/** Throws when live Razorpay keys are configured. Call at start-up and before creating orders. */
export function assertTestModePayments(env: Record<string, string | undefined>): void {
  if (isLiveRazorpayKey(env.RAZORPAY_KEY_ID) || isLiveRazorpayKey(env.NEXT_PUBLIC_RAZORPAY_KEY_ID)) {
    throw new Error(
      'Live Razorpay keys detected (rzp_live_…). This demo runs payments in test mode only: use rzp_test_… keys.',
    );
  }
}

export type PaymentStatus = 'created' | 'authorized' | 'paid' | 'failed';

/** Short, calm explanations for Razorpay failure codes; the code itself is shown to staff. */
export function paymentFailureMessage(code: string | null | undefined): string {
  switch (code) {
    case 'BAD_REQUEST_ERROR':
      return 'The bank or card declined the test payment.';
    case 'GATEWAY_ERROR':
      return 'The payment service had a problem.';
    case 'SERVER_ERROR':
      return 'The payment service had a problem.';
    case 'simulated_decline':
      return 'The test payment was declined on purpose.';
    case 'cancelled':
      return 'The payment window was closed before paying.';
    default:
      return 'The test payment did not go through.';
  }
}
