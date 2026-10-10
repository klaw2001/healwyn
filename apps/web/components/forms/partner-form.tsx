'use client';

import { buildPartnerSchema, consentFieldName, getActivePack, PARTNER_FIELDS } from '@healwyn/core';
import { Field, Input, Select, Textarea } from '@healwyn/ui';
import { useState } from 'react';
import { submitPartnerEnquiry } from '@/app/partners/actions';
import { valueOf } from '@/lib/form-state';
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
const schema = buildPartnerSchema(pack);
const fieldId = (name: string) => `partner-${name}`;

const errorLinks: ErrorLink[] = [
  ...Object.values(PARTNER_FIELDS),
  ...pack.partnerIntake.consents.map((c) => consentFieldName(c.id)),
].map((field) => ({ field, targetId: fieldId(field) }));

export function PartnerForm() {
  const { state, formAction, isPending, errors, onSubmit, onChange, summaryRef, successRef } = useEnquiryForm(
    schema,
    submitPartnerEnquiry,
  );
  const maxLength = pack.partnerIntake.messageMaxLength;
  const [length, setLength] = useState(valueOf(state, PARTNER_FIELDS.message)?.length ?? 0);

  if (state.status === 'success') {
    return (
      <SuccessPanel
        reference={state.reference}
        successRef={successRef}
        title="Thank you. We will be in touch."
        steps={[
          'Our partnerships team reads every enquiry.',
          'We reply by email within two working days.',
          'If there is a fit, we suggest a short call to understand your needs.',
        ]}
      />
    );
  }

  const text = (
    name: string,
    label: string,
    autoComplete: string,
    extra: Partial<React.ComponentProps<'input'>> = {},
  ) => (
    <Field id={fieldId(name)} label={label} error={errors[name]} required>
      {(control) => (
        <Input {...control} name={name} autoComplete={autoComplete} defaultValue={valueOf(state, name)} {...extra} />
      )}
    </Field>
  );

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="relative">
      <ErrorSummary
        errors={errors}
        links={errorLinks}
        message={state.status === 'error' ? state.message : undefined}
        summaryRef={summaryRef}
      />
      <p className="mb-8 text-sm text-ink-muted">All fields are required.</p>
      <Honeypot />

      <div className="grid gap-10">
        <FormSection title="Your organisation">
          {text(PARTNER_FIELDS.organisation, 'Organisation', 'organization')}
          <Field
            id={fieldId(PARTNER_FIELDS.partnerType)}
            label="Type of partnership"
            error={errors[PARTNER_FIELDS.partnerType]}
            required
          >
            {(control) => (
              <Select
                {...control}
                name={PARTNER_FIELDS.partnerType}
                defaultValue={valueOf(state, PARTNER_FIELDS.partnerType) ?? ''}
              >
                <option value="" disabled>
                  Choose one
                </option>
                {pack.partnerIntake.partnerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormSection>

        <FormSection title="About you">
          <div className="grid gap-6 sm:grid-cols-2">
            {text(PARTNER_FIELDS.contactName, 'Your name', 'name')}
            {text(PARTNER_FIELDS.role, 'Your role', 'organization-title')}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {text(PARTNER_FIELDS.phone, 'Mobile number', 'tel', { type: 'tel', inputMode: 'tel' })}
            {text(PARTNER_FIELDS.email, 'Work email', 'email', { type: 'email', inputMode: 'email' })}
          </div>
        </FormSection>

        <FormSection title="Your enquiry">
          <Field
            id={fieldId(PARTNER_FIELDS.message)}
            label="What do you have in mind?"
            hint="For example the size of your team, the services you are interested in, or how you work with clinics today."
            error={errors[PARTNER_FIELDS.message]}
            required
          >
            {(control) => (
              <>
                <Textarea
                  {...control}
                  name={PARTNER_FIELDS.message}
                  maxLength={maxLength}
                  defaultValue={valueOf(state, PARTNER_FIELDS.message)}
                  onInput={(event) => setLength(event.currentTarget.value.length)}
                />
                <p className="text-right text-sm text-ink-muted">
                  {length} of {maxLength} characters
                </p>
              </>
            )}
          </Field>
          {pack.partnerIntake.consents.map((consent) => {
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

        <div className="border-t border-line pt-8">
          <SubmitButton pending={isPending}>Send partnership enquiry</SubmitButton>
        </div>
      </div>
    </form>
  );
}
