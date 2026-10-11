import { describe, expect, it } from 'vitest';
import {
  BRAND,
  buildVoiceScript,
  clinicPack,
  leadUpdateFromCall,
  shouldRouteAfterCall,
  simulatedCallerTurns,
  stageAfterCall,
  voiceCallResultSchema,
  VoiceResultError,
  voiceScriptSchema,
} from '../src';

const script = buildVoiceScript(clinicPack);

describe('voice script built from the clinic pack', () => {
  it('validates against the contract and asks four to six questions, in pack order', () => {
    expect(voiceScriptSchema.parse(script)).toEqual(script);
    expect(script.questions.length).toBeGreaterThanOrEqual(4);
    expect(script.questions.length).toBeLessThanOrEqual(6);
    const formOrder = clinicPack.intake.questions.map((q) => q.id);
    const voiceOrder = script.questions.map((q) => q.id);
    expect([...voiceOrder].sort((a, b) => formOrder.indexOf(a) - formOrder.indexOf(b))).toEqual(voiceOrder);
  });

  it('has every line in English and Hindi, with the brand filled in and no tokens left over', () => {
    const lines = [
      script.greeting,
      script.consentDeclined,
      script.closing,
      script.identity.reply,
      script.safety.emergencyMessage,
      script.safety.adviceDecline,
      script.safety.injectionReply,
      ...Object.values(script.reprompts),
      ...Object.values(script.confirm),
      ...script.questions.map((q) => q.prompt),
    ];
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(['en', 'hi']);
      for (const text of Object.values(line)) {
        expect(text).not.toMatch(/\{(brand|assistant|emergency)\}/);
      }
    }
    expect(script.greeting.en).toContain(BRAND.name);
    expect(script.greeting.en).toMatch(/AI assistant/);
    expect(script.greeting.en).toMatch(/not a person/);
    expect(script.greeting.en).toMatch(/can't give medical advice/);
    expect(script.safety.emergencyMessage.en).toContain('112');
  });

  it('gives every option a label in both languages and words to recognise it by', () => {
    for (const question of script.questions) {
      for (const option of question.options) {
        expect(option.label.hi, `${question.id}.${option.value}`).toBeTruthy();
        const words = [...(option.synonyms.en ?? []), ...(option.synonyms.hi ?? [])];
        if (question.id !== 'has_insurance') expect(words.length, `${question.id}.${option.value}`).toBeGreaterThan(0);
      }
    }
  });

  it('covers every red-flag category the brief names, in both languages', () => {
    const ids = script.safety.redFlags.map((f) => f.id);
    for (const required of ['chest_pain', 'breathing', 'severe_bleeding', 'stroke_signs', 'suicidal_thoughts']) {
      expect(ids).toContain(required);
    }
    for (const flag of script.safety.redFlags) {
      expect(flag.phrases.en?.length, flag.id).toBeGreaterThan(0);
      expect(flag.phrases.hi?.length, flag.id).toBeGreaterThan(0);
      for (const phrase of [...(flag.phrases.en ?? []), ...(flag.phrases.hi ?? [])]) {
        expect(phrase).toBe(phrase.toLowerCase());
      }
    }
  });

  it('only asks questions that the pack marks for voice', () => {
    for (const q of script.questions) {
      expect(clinicPack.intake.questions.find((p) => p.id === q.id)?.channels).toContain('voice');
    }
  });
});

describe('voice call result contract', () => {
  const valid = {
    version: 1,
    callId: '0f8f5d2e-6b1c-4c1e-9a4b-2d3c4b5a6f70',
    leadId: '1ead0000-0000-4000-8000-000000000001',
    channel: 'browser',
    startedAt: '2026-10-10T10:00:00Z',
    endedAt: '2026-10-10T10:03:00Z',
    durationSeconds: 180,
    language: 'en',
    consentToContinue: true,
    outcome: 'completed',
    urgency: 'normal',
    answers: { concern_category: 'dental' },
    safetyFlags: [],
    summary: ['Looking for help with Dental; First visit.'],
    transcript: [{ speaker: 'assistant', text: 'Hello', atSeconds: 0 }],
    usage: { llmRequests: 2, sttSeconds: 120, ttsCharacters: 900 },
    agentVersion: '0.1.0',
  };

  it('accepts a well-formed result and rejects malformed ones', () => {
    expect(voiceCallResultSchema.parse(valid)).toEqual(valid);
    for (const broken of [
      { ...valid, summary: ['1', '2', '3', '4', '5', '6'] },
      { ...valid, answers: { 'DROP TABLE': 'x' } },
      { ...valid, safetyFlags: [{ kind: 'red_flag', code: 'Chest pain!', turn: 1 }] },
      { ...valid, outcome: 'diagnosed' },
      { ...valid, extra: true, leadId: 'not-a-uuid' },
      { ...valid, startedAt: 'yesterday' },
    ]) {
      expect(voiceCallResultSchema.safeParse(broken).success).toBe(false);
    }
  });
});

