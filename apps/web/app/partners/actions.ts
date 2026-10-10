'use server';

import { headers } from 'next/headers';
import type { FormState } from '@/lib/form-state';
import { defaultSubmissionDeps } from '@/lib/server/deps';
import { handlePartnerEnquiry } from '@/lib/server/submit';

export async function submitPartnerEnquiry(_previous: FormState, formData: FormData): Promise<FormState> {
  return handlePartnerEnquiry(formData, await headers(), defaultSubmissionDeps());
}
