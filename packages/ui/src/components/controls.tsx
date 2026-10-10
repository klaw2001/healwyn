import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../cx';
import { describedBy, FieldError, fieldIds } from './field';
import { ChevronDownIcon } from './icons';

const controlBase =
  'block w-full rounded-md border border-line-strong bg-surface px-4 text-base text-ink shadow-[inset_0_1px_2px_rgb(var(--hw-shadow)/0.05)] transition-colors placeholder:text-ink-muted hover:border-ink focus-visible:border-primary aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(controlBase, 'min-h-12 py-2', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(controlBase, 'min-h-32 resize-y py-3 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select className={cx(controlBase, 'min-h-12 cursor-pointer appearance-none py-2 pr-11', className)} {...props}>
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-lg text-ink-muted" />
    </div>
  );
}

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  id: string;
  label: ReactNode;
  error?: string;
}

/** A checkbox with its label, and an error tied to it. */
export function Checkbox({ id, label, error, className, ...props }: CheckboxProps) {
  const ids = fieldIds(id);
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-6 shrink-0 cursor-pointer rounded accent-(--hw-primary)"
          aria-describedby={describedBy(id, false, Boolean(error))}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-ink">
          {label}
        </label>
      </div>
      <FieldError id={ids.error} message={error} />
    </div>
  );
}

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  /** Language of the label, when it differs from the page (WCAG 3.1.2). */
  lang?: string;
}

export interface RadioGroupProps {
  id: string;
  name: string;
  legend: ReactNode;
  options: readonly RadioOption[];
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  defaultValue?: string;
  columns?: 1 | 2 | 4;
  onChange?: (value: string) => void;
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/** Native radios in a fieldset (exposed as a radiogroup), styled as cards. */
export function RadioGroup({
  id,
  name,
  legend,
  options,
  hint,
  error,
  required = false,
  defaultValue,
  columns = 2,
  onChange,
}: RadioGroupProps) {
  const ids = fieldIds(id);
  const describedById = describedBy(id, Boolean(hint), Boolean(error));
  return (
    <fieldset
      id={id}
      role="radiogroup"
      aria-labelledby={`${id}-legend`}
      aria-describedby={describedById}
      aria-required={required ? true : undefined}
      aria-invalid={error ? true : undefined}
      tabIndex={-1}
    >
      <legend id={`${id}-legend`} className="mb-2 font-semibold text-ink">
        {legend}
      </legend>
      {hint ? (
        <p id={ids.hint} className="-mt-1 mb-3 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      <div className={cx('grid gap-3', columnClasses[columns])}>
        {options.map((option, index) => {
          const optionId = `${id}-${index}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cx(
                'flex min-h-12 cursor-pointer items-start gap-3 rounded-md border bg-surface px-4 py-3 transition-colors hover:border-ink has-checked:border-primary has-checked:bg-primary-soft/50 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                error ? 'border-danger' : 'border-line-strong',
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                defaultChecked={defaultValue === option.value}
                onChange={onChange ? () => onChange(option.value) : undefined}
                className="mt-1 size-4.5 shrink-0 cursor-pointer accent-(--hw-primary) focus-visible:outline-none"
              />
              <span>
                <span className="block leading-snug font-semibold" lang={option.lang}>
                  {option.label}
                </span>
                {option.description ? <span className="block text-sm text-ink-muted">{option.description}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id={ids.error} message={error} />
    </fieldset>
  );
}
