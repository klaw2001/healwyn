import { clinicCrm, clinicSequences } from './clinic-crm';
import type { IndustryPack } from './types';

/**
 * Clinic industry pack: a multi-specialty outpatient clinic in India.
 * The web form, the CRM pipeline (Phase 2) and the voice assistant (Phase 3)
 * all read from this object.
 */
export const clinicPack = {
  id: 'clinic',
  label: 'Multi-specialty clinic',
  leadNoun: 'patient',

  offerings: [
    {
      slug: 'general-medicine',
      name: 'General medicine',
      summary: 'Everyday health concerns, check-ups and ongoing care for adults.',
    },
    {
      slug: 'dermatology',
      name: 'Dermatology',
      summary: 'Skin, hair and nail concerns, seen by a skin specialist.',
    },
    {
      slug: 'dental',
      name: 'Dental',
      summary: 'Check-ups, cleaning and treatment for teeth and gums.',
    },
    {
      slug: 'physiotherapy',
      name: 'Physiotherapy',
      summary: 'Movement, recovery and strength, with a plan built around you.',
    },
    {
      slug: 'womens-health',
      name: "Women's health",
      summary: 'Care through every stage of life, with women doctors available.',
    },
    {
      slug: 'diagnostics',
      name: 'Diagnostics',
      summary: 'Tests and scans ordered by your doctor, with clear next steps.',
    },
  ],

  languages: [
    { code: 'en', nativeLabel: 'English', label: 'English' },
    { code: 'hi', nativeLabel: 'हिन्दी', label: 'Hindi' },
  ],

  intake: {
    offeringQuestionId: 'concern_category',
    offeringUnsureValue: 'not-sure',
    messageQuestionId: 'description',
    questions: [
      {
        id: 'concern_category',
        kind: 'select',
        label: 'What would you like help with?',
        voicePrompt:
          'What would you like help with today? For example skin, teeth, a general check-up, or something else.',
        hint: 'Not sure? Choose "I\'m not sure" and a care coordinator will help.',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'general-medicine', label: 'General medicine' },
          { value: 'dermatology', label: 'Dermatology (skin, hair, nails)' },
          { value: 'dental', label: 'Dental' },
          { value: 'physiotherapy', label: 'Physiotherapy' },
          { value: 'womens-health', label: "Women's health" },
          { value: 'diagnostics', label: 'Diagnostics (tests and scans)' },
          { value: 'not-sure', label: "I'm not sure" },
        ],
      },
      {
        id: 'description',
        kind: 'textarea',
        label: 'Tell us a little more (optional)',
        voicePrompt:
          'In a sentence or two, what would you like the doctor to know? Please do not share test results or ID numbers.',
        hint: "A short note is enough. Please don't include sensitive details such as test results, diagnoses, medicines or ID numbers.",
        required: false,
        maxLength: 500,
        channels: ['form', 'voice'],
      },
      {
        id: 'preferred_time',
        kind: 'radio',
        label: 'When should we get in touch?',
        voicePrompt: 'What time of day suits you best for a call or a visit: morning, afternoon or evening?',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'morning', label: 'Morning', description: '9am to 12pm' },
          { value: 'afternoon', label: 'Afternoon', description: '12pm to 4pm' },
          { value: 'evening', label: 'Evening', description: '4pm to 8pm' },
          { value: 'any', label: 'Any time', description: '9am to 8pm' },
        ],
      },
      {
        id: 'visit_type',
        kind: 'radio',
        label: 'Is this your first visit?',
        voicePrompt: 'Have you visited us before, or would this be your first visit?',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'first', label: 'First visit' },
          { value: 'follow-up', label: 'Follow-up' },
        ],
      },
      {
        id: 'has_insurance',
        kind: 'radio',
        label: 'Do you have health insurance you would like to use?',
        voicePrompt: 'Do you have health insurance you would like to use for this visit?',
        hint: 'If yes, our billing desk can check what is covered before your visit.',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
    consents: [
      {
        id: 'contact',
        version: 'clinic-contact-v1',
        required: true,
        title: 'Store and use details to respond',
        text: 'I agree that {brand} may store and use the details in this form to respond to my enquiry, as described in the {privacy}. I can withdraw this consent at any time by emailing {email}, and my details will then be deleted.',
        requiredMessage: 'We need this consent to respond to your enquiry.',
        erasesDataOnWithdrawal: true,
      },
      {
        id: 'assistant_call',
        version: 'clinic-assistant-call-v1',
        required: false,
        title: 'Call from the AI assistant (9am to 9pm)',
        text: "Optional: I agree to receive a call from {brand}'s AI assistant between 9am and 9pm India time, so it can understand what I need before I am matched with a doctor's team. I can withdraw this consent at any time by emailing {email} or by saying so on the call.",
        erasesDataOnWithdrawal: false,
      },
    ],
  },

  partnerIntake: {
    messageMaxLength: 1000,
    partnerTypes: [
      { value: 'corporate-wellness', label: 'Corporate wellness' },
      { value: 'insurance-tpa', label: 'Insurance or TPA' },
      { value: 'referring-doctor', label: 'Referring doctor' },
      { value: 'diagnostic-lab', label: 'Diagnostic lab' },
    ],
    consents: [
      {
        id: 'partner_contact',
        version: 'clinic-partner-contact-v1',
        required: true,
        title: 'Store and use details to respond',
        text: 'I agree that {brand} may store and use these details to respond to this partnership enquiry, as described in the {privacy}. I can withdraw this consent at any time by emailing {email}, and the details will then be deleted.',
        requiredMessage: 'We need this consent to respond to your enquiry.',
        erasesDataOnWithdrawal: true,
      },
    ],
  },

  stages: [
    {
      id: 'new',
      label: 'New',
      description: 'Enquiry received, nobody has spoken to the patient yet.',
      kind: 'open',
    },
    {
      id: 'ai_triaged',
      label: 'AI-triaged',
      description: 'The voice assistant has qualified the enquiry and routed it.',
      kind: 'open',
    },
    {
      id: 'appointment_booked',
      label: 'Appointment booked',
      description: 'A consultation is booked with the matched doctor.',
      kind: 'open',
    },
    {
      id: 'visited',
      label: 'Visited',
      description: 'The patient attended the consultation.',
      kind: 'open',
    },
    {
      id: 'follow_up_due',
      label: 'Follow-up due',
      description: 'The doctor asked for a follow-up that is not yet booked.',
      kind: 'open',
    },
    {
      id: 'package_active',
      label: 'Package active',
      description: 'The patient has an active health package.',
      kind: 'won',
    },
    {
      id: 'lost',
      label: 'Lost',
      description: 'The enquiry closed without a visit.',
      kind: 'lost',
    },
  ],
  initialStageId: 'new',

  staffLevels: [
    {
      id: 'care_coordinator',
      label: 'Care coordinator',
      description: 'First point of contact. Triages unclear enquiries and books visits.',
      rank: 1,
    },
    {
      id: 'billing_desk',
      label: 'Insurance and billing desk',
      description: 'Checks insurance cover and handles payments and packages.',
      rank: 1,
    },
    {
      id: 'specialist_doctor',
      label: 'Specialist doctor',
      description: 'Sees patients within a specialty.',
      rank: 2,
    },
    {
      id: 'senior_consultant',
      label: 'Senior consultant',
      description: 'Leads a specialty and takes urgent or complex cases.',
      rank: 3,
    },
    {
      id: 'clinic_manager',
      label: 'Clinic manager',
      description: 'Runs the clinic team. Not routed patients directly.',
      rank: 4,
    },
  ],

  billingRule: { questionId: 'has_insurance', equals: 'yes' },
  sequences: clinicSequences,
  crm: clinicCrm,
} as const satisfies IndustryPack;

export type ClinicPack = typeof clinicPack;
