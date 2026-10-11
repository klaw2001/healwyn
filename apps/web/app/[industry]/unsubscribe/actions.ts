'use server';

import { isKnownIndustryId } from '@healwyn/core/ids';
import { redirect } from 'next/navigation';
import { unsubscribeWithToken } from '@/lib/server/unsubscribe';

export async function confirmUnsubscribe(formData: FormData) {
  const token = formData.get('token');
  const outcome = await unsubscribeWithToken(typeof token === 'string' ? token : null, 'email_link');
  // Keep the lead's brand on the next page (the proxy reads `i` on /unsubscribe).
  const industry = formData.get('industry');
  const i = isKnownIndustryId(industry) ? `i=${industry}` : '';
  redirect(outcome === 'done' ? `/unsubscribe/done?${i}` : `/unsubscribe?error=${outcome}&${i}`);
}
