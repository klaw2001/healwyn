'use client';

import {
  buildIntakeSchema,
  consentFieldName,
  formQuestions,
  getActivePack,
  INTAKE_FIELDS,
  type QualifyingQuestion,
} from '@healwyn/core';
import { Field, Input, RadioGroup, Select, Textarea } from '@healwyn/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { submitPatientEnquiry } from '@/app/contact/actions';
import { valueOf, type FormState } from '@/lib/form-state';
import {
  ConsentCheckbox,
  ErrorSummary,
  FormSection,
  Honeypot,
  SubmitButton,
  SuccessPanel,
  type ErrorLink,
} from './form-kit';
import { useEnquiryForm } from './use-enquiry-form';

const pack = getActivePack();
const schema = buildIntakeSchema(pack);
const questions = formQuestions(pack);
const fieldId = (name: string) => `enquiry-${name}`;

/** Order of fields for the error summary, matching the page order. */
const errorLinks: ErrorLink[] = [
  ...[INTAKE_FIELDS.fullName, INTAKE_FIELDS.phone, INTAKE_FIELDS.email, INTAKE_FIELDS.preferredLanguage],
  ...questions.map((q) => q.id),
  ...pack.intake.consents.map((c) => consentFieldName(c.id)),
].map((field) => ({ field, targetId: fieldId(field) }));

function QuestionField({
  question,
  error,
  state,
  selectRef,
}: {
  question: QualifyingQuestion;
  error?: string;
  state: FormState;
  selectRef?: React.Ref<HTMLSelectElement>;
}) {
  const id = fieldId(question.id);
  const initial = valueOf(state, question.id);
  const [length, setLength] = useState(initial?.length ?? 0);

  switch (question.kind) {
    case 'select':
      return (
        <Field id={id} label={question.label} hint={question.hint} error={error} required={question.required}>
          {(control) => (
            <Select {...control} ref={selectRef} name={question.id} defaultValue={initial ?? ''}>
              <option value="" disabled>
                Choose one
              </option>
              {question.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );
    case 'radio':
      return (
        <RadioGroup
          id={id}
          name={question.id}
          legend={question.label}
          hint={question.hint}
          options={question.options}
          error={error}
          required={question.required}
          defaultValue={initial}
        />
      );
    case 'text':
    case 'textarea': {
      const Control = question.kind === 'textarea' ? Textarea : Input;
      return (
        <Field id={id} label={question.label} hint={question.hint} error={error} required={question.required}>
          {(control) => (
            <>
              <Control
                {...control}
                name={question.id}
                maxLength={question.maxLength}
                defaultValue={initial}
                onInput={(event) => setLength(event.currentTarget.value.length)}
              />
              <p className="text-right text-sm text-ink-muted">
                {length} of {question.maxLength} characters
              </p>
            </>
          )}
        </Field>
      );
    }
  }
}

export function PatientForm() {
  const { state, formAction, isPending, errors, onSubmit, onChange, summaryRef, successRef } = useEnquiryForm(
    schema,
    submitPatientEnquiry,
  );
  const offeringSelect = useRef<HTMLSelectElement>(null);
  const languageOptions = useMemo(
    () =>
      pack.languages.map((l) => ({
        value: l.code,
        label: l.nativeLabel,
        description: l.label !== l.nativeLabel ? l.label : undefined,
      })),
    [],
  );

  // Pre-select a specialty linked from elsewhere (/contact?specialty=dental), keeping the page static.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('specialty');
    const select = offeringSelect.current;
    if (requested && select && !select.value && [...select.options].some((o) => o.value === requested)) {
      select.value = requested;
    }
  }, []);

  if (state.status === 'success') {
    return (
      <SuccessPanel
        reference={state.reference}
        successRef={successRef}
        title="Thank you. We have your enquiry."
        steps={[
          'A care coordinator reads it and matches you with the right doctor’s team.',
          'Someone from that team contacts you in the time window you chose.',
          'If you agreed to a call from our AI assistant, it may call first, between 9am and 9pm, to ask a few short questions.',
        ]}
      />
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onChange={onChange}
      noValidate
      className="relative"
      aria-describedby="enquiry-required-note"
    >
      <ErrorSummary
        errors={errors}
        links={errorLinks}
        message={state.status === 'error' ? state.message : undefined}
        summaryRef={summaryRef}
      />
      <p id="enquiry-required-note" className="mb-8 text-sm text-ink-muted">
        All fields are required unless marked optional.
      </p>
      <Honeypot />

      <div className="grid gap-10">
        <FormSection title="About you">
          <Field id={fieldId(INTAKE_FIELDS.fullName)} label="Full name" error={errors[INTAKE_FIELDS.fullName]} required>
            {(control) => (
              <Input
                {...control}
                name={INTAKE_FIELDS.fullName}
                autoComplete="name"
                defaultValue={valueOf(state, INTAKE_FIELDS.fullName)}
              />
            )}
          </Field>
          <Field
            id={fieldId(INTAKE_FIELDS.phone)}
            label="Mobile number"
            hint="A 10-digit Indian mobile number, for example 98765 43210. We use it only to contact you about this enquiry."
            error={errors[INTAKE_FIELDS.phone]}
            required
          >
            {(control) => (
              <Input
                {...control}
                name={INTAKE_FIELDS.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={valueOf(state, INTAKE_FIELDS.phone)}
              />
            )}
          </Field>
          <Field id={fieldId(INTAKE_FIELDS.email)} label="Email (optional)" error={errors[INTAKE_FIELDS.email]}>
            {(control) => (
              <Input
                {...control}
                name={INTAKE_FIELDS.email}
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={valueOf(state, INTAKE_FIELDS.email)}
              />
            )}
          </Field>
          <RadioGroup
            id={fieldId(INTAKE_FIELDS.preferredLanguage)}
            name={INTAKE_FIELDS.preferredLanguage}
            legend="Which language would you like us to use?"
            options={languageOptions}
            error={errors[INTAKE_FIELDS.preferredLanguage]}
            required
            defaultValue={valueOf(state, INTAKE_FIELDS.preferredLanguage)}
          />
        </FormSection>

        <FormSection title="What you need">
          {questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              error={errors[question.id]}
              state={state}
              selectRef={question.id === pack.intake.offeringQuestionId ? offeringSelect : undefined}
            />
          ))}
        </FormSection>

        <FormSection title="Your consent">
          {pack.intake.consents.map((consent) => {
            const name = consentFieldName(consent.id);
            return (
              <ConsentCheckbox
                key={consent.id}
                id={fieldId(name)}
                name={name}
                definition={consent}
                error={errors[name]}
                defaultChecked={valueOf(state, name) === 'on'}
              />
            );
          })}
        </FormSection>

        <div className="flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center">
          <SubmitButton pending={isPending}>Send enquiry</SubmitButton>
          <p className="text-sm text-ink-muted">We reply within one working day.</p>
        </div>
      </div>
    </form>
  );
}
