/**
 * Website copy for the clinic pack. All of it is fictional demo content.
 * Rules: no medical advice, no symptom guidance, no real prices, no real people.
 */

export type SpecialtyIcon = 'stethoscope' | 'skin' | 'tooth' | 'movement' | 'womens-health' | 'diagnostics';

export interface SpecialtyDetail {
  readonly slug: string;
  readonly icon: SpecialtyIcon;
  readonly tagline: string;
  readonly intro: string;
  /** Reasons people book. Informational only, never symptom guidance. */
  readonly reasonsPeopleVisit: readonly string[];
  readonly firstVisit: readonly string[];
}

export const specialtyDetails: readonly SpecialtyDetail[] = [
  {
    slug: 'general-medicine',
    icon: 'stethoscope',
    tagline: 'A doctor who sees the whole picture.',
    intro:
      'Our general physicians are often the first doctor you meet. They take time to listen, look at your health as a whole, and bring in a specialist colleague when that would help.',
    reasonsPeopleVisit: [
      'Routine check-ups and annual health reviews',
      'Ongoing care for long-term conditions, alongside your existing doctor',
      'A second opinion on a plan you already have',
      'Not knowing which specialist to see',
    ],
    firstVisit: [
      'A care coordinator confirms your slot and what to bring.',
      'Your doctor talks with you about your history and what you would like help with.',
      'You leave with clear next steps, in writing, in English or Hindi.',
    ],
  },
  {
    slug: 'dermatology',
    icon: 'skin',
    tagline: 'Skin, hair and nails, seen by a specialist.',
    intro:
      'Our dermatologists see people of every age and skin type. Appointments are unhurried, and you will always know what a suggested treatment involves before agreeing to it.',
    reasonsPeopleVisit: [
      'Long-standing skin concerns you would like a specialist to look at',
      'Hair and scalp concerns',
      'Nail concerns',
      'A skin check before or after travel or a change in climate',
    ],
    firstVisit: [
      'Your dermatologist asks about your skin history and daily routine.',
      'If a test would help, they explain why before anything is done.',
      'You receive a written summary of what was discussed.',
    ],
  },
  {
    slug: 'dental',
    icon: 'tooth',
    tagline: 'Calm, careful dentistry.',
    intro:
      'Our dental team is used to nervous patients. We explain every step, agree on a plan with you, and never rush a decision.',
    reasonsPeopleVisit: [
      'Regular check-ups and cleaning',
      'Concerns about teeth or gums',
      'Planning treatment you have been putting off',
      "Children's first dental visits",
    ],
    firstVisit: [
      'A short conversation about your dental history and any worries.',
      'A gentle examination, with nothing done without your agreement.',
      'A written plan with options, so you can decide in your own time.',
    ],
  },
  {
    slug: 'physiotherapy',
    icon: 'movement',
    tagline: 'Move with more confidence.',
    intro:
      'Our physiotherapists build a plan around your daily life, whether you sit at a desk all day, play sport at weekends or want to stay active as you get older.',
    reasonsPeopleVisit: [
      'Recovering strength after time away from activity',
      'Building a routine you can keep up at home',
      'Desk-work posture and movement habits',
      'Staying active and steady with age',
    ],
    firstVisit: [
      'Your physiotherapist asks about your routine and goals.',
      'You try a few simple movements together, at your own pace.',
      'You leave with a short plan you can follow at home.',
    ],
  },
  {
    slug: 'womens-health',
    icon: 'womens-health',
    tagline: 'Care through every stage of life.',
    intro:
      'Our women’s health team offers private, respectful consultations, with women doctors available on request at both clinics.',
    reasonsPeopleVisit: [
      'Routine women’s health check-ups',
      'Planning ahead for a family',
      'Support through life changes',
      'A confidential conversation with a woman doctor',
    ],
    firstVisit: [
      'You can ask for a woman doctor when you book.',
      'Your doctor listens first and explains any examination before it happens.',
      'You can bring someone with you for support.',
    ],
  },
  {
    slug: 'diagnostics',
    icon: 'diagnostics',
    tagline: 'Tests and scans, with clear next steps.',
    intro:
      'Our diagnostics team carries out tests and scans requested by a doctor. Results go to your doctor, who talks you through them.',
    reasonsPeopleVisit: [
      'Tests requested by one of our doctors or by your own doctor',
      'Tests included in a health package',
      'Repeat tests on a schedule your doctor set',
    ],
    firstVisit: [
      'We confirm which tests your doctor requested and how to prepare.',
      'A short, private appointment at the clinic.',
      'Your results go to your doctor, who explains what they mean.',
    ],
  },
];

export interface HealthPackage {
  readonly id: string;
  readonly name: string;
  readonly forWhom: string;
  readonly includes: readonly string[];
  readonly duration: string;
  readonly specialtySlug: string;
}

