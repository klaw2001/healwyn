'use client';

import { formDataToValues, toFieldErrors, type FieldErrors, type FormValues } from '@healwyn/core';
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ZodType } from 'zod';
import { initialFormState, type FormState } from '@/lib/form-state';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Shared behaviour for enquiry forms:
 * - validates in the browser with the same zod schema the server uses;
 * - moves focus to the error summary (or the confirmation) after submitting;
 * - re-validates as the person edits once they have tried to submit;
 * - submits through the server action without React's automatic form reset,
 *   so nothing typed is lost if the server rejects it. Without JavaScript the
 *   form still posts natively to the same server action.
 */
export function useEnquiryForm<T>(schema: ZodType<T, FormValues>, action: Action) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  const errors: FieldErrors = clientErrors ?? (state.status === 'invalid' ? state.fieldErrors : {});

  const validate = (form: HTMLFormElement): FieldErrors => {
    const result = schema.safeParse(formDataToValues(new FormData(form)));
    return result.success ? {} : toFieldErrors(result.error);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setAttempted(true);
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setClientErrors(found);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setClientErrors(null);
    const data = new FormData(form);
    startTransition(() => formAction(data));
  };

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    if (attempted) setClientErrors(validate(event.currentTarget));
  };

  useEffect(() => {
    if (state.status === 'invalid' || state.status === 'error') summaryRef.current?.focus();
    if (state.status === 'success') successRef.current?.focus();
  }, [state]);

  return { state, formAction, isPending, errors, onSubmit, onChange, summaryRef, successRef };
}