describe('applying a call to a lead', () => {
  const base = voiceCallResultSchema.parse({
    version: 1,
    callId: '0f8f5d2e-6b1c-4c1e-9a4b-2d3c4b5a6f70',
    leadId: '1ead0000-0000-4000-8000-000000000001',
    channel: 'browser',
    startedAt: '2026-10-10T10:00:00Z',
    endedAt: '2026-10-10T10:03:00Z',
    durationSeconds: 180,
    language: 'hi',
    consentToContinue: true,
    outcome: 'completed',
    urgency: 'normal',
    answers: {
      concern_category: 'dermatology',
      description: '  Rash on my arm since last week  ',
      preferred_time: 'evening',
      visit_type: 'first',
      has_insurance: 'yes',
    },
    safetyFlags: [],
    summary: [],
    transcript: [],
    usage: { llmRequests: 0, sttSeconds: 0, ttsCharacters: 0 },
    agentVersion: 'test',
  });

  it('derives specialty, billing flag, language and message from the answers', () => {
    expect(leadUpdateFromCall(base, clinicPack)).toEqual({
      answers: {
        concern_category: 'dermatology',
        preferred_time: 'evening',
        visit_type: 'first',
        has_insurance: 'yes',
      },
      specialty_slug: 'dermatology',
      billing_flag: true,
      urgency: 'normal',
      preferred_language: 'hi',
      message: 'Rash on my arm since last week',
    });
    const unsure = leadUpdateFromCall({ ...base, answers: { concern_category: 'not-sure' } }, clinicPack);
    expect(unsure.specialty_slug).toBeNull();
    expect(unsure).not.toHaveProperty('billing_flag');
  });

  it('rejects answers the pack does not allow', () => {
    expect(() => leadUpdateFromCall({ ...base, answers: { concern_category: 'astrology' } }, clinicPack)).toThrow(
      VoiceResultError,
    );
    expect(() => leadUpdateFromCall({ ...base, answers: { full_name: 'x' } }, clinicPack)).toThrow(VoiceResultError);
    expect(() => leadUpdateFromCall({ ...base, language: 'fr' }, clinicPack)).toThrow(VoiceResultError);
  });

  it('withdraws call consent when the caller declines', () => {
    expect(leadUpdateFromCall({ ...base, outcome: 'consent_declined', answers: {} }, clinicPack).withdraw_purpose).toBe(
      'assistant_call',
    );
  });

  it('moves only new leads to AI-triaged, and only when the call qualified them or raised an emergency', () => {
    expect(stageAfterCall(base, 'new', clinicPack)).toBe('ai_triaged');
    expect(stageAfterCall({ ...base, outcome: 'emergency', answers: {} }, 'new', clinicPack)).toBe('ai_triaged');
    expect(stageAfterCall({ ...base, outcome: 'caller_ended', answers: {} }, 'new', clinicPack)).toBeNull();
    expect(stageAfterCall({ ...base, outcome: 'caller_ended' }, 'new', clinicPack)).toBe('ai_triaged');
    expect(stageAfterCall({ ...base, outcome: 'consent_declined', answers: {} }, 'new', clinicPack)).toBeNull();
    expect(stageAfterCall(base, 'appointment_booked', clinicPack)).toBeNull();
  });

  it('routes unassigned leads unless the caller declined', () => {
    expect(shouldRouteAfterCall(base, null)).toBe(true);
    expect(shouldRouteAfterCall(base, 'someone')).toBe(false);
    expect(shouldRouteAfterCall({ ...base, outcome: 'consent_declined' }, null)).toBe(false);
  });
});

describe('simulated caller', () => {
  it('answers with what the lead wrote on the form, in their language', () => {
    expect(
      simulatedCallerTurns(clinicPack, {
        answers: { concern_category: 'dental', preferred_time: 'evening', visit_type: 'first', has_insurance: 'no' },
        message: 'Sensitive tooth',
        language: 'en',
      }),
    ).toEqual(['yes', 'Dental', 'Sensitive tooth', 'Evening', 'First visit', 'No', 'yes']);
    expect(
      simulatedCallerTurns(clinicPack, { answers: { preferred_time: 'morning' }, message: null, language: 'hi' }),
    ).toEqual(['हाँ', 'अभी पक्का नहीं', 'कुछ नहीं', 'सुबह', 'कुछ नहीं', 'कुछ नहीं', 'हाँ']);
  });
});
