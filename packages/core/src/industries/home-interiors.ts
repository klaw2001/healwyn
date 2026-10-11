import { BRANDS } from '../brand';
import { homeInteriorsCrm, homeInteriorsSequences } from './home-interiors-crm';
import { homeInteriorsDemoLeads, homeInteriorsDemoStaff } from './home-interiors-demo';
import { homeInteriorsSite, homeInteriorsTheme } from './home-interiors-site';
import { homeInteriorsVoice } from './home-interiors-voice';
import type { IndustryPack } from './types';

/**
 * Home interiors industry pack: a fictional interior design studio in India with
 * studios in Bengaluru, Chennai and Hyderabad. The web form, the CRM pipeline and
 * the voice assistant all read from this object. The studio never gives structural,
 * electrical, plumbing, gas or legal advice, and never promises prices, timelines
 * or warranties: those come from qualified people, in writing.
 */
export const homeInteriorsPack = {
  id: 'home_interiors',
  label: 'Home interiors studio',
  leadNoun: 'client',
  brand: BRANDS.home_interiors,
  roleLabels: {
    manager: 'Studio manager',
    care_coordinator: 'Design coordinator',
    specialist_doctor: 'Interior designer',
    billing_desk: 'Accounts desk',
  },
  theme: homeInteriorsTheme,
  site: homeInteriorsSite,

  offerings: [
    {
      slug: 'modular-kitchens',
      name: 'Modular kitchens',
      summary: 'Kitchens planned around how your family cooks, stores and cleans up.',
    },
    {
      slug: 'wardrobes-storage',
      name: 'Wardrobes and storage',
      summary: 'Made-to-measure wardrobes, lofts and storage for every room.',
    },
    {
      slug: 'full-home-interiors',
      name: 'Full-home interiors',
      summary: 'Every room of a new or newly bought home, planned together by one lead designer.',
    },
    {
      slug: 'living-dining',
      name: 'Living and dining rooms',
      summary: 'Layouts, TV walls, lighting and storage for the rooms you share.',
    },
    {
      slug: 'bedrooms-kids-rooms',
      name: 'Bedrooms and kids’ rooms',
      summary: 'Calm bedrooms and children’s rooms that can change as they grow.',
    },
    {
      slug: 'renovation-repairs',
      name: 'Renovation and repairs',
      summary: 'Cosmetic refreshes, coordinated with qualified contractors for anything more.',
    },
  ],

  languages: [
    { code: 'en', nativeLabel: 'English', label: 'English' },
    { code: 'hi', nativeLabel: 'हिन्दी', label: 'Hindi' },
  ],

  intake: {
    offeringQuestionId: 'project_type',
    offeringUnsureValue: 'not-sure',
    messageQuestionId: 'project_notes',
    questions: [
      {
        id: 'project_type',
        kind: 'select',
        label: 'What would you like help with?',
        voicePrompt:
          'What would you like help with? For example a modular kitchen, wardrobes, a full home, or something else.',
        hint: 'Not sure? Choose "I\'m not sure" and a design coordinator will help.',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'modular-kitchens', label: 'Modular kitchen' },
          { value: 'wardrobes-storage', label: 'Wardrobes and storage' },
          { value: 'full-home-interiors', label: 'Full-home interiors' },
          { value: 'living-dining', label: 'Living and dining room' },
          { value: 'bedrooms-kids-rooms', label: 'Bedrooms and kids’ rooms' },
          { value: 'renovation-repairs', label: 'Renovation and repairs (cosmetic work)' },
          { value: 'not-sure', label: "I'm not sure" },
        ],
      },
      {
        id: 'project_notes',
        kind: 'textarea',
        label: 'Tell us a little about your home (optional)',
        voicePrompt:
          'In a sentence or two, what would you like the designer to know? For example which rooms, the size of your home or a style you like. Please do not share ID numbers or bank details.',
        hint: "A short note is enough, such as the rooms and a style you like. Please don't include ID numbers, bank details or door codes.",
        required: false,
        maxLength: 500,
        channels: ['form', 'voice'],
      },
      {
        id: 'preferred_time',
        kind: 'radio',
        label: 'When should we get in touch?',
        voicePrompt: 'What time of day suits you best for a call: morning, afternoon or evening?',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'morning', label: 'Morning', description: '10am to 1pm' },
          { value: 'afternoon', label: 'Afternoon', description: '1pm to 5pm' },
          { value: 'evening', label: 'Evening', description: '5pm to 8pm' },
          { value: 'any', label: 'Any time', description: '10am to 8pm' },
        ],
      },
      {
        id: 'home_stage',
        kind: 'radio',
        label: 'Where is your home right now?',
        voicePrompt:
          'Is your home still under construction, have you just got the keys, or are you already living there?',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'under-construction', label: 'Still under construction' },
          { value: 'new-keys', label: 'Just got the keys', description: 'Not moved in yet' },
          { value: 'lived-in', label: 'Already living there' },
        ],
      },
      {
        id: 'pay_in_instalments',
        kind: 'radio',
        label: 'Would you like to pay in instalments?',
        voicePrompt: 'Would you like to pay in instalments? If yes, our accounts desk will explain the options.',
        hint: 'If yes, our accounts desk will explain the options before your design consultation.',
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
        version: 'home-interiors-contact-v1',
        required: true,
        title: 'Store and use details to respond',
        text: 'I agree that {brand} may store and use the details in this form to respond to my enquiry, as described in the {privacy}. I can withdraw this consent at any time by emailing {email}, and my details will then be deleted.',
        requiredMessage: 'We need this consent to respond to your enquiry.',
        erasesDataOnWithdrawal: true,
      },
      {
        id: 'assistant_call',
        version: 'home-interiors-assistant-call-v1',
        required: false,
        title: 'Call from the AI assistant (9am to 9pm)',
        text: "Optional: I agree to receive a call from {brand}'s AI assistant between 9am and 9pm India time, so it can understand what I need before I am matched with a designer. The call is handled by automated services (LiveKit speech services and Google Gemini), and Gemini's free service may use what I say to improve Google's products. I can withdraw this consent at any time by emailing {email} or by saying so on the call.",
        erasesDataOnWithdrawal: false,
      },
    ],
  },

  partnerIntake: {
    messageMaxLength: 1000,
    partnerTypes: [
      { value: 'builder-developer', label: 'Builder or developer' },
      { value: 'architect-engineer', label: 'Architect or engineer' },
      { value: 'material-supplier', label: 'Material or furniture supplier' },
      { value: 'contractor', label: 'Contractor or craftsperson' },
    ],
    consents: [
      {
        id: 'partner_contact',
        version: 'home-interiors-partner-contact-v1',
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
      description: 'The AI assistant has qualified the enquiry and routed it.',
      kind: 'open',
    },
    {
      id: 'consultation_booked',
      label: 'Consultation booked',
      description: 'A design consultation is booked with the matched designer.',
      kind: 'open',
    },
    {
      id: 'consultation_missed',
      label: 'Missed consultation',
      description: 'The client did not make it to a booked design consultation.',
      kind: 'open',
    },
    {
      id: 'site_measured',
      label: 'Site measured',
      description: 'The designer has met the client and measured the space.',
      kind: 'open',
    },
    {
      id: 'design_shared',
      label: 'Design shared',
      description: 'A design and an illustrative scope are with the client to review.',
      kind: 'open',
    },
    {
      id: 'design_confirmed',
      label: 'Design confirmed',
      description: 'The client confirmed the design and paid the design fee.',
      kind: 'won',
    },
    {
      id: 'lost',
      label: 'Lost',
      description: 'The enquiry closed without a confirmed design.',
      kind: 'lost',
    },
  ],
  initialStageId: 'new',

  staffLevels: [
    {
      id: 'design_coordinator',
      label: 'Design coordinator',
      description: 'First point of contact. Triages unclear enquiries and books design consultations.',
      rank: 1,
    },
    {
      id: 'accounts_desk',
      label: 'Accounts desk',
      description: 'Explains instalment options and handles design fees.',
      rank: 1,
    },
    {
      id: 'interior_designer',
      label: 'Interior designer',
      description: 'Designs rooms within a service line.',
      rank: 2,
    },
    {
      id: 'senior_designer',
      label: 'Senior designer',
      description: 'Leads a service line and takes urgent or complex projects.',
      rank: 3,
    },
    {
      id: 'studio_manager',
      label: 'Studio manager',
      description: 'Runs the studio team. Not routed clients directly.',
      rank: 4,
    },
  ],

  billingRule: { questionId: 'pay_in_instalments', equals: 'yes' },
  routing: {
    // Spare capacity and language matter most: a designer needs time for site
    // visits. Seniority counts for urgent and high-urgency leads (a leak or a
    // move-in date next week). A returning client's designer wins when they
    // also have room or speak the client's language.
    weights: { language: 30, seniority: 20, load: 30, continuity: 35 },
    urgencySeniority: { urgent: 1, high: 0.6, normal: 0, low: 0 },
    urgentMinRank: 3,
    specialistRoles: ['specialist_doctor'],
    fallbackRole: 'care_coordinator',
    billingRole: 'billing_desk',
  },
  voice: homeInteriorsVoice,
  sequences: homeInteriorsSequences,
  crm: homeInteriorsCrm,
  booking: {
    noun: 'design consultation',
    slotMinutes: 60,
    horizonDays: 14,
    bookableRoles: ['specialist_doctor'],
    bookedStageId: 'consultation_booked',
    attendedStageId: 'site_measured',
    noShowStageId: 'consultation_missed',
    defaultHours: { weekdays: [1, 2, 3, 4, 5, 6], start: '10:00', end: '18:00' },
  },
  payments: {
    // Fictional test-mode amounts; nothing is ever charged and no real price is implied.
    products: [
      {
        id: 'design-consultation',
        name: 'Design consultation fee',
        description: 'A home visit, measurements and a first conversation about your rooms',
        amountPaise: 99900,
      },
      {
        id: 'kitchen-refresh',
        name: 'Kitchen refresh 3D design',
        description: 'A kitchen layout with 3D views and a material board',
        amountPaise: 1499900,
      },
      {
        id: 'move-in-ready-2bhk',
        name: 'Move-in ready 2BHK 3D design',
        description: 'A whole-home plan with 3D views for every room',
        amountPaise: 3499900,
      },
    ],
    paidStageId: 'design_confirmed',
  },
  demo: { staff: homeInteriorsDemoStaff, leads: homeInteriorsDemoLeads },
} as const satisfies IndustryPack;

export type HomeInteriorsPack = typeof homeInteriorsPack;
