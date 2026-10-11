'use server';

import { getActivePack } from '@healwyn/core';
import { headers } from 'next/headers';
import type { FormState } from '@/lib/form-state';
import { packFromValue } from '@/lib/pack';
import { defaultSubmissionDeps } from '@/lib/server/deps';
import { handlePatientEnquiry } from '@/lib/server/submit';

/** The form names its industry in a hidden field; the lead is stored with that pack. */
export async function submitPatientEnquiry(_previous: FormState, formData: FormData): Promise<FormState> {
  const pack = packFromValue(formData.get('industry')) ?? getActivePack();
  return handlePatientEnquiry(formData, await headers(), defaultSubmissionDeps(pack));
}
