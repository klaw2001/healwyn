import { BRANDS } from '../brand';
import { realEstateCrm, realEstateSequences } from './real-estate-crm';
import { realEstateDemoLeads, realEstateDemoStaff } from './real-estate-demo';
import { realEstateSite, realEstateTheme } from './real-estate-site';
import { realEstateVoice } from './real-estate-voice';
import type { IndustryPack } from './types';

/**
 * Real estate industry pack: a fictional residential brand in India selling new
 * launches and resale homes, with rentals and help with home-loan paperwork.
 * Every project, address and person is fictional. Nothing here, and nothing the
 * assistant says, is legal, tax, loan, investment or valuation advice.
 */
export const realEstatePack = {
  id: 'real_estate',
  label: 'Residential real estate',
  leadNoun: 'client',
  brand: BRANDS.real_estate,
  roleLabels: {
    manager: 'Sales manager',
    care_coordinator: 'Relationship coordinator',
    specialist_doctor: 'Property advisor',
    billing_desk: 'Home-loan and payments desk',
  },
  theme: realEstateTheme,
  site: realEstateSite,

  offerings: [
    {
      slug: 'apartments',
      name: 'Apartments',
      summary: 'New-launch and ready-to-move flats in gated communities.',
    },
    {
      slug: 'villas',
      name: 'Villas and row houses',
      summary: 'Independent homes with a little more space around them.',
    },
    {
      slug: 'plots',
      name: 'Plots',
      summary: 'Residential plots in planned layouts, to build on at your own pace.',
    },
    {
      slug: 'resale-homes',
      name: 'Resale homes',
      summary: 'Homes that have been lived in, in neighbourhoods that are already settled.',
    },
    {
      slug: 'rentals',
      name: 'Rentals',
      summary: 'Homes to rent, with a guided visit before you decide.',
    },
    {
      slug: 'home-loan-paperwork',
      name: 'Home-loan paperwork',
      summary: 'Help gathering the documents a partner bank asks for. Paperwork only, never loan advice.',
    },
  ],

  languages: [
    { code: 'en', nativeLabel: 'English', label: 'English' },
    { code: 'hi', nativeLabel: 'हिन्दी', label: 'Hindi' },
  ],

  intake: {
    offeringQuestionId: 'property_type',
    offeringUnsureValue: 'not-sure',
    messageQuestionId: 'details',
    questions: [
      {
        id: 'property_type',
        kind: 'select',
        label: 'What are you looking for?',
        voicePrompt:
          'What are you looking for today? For example a flat, a villa, a plot, a home to rent, or help with home-loan paperwork.',
        hint: 'Not sure? Choose "I\'m not sure yet" and a relationship coordinator will help.',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'apartments', label: 'Apartment (flat)' },
          { value: 'villas', label: 'Villa or row house' },
          { value: 'plots', label: 'Plot' },
          { value: 'resale-homes', label: 'Resale home' },
          { value: 'rentals', label: 'Home to rent' },
          { value: 'home-loan-paperwork', label: 'Help with home-loan paperwork' },
          { value: 'not-sure', label: "I'm not sure yet" },
        ],
      },
      {
        id: 'details',
        kind: 'textarea',
        label: 'Tell us a little more (optional)',
        voicePrompt:
          'In a sentence or two, what should our property advisor know, such as the area you like or how many bedrooms? Please do not share ID or bank account numbers.',
        hint: "A short note is enough, such as the area or the number of bedrooms. Please don't include ID numbers, bank details or income figures.",
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
          { value: 'morning', label: 'Morning', description: '9am to 12pm' },
          { value: 'afternoon', label: 'Afternoon', description: '12pm to 4pm' },
          { value: 'evening', label: 'Evening', description: '4pm to 8pm' },
          { value: 'any', label: 'Any time', description: '9am to 8pm' },
        ],
      },
      {
        id: 'move_timeline',
        kind: 'radio',
        label: 'When are you hoping to move?',
        voicePrompt: 'When are you hoping to move: within three months, in three to twelve months, or just exploring?',
        required: true,
        channels: ['form', 'voice'],
        options: [
          { value: 'within-3-months', label: 'Within 3 months' },
          { value: '3-to-12-months', label: 'In 3 to 12 months' },
          { value: 'just-exploring', label: 'Just exploring' },
        ],
      },
      {
        id: 'home_loan',
        kind: 'radio',
        label: 'Will you need a home loan?',
        voicePrompt: 'Will you need a home loan for this? If you are looking to rent, just say no.',
        hint: 'If yes, our home-loan desk can help you gather the documents a partner bank asks for. We never advise on loans.',
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
        version: 'real-estate-contact-v1',
        required: true,
        title: 'Store and use details to respond',
        text: 'I agree that {brand} may store and use the details in this form to respond to my enquiry, as described in the {privacy}. I can withdraw this consent at any time by emailing {email}, and my details will then be deleted.',
        requiredMessage: 'We need this consent to respond to your enquiry.',
        erasesDataOnWithdrawal: true,
      },
      {
        id: 'assistant_call',
        version: 'real-estate-assistant-call-v1',
        required: false,
        title: 'Call from the AI assistant (9am to 9pm)',
        text: "Optional: I agree to receive a call from {brand}'s AI assistant between 9am and 9pm India time, so it can understand what I am looking for before I am matched with a property advisor. The call is handled by automated services (LiveKit speech services and Google Gemini), and Gemini's free service may use what I say to improve Google's products. I can withdraw this consent at any time by emailing {email} or by saying so on the call.",
        erasesDataOnWithdrawal: false,
      },
    ],
  },

  partnerIntake: {
    messageMaxLength: 1000,
    partnerTypes: [
      { value: 'channel-partner', label: 'Channel partner or broker' },
      { value: 'partner-bank', label: 'Bank or housing finance company' },
      { value: 'corporate-relocation', label: 'Employer relocation team' },
      { value: 'developer-landowner', label: 'Developer or landowner' },
    ],
    consents: [
      {
        id: 'partner_contact',
        version: 'real-estate-partner-contact-v1',
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
      id: 'site_visit_booked',
      label: 'Site visit booked',
      description: 'A guided site visit is booked with the matched property advisor.',
      kind: 'open',
    },
    {
      id: 'site_visit_missed',
      label: 'Missed visit',
      description: 'The client did not come to a booked site visit.',
      kind: 'open',
    },
    {
      id: 'site_visit_done',
      label: 'Visited site',
      description: 'The client has seen the home or project with an advisor.',
      kind: 'open',
    },
    {
      id: 'negotiation',
      label: 'In discussion',
      description: 'The client is weighing up a home and its paperwork with the advisor.',
      kind: 'open',
    },
    {
      id: 'token_paid',
      label: 'Token paid',
      description: 'The client paid a refundable token to hold their choice (test mode in this demo).',
      kind: 'won',
    },
    {
      id: 'lost',
      label: 'Lost',
      description: 'The enquiry closed without a token.',
      kind: 'lost',
    },
  ],
  initialStageId: 'new',

  staffLevels: [
    {
      id: 'relationship_coordinator',
      label: 'Relationship coordinator',
      description: 'First point of contact. Triages unclear enquiries and books site visits.',
      rank: 1,
    },
    {
      id: 'loan_desk',
      label: 'Home-loan desk',
      description: 'Helps gather home-loan paperwork for partner banks and handles tokens. Never advises on loans.',
      rank: 1,
    },
    {
      id: 'property_advisor',
      label: 'Property advisor',
      description: 'Takes enquiries for a kind of home and leads site visits.',
      rank: 2,
    },
    {
      id: 'senior_advisor',
      label: 'Senior advisor',
      description: 'Leads a property team and takes urgent or complex enquiries.',
      rank: 3,
    },
    {
      id: 'sales_manager',
      label: 'Sales manager',
      description: 'Runs the sales team. Not routed enquiries directly.',
      rank: 4,
    },
  ],

  billingRule: { questionId: 'home_loan', equals: 'yes' },
  routing: {
    // Language and spare capacity matter most for a first call. Seniority only
    // counts for urgent and high-urgency leads (someone who must move soon).
    // Continuity keeps a returning client with the advisor who showed them homes.
    weights: { language: 30, seniority: 20, load: 30, continuity: 35 },
    urgencySeniority: { urgent: 1, high: 0.6, normal: 0, low: 0 },
    urgentMinRank: 3,
    specialistRoles: ['specialist_doctor'],
    fallbackRole: 'care_coordinator',
    billingRole: 'billing_desk',
  },
  voice: realEstateVoice,
  sequences: realEstateSequences,
  crm: realEstateCrm,
  booking: {
    noun: 'site visit',
    slotMinutes: 60,
    horizonDays: 14,
    bookableRoles: ['specialist_doctor'],
    bookedStageId: 'site_visit_booked',
    attendedStageId: 'site_visit_done',
    noShowStageId: 'site_visit_missed',
    // Tuesday to Sunday: weekends are when most people can visit a site.
    defaultHours: { weekdays: [0, 2, 3, 4, 5, 6], start: '10:00', end: '18:00' },
  },
  payments: {
    // Fictional test-mode amounts; nothing is ever charged and no home is ever sold.
    products: [
      {
        id: 'guided-site-visits',
        name: 'Site-visit priority token',
        description: 'Refundable token that holds a day of guided site visits',
        amountPaise: 100000,
      },
      {
        id: 'rental-shortlist',
        name: 'Rental visit token',
        description: 'Refundable token that holds a day of guided rental visits',
        amountPaise: 50000,
      },
      {
        id: 'expression-of-interest',
        name: 'Expression-of-interest token',
        description: 'Refundable token that records your interest in a fictional home',
        amountPaise: 2500000,
      },
    ],
    paidStageId: 'token_paid',
  },
  demo: { staff: realEstateDemoStaff, leads: realEstateDemoLeads },
} as const satisfies IndustryPack;

export type RealEstatePack = typeof realEstatePack;
