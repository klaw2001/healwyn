import { NextResponse, type NextRequest } from 'next/server';
import { errorFields, log } from '@/lib/server/log';
import { currentProvider, handlePaymentWebhook } from '@/lib/server/payments';

/** Razorpay webhook bodies are small; anything bigger is not from Razorpay. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Razorpay (test mode) webhook: payment.authorized, payment.captured,
 * payment.failed, order.paid. Verified with RAZORPAY_WEBHOOK_SECRET over the
 * raw body; each event id is applied once. Answers 200 for events it does not
 * act on, so Razorpay does not retry them.
 */
export async function POST(request: NextRequest) {
  try {
    if (currentProvider() !== 'razorpay') return new NextResponse('Payments are simulated here.', { status: 404 });
    const length = Number(request.headers.get('content-length') ?? '0');
    if (length > MAX_BODY_BYTES) return new NextResponse('Too large.', { status: 413 });
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse('Too large.', { status: 413 });
    const outcome = await handlePaymentWebhook(
      'razorpay',
      raw,
      request.headers.get('x-razorpay-signature'),
      request.headers.get('x-razorpay-event-id'),
    );
    if (outcome === 'bad_signature') return new NextResponse('Invalid signature.', { status: 401 });
    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    log.error('payment.webhook_failed', errorFields(error));
    // 500 makes Razorpay retry later; the event is applied once whenever it lands.
    return new NextResponse('Could not process the event.', { status: 500 });
  }
}
