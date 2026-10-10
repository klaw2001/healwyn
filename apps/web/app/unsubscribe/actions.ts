'use server';

import { redirect } from 'next/navigation';
import { unsubscribeWithToken } from '@/lib/server/unsubscribe';

export async function confirmUnsubscribe(formData: FormData) {
  const token = formData.get('token');
  const outcome = await unsubscribeWithToken(typeof token === 'string' ? token : null, 'email_link');
  redirect(outcome === 'done' ? '/unsubscribe/done' : `/unsubscribe?error=${outcome}`);
}
