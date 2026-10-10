'use client';

import {
  BRAND,
  consentSegments,
  HONEYPOT_FIELD,
  PRIVACY_PATH,
  type ConsentDefinition,
  type FieldErrors,
} from '@healwyn/core';
import { AlertIcon, Button, Checkbox, CheckIcon } from '@healwyn/ui';
import type { ReactNode, RefObject } from 'react';

export interface ErrorLink {
  field: string;
  targetId: string;
}

/** Lists every problem with a link to its field. Receives focus after a failed submit. */
export function ErrorSummary({
  errors,
  links,
  message,
  summaryRef,
}: {
  errors: FieldErrors;
  links: readonly ErrorLink[];
  message?: string;
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  const items = links.filter((link) => errors[link.field]);
  const hasContent = items.length > 0 || Boolean(message);
  return (
    <div ref={summaryRef} tabIndex={-1} className="focus:outline-none">
      {hasContent ? (
        <div role="alert" className="mb-8 rounded-md border-2 border-danger bg-danger-soft p-5">
          <h2 className="flex items-center gap-2 font-sans text-lg font-semibold text-ink">
            <AlertIcon className="shrink-0 text-danger" />
            {message ? 'We could not send your enquiry' : 'Please check your enquiry'}
          </h2>
          {message ? <p className="mt-2">{message}</p> : null}
          {items.length > 0 ? (
            <ul className="mt-3 grid gap-1.5">
              {items.map((item) => (
                <li key={item.field}>
                  <a
                    href={`#${item.targetId}`}
                    className="font-semibold text-danger underline underline-offset-4"
                    onClick={(event) => {
                      const target = document.getElementById(item.targetId);
                      if (!target) return;
                      event.preventDefault();
                      target.scrollIntoView({ block: 'center' });
                      target.focus({ preventScroll: true });
                    }}
                  >
                    {errors[item.field]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Spam trap: hidden from people and assistive technology. Bots fill it in. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
      <input
        id={HONEYPOT_FIELD}
        name={HONEYPOT_FIELD}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore=""
        data-form-type="other"
      />
    </div>
  );
}

export function ConsentText({ definition }: { definition: ConsentDefinition }) {
  return (
    <>
      {consentSegments(definition).map((segment, index) =>
        segment.type === 'privacy-link' ? (
          <a
            key={index}
            href={PRIVACY_PATH}
            target="_blank"
            rel="noopener"
            className="font-semibold text-primary underline underline-offset-4"
          >
            {segment.value}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}

export function ConsentCheckbox({
  id,
  name,
  definition,
  error,
  defaultChecked,
}: {
  id: string;
  name: string;
  definition: ConsentDefinition;
  error?: string;
  defaultChecked?: boolean;
}) {
  return (
    <Checkbox
      id={id}
      name={name}
      error={error}
      defaultChecked={defaultChecked}
      aria-required={definition.required ? true : undefined}
      label={<ConsentText definition={definition} />}
      className="rounded-md border border-line bg-surface-muted p-4"
    />
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={pending} aria-disabled={pending} className="w-full sm:w-auto">
      {pending ? 'Sending…' : children}
    </Button>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 className="font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">{title}</h2>
      <div className="mt-5 grid gap-6">{children}</div>
    </div>
  );
}

export function SuccessPanel({
  reference,
  successRef,
  title,
  steps,
}: {
  reference: string;
  successRef: RefObject<HTMLHeadingElement | null>;
  title: string;
  steps: readonly string[];
}) {
  return (
    <div className="rounded-lg border border-success bg-success-soft p-6 sm:p-8" role="status">
      <span className="grid size-12 place-items-center rounded-full bg-success text-surface">
        <CheckIcon className="text-2xl" />
      </span>
      <h2 ref={successRef} tabIndex={-1} className="mt-5 text-3xl focus:outline-none">
        {title}
      </h2>
      <p className="mt-3 text-lg">
        Your reference is <strong className="font-mono tracking-wide">{reference}</strong>. Please keep it if you
        contact us about this enquiry.
      </p>
      <h3 className="mt-6 font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">
        What happens next
      </h3>
      <ol className="mt-3 grid list-decimal gap-2 pl-5">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-ink-muted">
        To change your details or withdraw consent, email {BRAND.privacyEmail} with your reference.
      </p>
    </div>
  );
}
