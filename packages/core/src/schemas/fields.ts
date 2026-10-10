import { z } from 'zod';
import type { ConsentDefinition, IndustryPack, QualifyingQuestion } from '../industries/types';
import { normalizeIndianMobile } from './phone';

/** Removes control characters (keeps newlines and tabs) from free text. */
export function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** Treats empty strings from forms as "not provided". */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export const personNameSchema = z
  .string({ error: 'Please enter a full name.' })
  .trim()
  .min(2, 'Please enter a full name.')
  .max(100, 'Please keep the name under 100 characters.')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, 'Please use letters, spaces, dots, hyphens or apostrophes only.');

export const indianMobileSchema = z
  .string({ error: 'Please enter a mobile number.' })
  .trim()
  .min(1, 'Please enter a mobile number.')
  .transform((value, ctx) => {
    const normalized = normalizeIndianMobile(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please enter a 10-digit Indian mobile number, for example 98765 43210.',
      });
      return z.NEVER;
    }
    return normalized;
  });

const emailSchema = z
  .email({ error: 'Please enter a valid email address, for example name@example.com.' })
  .max(254, 'Please keep the email address under 254 characters.')
  .transform((value) => value.toLowerCase());

export const optionalEmailSchema = z.preprocess(emptyToUndefined, emailSchema.optional());

export const requiredEmailSchema = z.preprocess(
  emptyToUndefined,
  z.string({ error: 'Please enter an email address.' }).trim().pipe(emailSchema),
);

export function boundedTextSchema(opts: { required: boolean; maxLength: number; requiredMessage?: string }) {
  const base = z
    .string()
    .trim()
    .max(opts.maxLength, `Please keep this under ${opts.maxLength} characters.`)
    .transform(stripControlChars);
  if (opts.required) {
    return z
      .string({ error: opts.requiredMessage ?? 'Please fill in this field.' })
      .trim()
      .min(1, opts.requiredMessage ?? 'Please fill in this field.')
      .pipe(base);
  }
  return z.preprocess(emptyToUndefined, base.optional());
}

export function choiceSchema(values: readonly string[], required: boolean, message = 'Please choose an option.') {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('A choice needs at least one option');
  const choice = z.enum([first, ...rest], { error: message });
  return required ? z.preprocess(emptyToUndefined, choice) : z.preprocess(emptyToUndefined, choice.optional());
}

export function questionSchema(question: QualifyingQuestion) {
  switch (question.kind) {
    case 'select':
    case 'radio':
      return choiceSchema(
        question.options.map((o) => o.value),
        question.required,
      );
    case 'text':
    case 'textarea':
      return boundedTextSchema({ required: question.required, maxLength: question.maxLength });
  }
}

export function languageSchema(pack: IndustryPack) {
  return choiceSchema(
    pack.languages.map((l) => l.code),
    true,
    'Please choose a language.',
  );
}

/** Checkboxes arrive as "on" from a form post, or as booleans from client state. */
function checkboxValue(value: unknown): boolean {
  return value === true || value === 'on' || value === 'true';
}

export function consentSchema(def: ConsentDefinition) {
  if (def.required) {
    return z.preprocess(checkboxValue, z.literal(true, { error: def.requiredMessage ?? 'This consent is required.' }));
  }
  return z.preprocess(checkboxValue, z.boolean());
}
