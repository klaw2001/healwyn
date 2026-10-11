import { clinicPack, fullStagePlan } from '@healwyn/core';
import { afterAll, describe, expect, it } from 'vitest';
import { createPostgresLeadStore } from '../src';
import { connect, databaseUrl, samplePayload } from './helpers';

const paidStage = clinicPack.payments.paidStageId;
const product = clinicPack.payments.products[0]!;
let n = 0;
const ids = () => {
  n += 1;
  const tag = `${process.pid}${n}${Date.now() % 100000}`.slice(-12).padStart(12, 'A');
  return { paymentId: globalThis.crypto.randomUUID(), orderId: `order_T${tag}`, paymentRef: `pay_T${tag}` };
};

describe.skipIf(!databaseUrl)('payments (test mode)', () => {
  const sql = databaseUrl ? connect() : (null as never);
  const store = databaseUrl ? createPostgresLeadStore(databaseUrl) : (null as never);
  afterAll(async () => {
    await store?.close();
    await sql?.end();
  });

  async function newPayment() {
    const { id: leadId } = await store.submitLead(await samplePayload());
    const { paymentId, orderId, paymentRef } = ids();
    await store.createPayment({
      paymentId,
      leadId,
      productId: product.id,
      amountPaise: product.amountPaise,
      provider: 'simulated',
      orderId,
      requestedBy: 'lead',
    });
    return { leadId, paymentId, orderId, paymentRef };
  }

  const event = (orderId: string, eventId: string, status: 'paid' | 'failed' | 'authorized', paymentRef: string) =>
    store.recordPaymentEvent({
      provider: 'simulated',
      eventId,
      type: status === 'paid' ? 'payment.captured' : status === 'failed' ? 'payment.failed' : 'payment.authorized',
      orderId,
      paymentId: paymentRef,
      status,
      failureCode: status === 'failed' ? 'simulated_decline' : null,
      paidStage,
      plan: fullStagePlan(clinicPack.sequences, paidStage),
    });

  it('marks a payment paid once and moves the lead to the won stage', async () => {
    const { leadId, orderId, paymentRef } = await newPayment();
    expect(await store.paymentForOrder('simulated', orderId)).toMatchObject({ lead_id: leadId, status: 'created' });

    expect(await event(orderId, 'evt_FIRST000001', 'paid', paymentRef)).toMatchObject({
      duplicate: false,
      status: 'paid',
      changed: true,
      stage: { from: 'new', to: paidStage, changed: true },
    });
    // The same delivery again changes nothing.
    expect(await event(orderId, 'evt_FIRST000001', 'paid', paymentRef)).toEqual({
      duplicate: true,
      status: 'paid',
      changed: false,
    });
    // A late failure never undoes a payment.
    expect((await event(orderId, 'evt_LATEFAIL001', 'failed', paymentRef)).status).toBe('paid');

    const [lead] = await sql`select stage from public.leads where id = ${leadId}`;
    expect(lead!.stage).toBe(paidStage);
    const events =
      await sql`select type, payload from public.lead_events where lead_id = ${leadId} and type like 'payment.%' order by id`;
    expect(events.map((e) => e.type)).toEqual(['payment.created', 'payment.paid']);
    expect(events[1]!.payload).toMatchObject({ mode: 'test', amount_paise: product.amountPaise });
    const [count] =
      await sql`select count(*)::int as n from public.payment_events e join public.payments p on p.id = e.payment_id where p.lead_id = ${leadId}`;
    expect(count!.n).toBe(2);
    const payments = await store.leadPayments(leadId);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'paid', product_id: product.id });
  });

  it('records a failure with its code, and a later success on the same order still counts', async () => {
    const { leadId, orderId, paymentRef } = await newPayment();
    expect((await event(orderId, 'evt_FAIL0000001', 'failed', paymentRef)).status).toBe('failed');
    const [failed] = await sql`select status, failure_code from public.payments where provider_order_id = ${orderId}`;
    expect(failed).toEqual({ status: 'failed', failure_code: 'simulated_decline' });
    const [stage] = await sql`select stage from public.leads where id = ${leadId}`;
    expect(stage!.stage).toBe('new');
    expect((await event(orderId, 'evt_OK000000001', 'paid', paymentRef)).status).toBe('paid');
  });

  it('refuses unknown orders, partner leads and live mode', async () => {
    await expect(event('order_UNKNOWN0001', 'evt_UNKNOWN0001', 'paid', 'pay_UNKNOWN0001')).rejects.toThrow();
    const { leadId } = await newPayment();
    const { paymentId, orderId } = ids();
    await expect(
      sql`insert into public.payments (id, lead_id, industry, product_id, amount_paise, provider, mode, provider_order_id, requested_by)
          values (${paymentId}, ${leadId}, 'clinic', ${product.id}, 500, 'razorpay', 'live', ${orderId}, 'lead')`,
    ).rejects.toThrow(/check constraint/);
  });
});
