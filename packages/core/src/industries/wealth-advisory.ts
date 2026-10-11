import { BRANDS } from '../brand';
import { wealthAdvisoryCrm, wealthAdvisorySequences } from './wealth-advisory-crm';
import { wealthAdvisoryDemoLeads, wealthAdvisoryDemoStaff } from './wealth-advisory-demo';
import { wealthAdvisorySite, wealthAdvisoryTheme } from './wealth-advisory-site';
import { wealthAdvisoryVoice } from './wealth-advisory-voice';
import type { IndustryPack } from './types';

/**
 * Wealth advisory industry pack: a fictional financial planning firm in India.
 * The web form, the CRM pipeline, routing and the voice assistant all read from
 * this object. Nothing here names, rates or recommends a product, predicts a
 * return or quotes a real fee: engagements describe what the work covers.
 */
export const wealthAdvisoryPack = {
  id: 'wealth_advisory',
  label: 'Wealth advisory',
  leadNoun: 'client',
  brand: BRANDS.wealth_advisory,
  roleLabels: {
    manager: 'Practice head',
    care_coordinator: 'Client coordinator',
    specialist_doctor: 'Advisor',
    billing_desk: 'Operations desk',
  },
  theme: wealthAdvisoryTheme,
  site: wealthAdvisorySite,

  offerings: [
    {
      slug: 'financial-planning',
      name: 'Financial planning',
      summary: 'One clear picture of your goals, savings and cover, including for families abroad.',
    },
    {
      slug: 'retirement-planning',
      name: 'Retirement planning',
      summary: 'Know where you stand and what to decide before you stop working.',
    },
    {
      slug: 'education-planning',
      name: 'Children’s education planning',
      summary: 'Planning ahead for school, college or study abroad.',
    },
    {
      slug: 'insurance-review',
      name: 'Insurance cover review',
      summary: 'Your existing policies explained in plain words. We do not sell policies.',
    },
    {
      slug: 'tax-planning-help',
      name: 'Tax-planning help',
      summary: 'Paperwork and planning conversations, alongside your chartered accountant.',
    },
    {
      slug: 'estate-planning',
      name: 'Will and estate planning',
      summary: 'Put your wishes in writing, with a partner law firm for the legal work.',
    },
  ],

  languages: [
    { code: 'en', nativeLabel: 'English', label: 'English' },
    { code: 'hi', nativeLabel: 'हिन्दी', label: 'Hindi' },
  ],

  intake: {
    offeringQuestionId: 'goal_area',
    offeringUnsureValue: 'not-sure',
    messageQuestionId: 'details',
    questions: [
      {
        id: 'goal_area',
        kind: 'select',
        label: 'What would you like help with?',
        voicePrompt:
          'What would you like help with today? For example a financial plan, retirement, a child’s education, insurance cover, tax paperwork or a will.',
        hint: 'Not sure? Choose "I\'m not sure yet" and a client coordinator will help.',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'financial-planning', label: 'Financial planning' },
          { value: 'retirement-planning', label: 'Retirement planning' },
          { value: 'education-planning', label: 'Children’s education planning' },
          { value: 'insurance-review', label: 'Insurance cover review' },
          { value: 'tax-planning-help', label: 'Tax-planning help (paperwork and planning)' },
          { value: 'estate-planning', label: 'Will and estate planning' },
          { value: 'not-sure', label: "I'm not sure yet" },
        ],
      },
      {
        id: 'details',
        kind: 'textarea',
        label: 'Tell us a little more (optional)',
        voicePrompt:
          'In a sentence or two, what would you like the advisor to know? Please do not share account numbers, PAN, OTPs or passwords.',
        hint: "A short note is enough. Please don't include account numbers, PAN or Aadhaar numbers, balances, OTPs or passwords.",
        required: false,
        maxLength: 500,
        channels: ['form', 'voice'],
      },
      {
        id: 'preferred_time',
        kind: 'radio',
        label: 'When should we get in touch?',
        voicePrompt: 'What time of day suits you best for a call back: morning, afternoon or evening?',
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
        id: 'meeting_mode',
        kind: 'radio',
        label: 'How would you like to meet an advisor?',
        voicePrompt: 'Would you like to meet an advisor at one of our offices, or on a video call?',
        hint: 'Video meetings suit families living abroad or outside our three cities.',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'office', label: 'At an office' },
          { value: 'video', label: 'On a video call' },
          { value: 'either', label: 'Either is fine' },
        ],
      },
      {
        id: 'transfer_help',
        kind: 'radio',
        label: 'Would you like help moving existing investments or policies?',
        voicePrompt: 'Would you like help moving or organising existing investments or policies? A yes or no is fine.',
        hint: 'If yes, our operations desk can explain the paperwork before your meeting. Please do not share account numbers here.',
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
        version: 'wealth-advisory-contact-v1',
        required: true,
        title: 'Store and use details to respond',
        text: 'I agree that {brand} may store and use the details in this form to respond to my enquiry, as described in the {privacy}. I can withdraw this consent at any time by emailing {email}, and my details will then be deleted.',
        requiredMessage: 'We need this consent to respond to your enquiry.',
        erasesDataOnWithdrawal: true,
      },
      {
        id: 'assistant_call',
        version: 'wealth-advisory-assistant-call-v1',
        required: false,
        title: 'Call from the AI assistant (9am to 9pm)',
        text: "Optional: I agree to receive a call from {brand}'s AI assistant between 9am and 9pm India time, so it can understand what I need before I am matched with an advisor. The call is handled by automated services (LiveKit speech services and Google Gemini), and Gemini's free service may use what I say to improve Google's products. The assistant never asks for an OTP, PIN or password. I can withdraw this consent at any time by emailing {email} or by saying so on the call.",
        erasesDataOnWithdrawal: false,
      },
    ],
  },

  partnerIntake: {
    messageMaxLength: 1000,
    partnerTypes: [
      { value: 'employer', label: 'Employer or HR team' },
      { value: 'chartered-accountant', label: 'Chartered accountant' },
      { value: 'law-firm', label: 'Law firm' },
      { value: 'community-association', label: 'Community or resident association' },
    ],
    consents: [
      {
        id: 'partner_contact',
        version: 'wealth-advisory-partner-contact-v1',
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
      description: 'Enquiry received, nobody has spoken to the client yet.',
      kind: 'open',
    },
    {
      id: 'ai_triaged',
      label: 'AI-triaged',
      description: 'The assistant has qualified the enquiry and routed it.',
      kind: 'open',
    },
    {
      id: 'meeting_booked',
      label: 'Meeting booked',
      description: 'A first advisory meeting is booked with the matched advisor.',
      kind: 'open',
    },
    {
      id: 'meeting_missed',
      label: 'Missed meeting',
      description: 'The client did not join a booked meeting.',
      kind: 'open',
    },
    {
      id: 'meeting_held',
      label: 'First meeting held',
      description: 'The client met their advisor.',
      kind: 'open',
    },
    {
      id: 'plan_shared',
      label: 'Plan shared',
      description: 'The advisor shared a written outline of what an engagement would cover; the client is deciding.',
      kind: 'open',
    },
    {
      id: 'plan_started',
      label: 'Plan started',
      description: 'The client has started a planning engagement.',
      kind: 'won',
    },
    {
      id: 'lost',
      label: 'Lost',
      description: 'The enquiry closed without an engagement.',
      kind: 'lost',
    },
  ],
  initialStageId: 'new',

  staffLevels: [
    {
      id: 'client_coordinator',
      label: 'Client coordinator',
      description: 'First point of contact. Triages unclear enquiries and books meetings.',
      rank: 1,
    },
    {
      id: 'operations_desk',
      label: 'Operations desk',
      description: 'Handles fees, paperwork and document checklists for existing holdings.',
      rank: 1,
    },
    {
      id: 'associate_advisor',
      label: 'Associate advisor',
      description: 'Meets clients within one or two planning areas.',
      rank: 2,
    },
    {
      id: 'senior_advisor',
      label: 'Senior advisor',
      description: 'Leads a planning area and takes urgent or complex enquiries.',
      rank: 3,
    },
    {
      id: 'practice_head',
      label: 'Practice head',
      description: 'Runs the advisory team. Not routed clients directly.',
      rank: 4,
    },
  ],

  billingRule: { questionId: 'transfer_help', equals: 'yes' },
  routing: {
    // Continuity counts most: a returning client should see the advisor who
    // already knows their situation. Then language and spare capacity.
    // Seniority only counts for urgent and high-urgency leads.
    weights: { language: 30, seniority: 25, load: 25, continuity: 40 },
    urgencySeniority: { urgent: 1, high: 0.6, normal: 0, low: 0 },
    urgentMinRank: 3,
    specialistRoles: ['specialist_doctor'],
    fallbackRole: 'care_coordinator',
    billingRole: 'billing_desk',
  },
  voice: wealthAdvisoryVoice,
  sequences: wealthAdvisorySequences,
  crm: wealthAdvisoryCrm,
  booking: {
    noun: 'advisory meeting',
    slotMinutes: 45,
    horizonDays: 14,
    bookableRoles: ['specialist_doctor'],
    bookedStageId: 'meeting_booked',
    attendedStageId: 'meeting_held',
    noShowStageId: 'meeting_missed',
    defaultHours: { weekdays: [1, 2, 3, 4, 5, 6], start: '10:00', end: '17:30' },
  },
  payments: {
    // Fictional test-mode fees for the illustrative engagements; nothing is ever charged.
    products: [
      {
        id: 'financial-plan',
        name: 'Family financial plan',
        description: 'Two advisor meetings, a written summary and a three-month review',
        amountPaise: 799900,
      },
      {
        id: 'retirement-review',
        name: 'Retirement readiness review',
        description: 'A mapping meeting, a written list of questions and a follow-up',
        amountPaise: 499900,
      },
      {
        id: 'cover-review',
        name: 'Insurance cover review',
        description: 'A plain-language summary of your policies and one follow-up meeting',
        amountPaise: 299900,
      },
    ],
    paidStageId: 'plan_started',
  },
  demo: { staff: wealthAdvisoryDemoStaff, leads: wealthAdvisoryDemoLeads },
} as const satisfies IndustryPack;

export type WealthAdvisoryPack = typeof wealthAdvisoryPack;
