import type { ReactNode } from 'react';
import { cx } from '../cx';
import { AlertIcon } from './icons';

export interface ControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
}

export interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

/** ids for a field's hint and error, so custom controls can wire them up. */
export function fieldIds(id: string) {
  return { hint: `${id}-hint`, error: `${id}-error` };
}

export function describedBy(id: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = fieldIds(id);
  return [hasHint && ids.hint, hasError && ids.error].filter(Boolean).join(' ') || undefined;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-sm font-semibold text-danger">
      <AlertIcon className="mt-0.5 shrink-0 text-base" />
      <span>{message}</span>
    </p>
  );
}

/** Label + hint + control + error, wired with aria-describedby and aria-invalid. */
export function Field({ id, label, hint, error, required = false, className, children }: FieldProps) {
  const ids = fieldIds(id);
  return (
    <div className={cx('space-y-2', className)}>
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={ids.hint} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        'aria-describedby': describedBy(id, Boolean(hint), Boolean(error)),
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      <FieldError id={ids.error} message={error} />
    </div>
  );
}
