'use server';

import { bookingUrl, signBookingToken } from '@healwyn/messaging';
import { assertCapability } from '@/lib/server/auth';
import { asStaff } from '@/lib/server/db';
import { friendlyError, type ActionResult } from '@/lib/server/errors';
import { packFor } from '@/lib/server/pack';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The lead's own payment page (the same signed link as booking, valid 30 days),
 * for staff to send. Only for leads the staff member can see.
 */
export async function paymentLink(leadId: string, productId: string | null): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await assertCapability('payment.request');
    const pack = packFor(session);
    if (!UUID.test(leadId)) return { ok: false, error: 'Unknown lead.' };
    if (productId && !pack.payments.products.some((p) => p.id === productId)) {
      return { ok: false, error: 'Unknown product.' };
    }
    const visible = await asStaff(session, async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        select id from public.leads where id = ${leadId} and erased_at is null and lead_type = 'individual'`;
      return Boolean(row);
    });
    if (!visible) return { ok: false, error: 'That lead is not available to you.' };
    const token = await signBookingToken(leadId, process.env.UNSUBSCRIBE_SECRET);
    const site = process.env.SITE_URL || 'http://localhost:3000';
    const url = bookingUrl(site, token, pack.id).replace('/book?', '/pay?');
    return { ok: true, url: productId ? `${url}&product=${encodeURIComponent(productId)}` : url };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}
