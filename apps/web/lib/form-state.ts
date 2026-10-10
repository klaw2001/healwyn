import type { FieldErrors } from '@healwyn/core';

/** What a form's server action returns. Shared by client and server. */
export type FormState =
  | { status: 'idle' }
  | { status: 'invalid'; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: 'error'; message: string; values: Record<string, string> }
  | { status: 'success'; reference: string };

export const initialFormState: FormState = { status: 'idle' };

export function valueOf(state: FormState, name: string): string | undefined {
  return state.status === 'invalid' || state.status === 'error' ? state.values[name] : undefined;
}
