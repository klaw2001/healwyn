import type { PackTheme, SiteCopy } from './types';

/**
 * The clinic's public website copy. All of it is fictional demo content.
 * Rules: no medical advice, no symptom guidance, no real prices, no real people.
 */

export const clinicTheme: PackTheme = {
  light: {
    primary: '#0e5e58',
    primaryHover: '#0a4a45',
    primarySoft: '#cfe5df',
    onPrimary: '#ffffff',
    accent: '#eaa43c',
    accentSoft: '#fbead0',
    accentInk: '#7f4b06',
    onAccent: '#15302e',
    surfaceTint: '#e4f0ec',
    focus: '#0e5e58',
  },
  dark: {
    primary: '#5ec3b4',
    primaryHover: '#7fd4c7',
    primarySoft: '#1d403c',
    onPrimary: '#062220',
    accent: '#f0b459',
    accentSoft: '#3a2c16',
    accentInk: '#f4c57e',
    onAccent: '#1a1406',
    surfaceTint: '#123230',
    focus: '#7fd4c7',
  },
};

export const clinicSite: SiteCopy = {
  hero: 'clinic',
  nav: {
    services: 'Specialties',
    team: 'Doctors',
    plans: 'Health packages',
    locations: 'Locations',
    partners: 'For partners',
  },
  ctaLabel: 'Talk to us',
  home: {
    eyebrow: 'Multi-specialty clinics in Bengaluru and Pune',
    intro:
      'Tell us what you need in your own words. We listen, then match you with the doctor’s team best placed to help, at a time that suits you.',
    assistantNote:
      'The assistant is an AI, not a person. It asks a few short questions and never gives medical advice.',
    highlights: ['English and Hindi', 'Women doctors on request', 'Two clinics'],
    howItWorks: {
      title: 'From your first message to the right team, in three steps',
      intro: 'No phone trees, no repeating yourself. One short conversation, then a person who can actually help.',
      steps: [
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
      ],
    },
    services: {
      eyebrow: 'Specialties',
      title: 'Six specialties under one roof',
      intro: 'Doctors and clinicians across six specialties, working as one team so nobody falls between the gaps.',
    },
    partnersStrip: 'Working with employers, insurers and labs',
    trust: {
      eyebrow: 'Our promise',
      title: 'Care that starts with listening',
      intro: 'Technology helps us route your enquiry quickly. People, and only people, look after your health.',
      points: [
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
      ],
    },
    cta: {
      title: 'Not sure where to start? That is exactly what we are here for.',
      body: 'Tell us a little about what you need and a care coordinator will take it from there.',
    },
  },
  services: {
    eyebrow: 'Specialties',
    title: 'The right specialist, without the guesswork',
    intro:
      'Six specialties working as one team. Tell us what you need and we will match you with the right one, or simply choose below.',
    description:
      'General medicine, dermatology, dental, physiotherapy, women’s health and diagnostics, under one roof.',
    reasonsHeading: 'Why people book',
    firstStepsHeading: 'Your first visit',
    memberNoun: ['clinician', 'clinicians'],
    notSure: {
      title: 'Not sure which specialty you need?',
      body: 'Choose “I’m not sure” on the form and a care coordinator will help.',
    },
    details: [
      {
        slug: 'general-medicine',
        icon: 'stethoscope',
        tagline: 'A doctor who sees the whole picture.',
        intro:
          'Our general physicians are often the first doctor you meet. They take time to listen, look at your health as a whole, and bring in a specialist colleague when that would help.',
        reasons: [
          'Routine check-ups and annual health reviews',
          'Ongoing care for long-term conditions, alongside your existing doctor',
          'A second opinion on a plan you already have',
          'Not knowing which specialist to see',
        ],
        firstSteps: [
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
        reasons: [
          'Long-standing skin concerns you would like a specialist to look at',
          'Hair and scalp concerns',
          'Nail concerns',
          'A skin check before or after travel or a change in climate',
        ],
        firstSteps: [
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
        reasons: [
          'Regular check-ups and cleaning',
          'Concerns about teeth or gums',
          'Planning treatment you have been putting off',
          "Children's first dental visits",
        ],
        firstSteps: [
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
        reasons: [
          'Recovering strength after time away from activity',
          'Building a routine you can keep up at home',
          'Desk-work posture and movement habits',
          'Staying active and steady with age',
        ],
        firstSteps: [
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
        reasons: [
          'Routine women’s health check-ups',
          'Planning ahead for a family',
          'Support through life changes',
          'A confidential conversation with a woman doctor',
        ],
        firstSteps: [
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
        reasons: [
          'Tests requested by one of our doctors or by your own doctor',
          'Tests included in a health package',
          'Repeat tests on a schedule your doctor set',
        ],
        firstSteps: [
          'We confirm which tests your doctor requested and how to prepare.',
          'A short, private appointment at the clinic.',
          'Your results go to your doctor, who explains what they mean.',
        ],
      },
    ],
  },
  team: {
    eyebrow: 'Doctors',
    title: 'People who take the time to listen',
    intro:
      'Every clinician below works as part of a specialty team, so you are never handed from stranger to stranger.',
    description: 'Meet the (fictional) doctors and clinicians across our six specialties.',
    notice: {
      title: 'These are fictional profiles',
      body: 'Names, roles and portraits are invented for this demo. Any resemblance to real people is coincidental.',
    },
    offeringLabel: 'Specialty',
    locationsLabel: 'Clinics',
  },
  plans: {
    eyebrow: 'Health packages',
    title: 'Check-ups, planned around you',
    intro:
      'Each package brings a consultation, the tests your doctor chooses and a follow-up conversation into one visit.',
    description: 'Four illustrative health packages. Demo content: no prices are shown.',
    notice: {
      title: 'Illustrative packages',
      body: 'These packages are examples for this demo. No real prices are shown, and paying for one only runs a test payment. Your doctor decides which tests are right for you.',
    },
    items: [
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
        offeringSlug: 'general-medicine',
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
        offeringSlug: 'womens-health',
      },
      {
        id: 'active-body',
        name: 'Active body',
        forWhom: 'Anyone who wants to move more comfortably day to day.',
        includes: ['An assessment with a physiotherapist', 'Four guided sessions', 'A home routine you can keep up'],
        duration: 'Five visits over about six weeks',
        offeringSlug: 'physiotherapy',
      },
      {
        id: 'skin-and-smile',
        name: 'Skin and smile',
        forWhom: 'Adults who want a skin review and a dental check in one visit.',
        includes: [
          'A consultation with a dermatologist',
          'A dental check-up and cleaning',
          'A written summary from both',
        ],
        duration: 'About 2 hours at the clinic',
        offeringSlug: 'dermatology',
      },
    ],
  },
  locations: {
    eyebrow: 'Locations',
    title: 'Two calm, easy-to-reach clinics',
    intro: 'Step-free entrances, quiet waiting rooms and staff who know your name.',
    description: 'Two (fictional) clinics in Bengaluru and Pune.',
    notice: 'Both clinics and their addresses are fictional. Please do not visit these addresses.',
    offeringsLabel: 'Specialties here',
    items: [
      {
        id: 'lakeside',
        name: 'Lakeside',
        city: 'Bengaluru',
        addressLines: ['12 Banyan Court, Lakeside Road', 'Bengaluru 560000 (fictional address)'],
        hours: [
          { days: 'Monday to Saturday', time: '8:30am to 8:00pm' },
          { days: 'Sunday', time: '9:00am to 1:00pm' },
        ],
        offerings: ['general-medicine', 'dermatology', 'dental', 'physiotherapy', 'womens-health', 'diagnostics'],
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
        offerings: ['general-medicine', 'dermatology', 'physiotherapy', 'womens-health'],
        access: ['Step-free entrance', 'Accessible toilet', 'Parking for two-wheelers and cars'],
      },
    ],
  },
  partners: {
    eyebrow: 'For partners',
    title: 'Better care is a team effort',
    intro:
      'We work with employers, insurers, referring doctors and labs to get people to the right care, faster and with less paperwork.',
    description: 'Corporate wellness, insurance and TPA partners, referring doctors and diagnostic labs.',
    audiences: [
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
    ],
    wordmarks: ['Brightleaf Works', 'Tarang Health TPA', 'Kestrel Labs', 'Indigo Mills', 'Sahyadri Software'],
    formIntro:
      'Tell us a little about your organisation. Our partnerships team replies by email, usually within two working days.',
    notPartner: { title: 'Patient enquiries', individual: 'a patient' },
  },
  contact: {
    eyebrow: 'Contact and book',
    title: 'Tell us what you need',
    intro: 'Two minutes, in your own words. We will match you with the right doctor’s team and get back to you.',
    description: 'Tell us what you need and we will match you with the right doctor’s team.',
    steps: [
      {
        title: 'We read your enquiry',
        body: 'A care coordinator looks at what you need, your language and your timing.',
      },
      { title: 'We match you', body: 'Your enquiry goes to the doctor’s team best placed to help.' },
      { title: 'We get in touch', body: 'Someone from that team contacts you in the time window you chose.' },
    ],
    assistantBody: 'Our AI assistant asks the same questions by voice, in English or Hindi. Or fill in the form below.',
  },
  assistantIntro:
    'asks five short questions so the right doctor’s team can call you back. It cannot give medical advice.',
  privacy: {
    about: 'a fictional clinic brand used to demonstrate a patient enquiry platform',
    contactPurpose: 'We use your details to respond to your enquiry and to match you with the right doctor’s team.',
    assistantPurpose:
      'Our AI assistant may call you between 9am and 9pm India time to understand your needs before a person picks up your enquiry. It always says it is an AI assistant, and it never gives medical advice.',
    sensitiveExamples: 'test results, diagnoses, medicines or ID numbers',
    retention:
      'We keep enquiry details for up to 12 months after our last contact with you, then delete them, unless you become a patient and the law requires longer retention of medical records.',
  },
  legal: {
    note: 'This page is written for a fictional clinic so the demo is complete. It is not legal advice.',
    platform: 'a patient enquiry platform',
    fictionalThings: 'clinic, doctor, package or service',
    fictionalList: [
      'The brand, its clinics, addresses and opening hours.',
      'Every doctor and staff profile. Portraits are illustrations, not photos of real people.',
      'Health packages and their test payments: no real prices, and nothing can actually be bought.',
      'Partner organisations named on the site.',
      'Email addresses ending in .example, which cannot receive mail.',
    ],
    noAdviceHeading: 'No medical advice',
    relationship: 'Nothing on this site creates a doctor-patient relationship.',
    sensitiveData: 'health information',
    dontRely: 'Do not rely on anything here for health decisions.',
  },
};