/** Illustrative only. No prices are shown in the demo. */
export const healthPackages: readonly HealthPackage[] = [
  {
    id: 'everyday-check',
    name: 'Everyday health check',
    forWhom: 'Adults who want a yearly overview of their health.',
    includes: [
      'Consultation with a general physician',
      'A set of routine tests chosen by your doctor',
      'A follow-up conversation about your results',
    ],
    duration: 'About 90 minutes at the clinic',
    specialtySlug: 'general-medicine',
  },
  {
    id: 'womens-wellness',
    name: 'Women’s wellness',
    forWhom: 'Women who want a private, unhurried check-up.',
    includes: [
      'Consultation with a women’s health doctor',
      'Routine tests chosen by your doctor',
      'A written summary and follow-up conversation',
    ],
    duration: 'About 2 hours at the clinic',
    specialtySlug: 'womens-health',
  },
  {
    id: 'active-body',
    name: 'Active body',
    forWhom: 'Anyone who wants to move more comfortably day to day.',
    includes: ['An assessment with a physiotherapist', 'Four guided sessions', 'A home routine you can keep up'],
    duration: 'Five visits over about six weeks',
    specialtySlug: 'physiotherapy',
  },
  {
    id: 'skin-and-smile',
    name: 'Skin and smile',
    forWhom: 'Adults who want a skin review and a dental check in one visit.',
    includes: ['A consultation with a dermatologist', 'A dental check-up and cleaning', 'A written summary from both'],
    duration: 'About 2 hours at the clinic',
    specialtySlug: 'dermatology',
  },
];

export interface ClinicLocation {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly addressLines: readonly string[];
  readonly hours: readonly { readonly days: string; readonly time: string }[];
  readonly specialties: readonly string[];
  readonly access: readonly string[];
}

/** Fictional addresses in real cities. */
export const clinicLocations: readonly ClinicLocation[] = [
  {
    id: 'lakeside',
    name: 'Lakeside',
    city: 'Bengaluru',
    addressLines: ['12 Banyan Court, Lakeside Road', 'Bengaluru 560000 (fictional address)'],
    hours: [
      { days: 'Monday to Saturday', time: '8:30am to 8:00pm' },
      { days: 'Sunday', time: '9:00am to 1:00pm' },
    ],
    specialties: ['general-medicine', 'dermatology', 'dental', 'physiotherapy', 'womens-health', 'diagnostics'],
    access: ['Step-free entrance and lift', 'Wheelchair available on request', 'Quiet waiting room'],
  },
  {
    id: 'riverside',
    name: 'Riverside',
    city: 'Pune',
    addressLines: ['4 Gulmohar Lane, Riverside Park', 'Pune 411000 (fictional address)'],
    hours: [
      { days: 'Monday to Saturday', time: '9:00am to 7:30pm' },
      { days: 'Sunday', time: 'Closed' },
    ],
    specialties: ['general-medicine', 'dermatology', 'physiotherapy', 'womens-health'],
    access: ['Step-free entrance', 'Accessible toilet', 'Parking for two-wheelers and cars'],
  },
];

export interface PartnerAudience {
  readonly type: string;
  readonly title: string;
  readonly summary: string;
  readonly offers: readonly string[];
}

export const partnerAudiences: readonly PartnerAudience[] = [
  {
    type: 'corporate-wellness',
    title: 'Corporate wellness',
    summary: 'Health checks and quick access to the right doctor for your teams.',
    offers: [
      'On-site or in-clinic check-up days',
      'A dedicated care coordinator',
      'Aggregate, anonymised reporting only',
    ],
  },
  {
    type: 'insurance-tpa',
    title: 'Insurance and TPA partners',
    summary: 'Smooth cashless journeys and clear paperwork for your members.',
    offers: ['A single billing desk contact', 'Pre-visit cover checks', 'Clear, consistent documentation'],
  },
  {
    type: 'referring-doctor',
    title: 'Referring doctors',
    summary: 'Refer a patient and stay in the loop, with their consent.',
    offers: ['A direct referral line', 'Visit summaries shared back with consent', 'Shared follow-up plans'],
  },
  {
    type: 'diagnostic-lab',
    title: 'Diagnostic labs',
    summary: 'Work with us on tests our doctors request.',
    offers: ['Clear test requests', 'Agreed turnaround times', 'Secure result handover'],
  },
];

/** Fictional organisations for the partner strip. */
export const partnerWordmarks: readonly string[] = [
  'Brightleaf Works',
  'Tarang Health TPA',
  'Kestrel Labs',
  'Indigo Mills',
  'Sahyadri Software',
];

export const howItWorks = [
  {
    title: 'Tell us what you need',
    body: 'Fill in a short form or talk to our assistant. Two minutes, no medical jargon.',
  },
  {
    title: 'We understand, then match',
    body: 'We look at your concern, language and timing, and match you with the right doctor’s team.',
  },
  {
    title: 'Your team calls you back',
    body: 'A care coordinator from that team gets in touch at the time you chose, with clear next steps.',
  },
] as const;

export const trustPoints = [
  {
    title: 'Your details, your choice',
    body: 'We ask for only what we need, record what you agreed to, and delete your details if you withdraw consent.',
  },
  {
    title: 'Doctors make medical decisions',
    body: 'Our assistant helps route your enquiry. It never diagnoses or advises. Only a doctor who has seen you does that.',
  },
  {
    title: 'Clear at every step',
    body: 'You will always know who is contacting you, why, and what happens next.',
  },
] as const;
