import { describe, expect, it } from 'vitest';
import {
  HONEYPOT_FIELD,
  assistantToLeadPayload,
  buildAssistantSchema,
  buildIntakeSchema,
  buildPartnerSchema,
  clinicPack,
  consentFieldName,
  formDataToValues,
  toFieldErrors,
} from '../src';

const intake = buildIntakeSchema(clinicPack);
const partner = buildPartnerSchema(clinicPack);

const validIntake = {
  full_name: '  Ananya Demo ',
  phone: '98765 43210',
  email: '',
  preferred_language: 'hi',
  concern_category: 'dermatology',
  description: 'Routine skin check.',
  preferred_time: 'evening',
  visit_type: 'first',
  has_insurance: 'no',
  [consentFieldName('contact')]: 'on',
};

describe('patient enquiry schema (built from the clinic pack)', () => {
  it('accepts a valid enquiry and normalises it', () => {
    const result = intake.parse(validIntake);
    expect(result).toEqual({
      fullName: 'Ananya Demo',
      phone: '+919876543210',
      email: null,
      preferredLanguage: 'hi',
      answers: {
        concern_category: 'dermatology',
        description: 'Routine skin check.',
        preferred_time: 'evening',
        visit_type: 'first',
        has_insurance: 'no',
      },
      consents: { contact: true, assistant_call: false },
    });
  });

  it('records the optional call consent when ticked', () => {
    const result = intake.parse({ ...validIntake, [consentFieldName('assistant_call')]: 'on' });
    expect(result.consents.assistant_call).toBe(true);
  });

  it('omits a blank optional description', () => {
    const result = intake.parse({ ...validIntake, description: '   ' });
    expect(result.answers).not.toHaveProperty('description');
  });

  it('requires the contact consent', () => {
    const result = intake.safeParse({ ...validIntake, [consentFieldName('contact')]: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)[consentFieldName('contact')]).toMatch(/consent/i);
    }
  });

  it('reports a friendly error per invalid field', () => {
    const result = intake.safeParse({
      ...validIntake,
      full_name: 'A',
      phone: '12345',
      email: 'not-an-email',
      concern_category: 'astrology',
      preferred_time: '',
      description: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(Object.keys(errors).sort()).toEqual(
        ['concern_category', 'description', 'email', 'full_name', 'phone', 'preferred_time'].sort(),
      );
      expect(errors.phone).toMatch(/10-digit/);
      expect(errors.description).toMatch(/500/);
    }
  });

  it('rejects a language the pack does not offer', () => {
    expect(intake.safeParse({ ...validIntake, preferred_language: 'fr' }).success).toBe(false);
  });

  it('strips control characters from free text', () => {
    const result = intake.parse({ ...validIntake, description: 'Hello\u0000 there\u0007' });
    expect(result.answers.description).toBe('Hello there');
  });

  it('counts a CRLF line break as one character, as the textarea does', () => {
    const fiveHundred = `${'a'.repeat(249)}\r\n${'b'.repeat(250)}`;
    const result = intake.safeParse({ ...validIntake, description: fiveHundred });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.answers.description).toBe(`${'a'.repeat(249)}\n${'b'.repeat(250)}`);
    expect(intake.safeParse({ ...validIntake, description: `${fiveHundred}c` }).success).toBe(false);
  });

  it('accepts names in Devanagari', () => {
    expect(intake.safeParse({ ...validIntake, full_name: 'अनन्या शर्मा' }).success).toBe(true);
  });

  it('ignores unknown fields', () => {
    const result = intake.parse({ ...validIntake, is_admin: 'true' });
    expect(result).not.toHaveProperty('is_admin');
  });
});

describe('partner enquiry schema', () => {
  const validPartner = {
    organisation: 'Brightleaf Works',
    contact_name: 'Ravi Demo',
    role: 'HR lead',
    phone: '+91 70000 00010',
    email: 'Ravi.Demo@Example.com',
    partner_type: 'corporate-wellness',
    message: 'We would like a health check day for 120 people.',
    [consentFieldName('partner_contact')]: 'on',
  };

  it('accepts a valid enquiry', () => {
    const result = partner.parse(validPartner);
    expect(result.email).toBe('ravi.demo@example.com');
    expect(result.phone).toBe('+917000000010');
    expect(result.consents).toEqual({ partner_contact: true });
  });

  it('requires email, type, message and consent', () => {
    const result = partner.safeParse({
      ...validPartner,
      email: '',
      partner_type: 'reseller',
      message: '',
      [consentFieldName('partner_contact')]: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(toFieldErrors(result.error)).sort()).toEqual(
        ['consent_partner_contact', 'email', 'message', 'partner_type'].sort(),
      );
    }
  });
});

describe('formDataToValues', () => {
  it('drops the honeypot and framework fields', () => {
    const data = new FormData();
    data.set('full_name', 'Ananya');
    data.set(HONEYPOT_FIELD, 'http://spam.example');
    data.set('$ACTION_ID_abc', '');
    expect(formDataToValues(data)).toEqual({ full_name: 'Ananya' });
  });
});

describe('assistant start (website widget)', () => {
  const schema = buildAssistantSchema(clinicPack);
  const valid = {
    full_name: 'Asha Test',
    phone: '98765 43210',
    preferred_language: 'hi',
    mode: 'text',
    consent_contact: 'on',
    consent_assistant_call: 'on',
  };

  it('needs both consents, an Indian mobile and a pack language', () => {
    expect(schema.parse(valid)).toEqual({
      fullName: 'Asha Test',
      phone: '+919876543210',
      preferredLanguage: 'hi',
      mode: 'text',
      consents: { contact: true, assistant_call: true },
    });
    for (const broken of [
      { ...valid, consent_assistant_call: undefined },
      { ...valid, consent_contact: undefined },
      { ...valid, phone: '12345' },
      { ...valid, preferred_language: 'fr' },
      { ...valid, mode: 'video' },
    ]) {
      expect(schema.safeParse(broken).success).toBe(false);
    }
  });

  it('builds a voice-sourced lead with no answers yet and hashed consent evidence', async () => {
    const payload = await assistantToLeadPayload(schema.parse(valid), clinicPack);
    expect(payload).toMatchObject({ source: 'voice', stage: 'new', answers: {}, specialtySlug: null });
    expect(payload.consents.map((c) => [c.purpose, c.granted])).toEqual([
      ['contact', true],
      ['assistant_call', true],
    ]);
    expect(payload.consents[0]!.textHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
