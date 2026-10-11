import { describe, expect, it } from 'vitest';
import {
  createRazorpayOrder,
  parsePaymentEvent,
  paymentProvider,
  signWebhook,
  simulatedId,
  simulatedWebhookBody,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../src';

const secret = 'webhook-secret-0123456789';

describe('payments (test mode)', () => {
  it('picks Razorpay only with test keys, and refuses live keys', () => {
    expect(paymentProvider({})).toBe('simulated');
    expect(paymentProvider({ RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 's' })).toBe('razorpay');
    expect(() => paymentProvider({ RAZORPAY_KEY_ID: 'rzp_live_abc', RAZORPAY_KEY_SECRET: 's' })).toThrow(
      /Live Razorpay/,
    );
  });

  it('never calls Razorpay with live keys', async () => {
    let called = false;
    const fetchStub = (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch;
    await expect(
      createRazorpayOrder(
        { amountPaise: 100, receipt: 'r' },
        { RAZORPAY_KEY_ID: 'rzp_live_x', RAZORPAY_KEY_SECRET: 's' },
        fetchStub,
      ),
    ).rejects.toThrow(/Live Razorpay/);
    expect(called).toBe(false);
  });

  it('creates a test order with basic auth', async () => {
    let request: Request | null = null;
    const fetchStub = (async (url: string, init: RequestInit) => {
      request = new Request(url, init);
      return Response.json({ id: 'order_TEST1234567' });
    }) as unknown as typeof fetch;
    const order = await createRazorpayOrder(
      { amountPaise: 199900, receipt: 'payment-1' },
      { RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: 'secret' },
      fetchStub,
    );
    expect(order.id).toBe('order_TEST1234567');
    expect(request!.headers.get('authorization')).toBe(
      `Basic ${Buffer.from('rzp_test_key:secret').toString('base64')}`,
    );
    expect(await request!.json()).toMatchObject({ amount: 199900, currency: 'INR', receipt: 'payment-1' });
  });

  it('verifies webhook signatures over the raw body', async () => {
    const body = simulatedWebhookBody({
      orderId: simulatedId('order'),
      paymentId: simulatedId('pay'),
      amountPaise: 500,
      outcome: 'paid',
    });
    const signature = await signWebhook(body, secret);
    expect(await verifyWebhookSignature(body, signature, secret)).toBe(true);
    expect(await verifyWebhookSignature(`${body} `, signature, secret)).toBe(false);
    expect(await verifyWebhookSignature(body, signature, 'other-secret-0123456789')).toBe(false);
    expect(await verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  it('verifies the checkout signature Razorpay gives the browser', async () => {
    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', 'key-secret').update('order_ABC123456|pay_DEF123456').digest('hex');
    expect(await verifyCheckoutSignature('order_ABC123456', 'pay_DEF123456', signature, 'key-secret')).toBe(true);
    expect(await verifyCheckoutSignature('order_ABC123456', 'pay_OTHER12345', signature, 'key-secret')).toBe(false);
  });

  it('reads only ids, status and error code from events', () => {
    const paid = parsePaymentEvent(
      simulatedWebhookBody({
        orderId: 'order_ABC123456',
        paymentId: 'pay_DEF123456',
        amountPaise: 500,
        outcome: 'paid',
      }),
    );
    expect(paid).toEqual({
      type: 'payment.captured',
      orderId: 'order_ABC123456',
      paymentId: 'pay_DEF123456',
      status: 'paid',
      failureCode: null,
    });
    const failed = parsePaymentEvent(
      simulatedWebhookBody({
        orderId: 'order_ABC123456',
        paymentId: 'pay_DEF123456',
        amountPaise: 500,
        outcome: 'failed',
      }),
    );
    expect(failed?.status).toBe('failed');
    expect(failed?.failureCode).toBe('simulated_decline');
    expect(parsePaymentEvent('{"event":"refund.created","payload":{}}')).toBeNull();
    expect(parsePaymentEvent('not json')).toBeNull();
    expect(
      parsePaymentEvent('{"event":"payment.captured","payload":{"payment":{"entity":{"order_id":"x; drop"}}}}'),
    ).toBeNull();
  });
});
