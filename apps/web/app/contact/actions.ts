'use server';

import { headers } from 'next/headers';
import type { FormState } from '@/lib/form-state';
import { defaultSubmissionDeps } from '@/lib/server/deps';
import { handlePatientEnquiry } from '@/lib/server/submit';

export async function submitPatientEnquiry(_previous: FormState, formData: FormData): Promise<FormState> {
  return handlePatientEnquiry(formData, await headers(), defaultSubmissionDeps());
}
