import { describe, expect, it } from 'vitest';
import {
  BRAND,
  buildIntakeSchema,
  buildPartnerSchema,
  clinicPack,
  consentPlainText,
  consentSegments,
  formatLeadReference,
  intakeToLeadPayload,
  partnerToLeadPayload,
  sha256Hex,
} from '../src';

const contactConsent = clinicPack.intake.consents[0];

describe('consent wording', () => {
  it('renders brand, email and a privacy link', () => {
    const segments = consentSegments(contactConsent);
    expect(segments.some((s) => s.type === 'privacy-link')).toBe(true);
    const text = segments.map((s) => s.value).join('');
    expect(text).toContain(BRAND.name);
    expect(text).toContain(BRAND.privacyEmail);
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it('hashes the exact plain text', async () => {
    const plain = consentPlainText(contactConsent);
    expect(plain).toContain('privacy notice (/privacy)');
    expect(await sha256Hex(plain)).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('intakeToLeadPayload', () => {
  const schema = buildIntakeSchema(clinicPack);

  it('maps the offering and free text to their own columns', async () => {
    const submission = schema.parse({
      full_name: 'Ananya Demo',
      phone: '9876543210',
      preferred_language: 'en',
      concern_category: 'dental',
      description: 'Cleaning please.',
      preferred_time: 'morning',
      visit_type: 'first',
      has_insurance: 'yes',
      consent_contact: true,
      consent_assistant_call: true,
    });
    const payload = await intakeToLeadPayload(submission, clinicPack);
    expect(payload).toMatchObject({
      industry: 'clinic',
      leadType: 'individual',
      source: 'web_form',
      stage: 'new',
      specialtySlug: 'dental',
      message: 'Cleaning please.',
      isDemo: false,
    });
    expect(payload.answers).not.toHaveProperty('description');
    expect(payload.answers.has_insurance).toBe('yes');
    expect(payload.consents).toEqual([
      expect.objectContaining({ purpose: 'contact', granted: true, textVersion: 'clinic-contact-v1' }),
      expect.objectContaining({ purpose: 'assistant_call', granted: true, textVersion: 'clinic-assistant-call-v1' }),
    ]);
  });

  it('leaves the specialty empty when the person is not sure', async () => {
    const submission = schema.parse({
      full_name: 'Rohan Sample',
      phone: '9876543210',
      preferred_language: 'hi',
      concern_category: 'not-sure',
      preferred_time: 'any',
      visit_type: 'first',
      has_insurance: 'no',
      consent_contact: 'on',
    });
    const payload = await intakeToLeadPayload(submission, clinicPack);
    expect(payload.specialtySlug).toBeNull();
    expect(payload.message).toBeNull();
    expect(payload.consents.find((c) => c.purpose === 'assistant_call')?.granted).toBe(false);
  });
});

describe('partnerToLeadPayload', () => {
  it('stores organisation details as answers', async () => {
    const submission = buildPartnerSchema(clinicPack).parse({
      organisation: 'Kestrel Labs',
      contact_name: 'Ravi Demo',
      role: 'Partnerships',
      phone: '7000000010',
      email: 'ravi@example.com',
      partner_type: 'diagnostic-lab',
      message: 'Exploring a test partnership.',
      consent_partner_contact: 'on',
    });
    const payload = await partnerToLeadPayload(submission, clinicPack);
    expect(payload).toMatchObject({
      leadType: 'partner',
      source: 'partner_form',
      fullName: 'Ravi Demo',
      answers: { organisation: 'Kestrel Labs', role: 'Partnerships', partner_type: 'diagnostic-lab' },
    });
  });
});

describe('formatLeadReference', () => {
  it('shortens a uuid', () => {
    expect(formatLeadReference('3f2a91bc-1234-4000-8000-000000000000')).toBe('3F2A-91BC');
  });
});
