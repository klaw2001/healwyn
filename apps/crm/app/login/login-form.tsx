'use client';

import { Button, Field, Input, Notice } from '@healwyn/ui';
import { useActionState } from 'react';
import { signIn, type SignInState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <form action={action} className="grid gap-5">
      {state.error ? (
        <Notice tone="emergency" title="Could not sign you in">
          <span role="alert">{state.error}</span>
        </Notice>
      ) : null}
      <Field id="email" label="Work email" required>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="username" defaultValue={state.email} />
        )}
      </Field>
      <Field id="password" label="Password" required>
        {(control) => <Input {...control} name="password" type="password" autoComplete="current-password" />}
      </Field>
      <Button type="submit" disabled={pending} fullWidth>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
