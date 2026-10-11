import type { PackTheme, SiteCopy } from './types';

/**
 * The wealth advisory firm's public website copy. All of it is fictional demo content.
 * Rules: no investment, tax or legal advice; no product names, returns, performance
 * claims or real fees; no real people, firms or addresses. Engagements describe what
 * the work covers, never what it earns.
 */

/** Deep navy with a soft plum accent: clearly apart from the clinic's teal and marigold. */
export const wealthAdvisoryTheme: PackTheme = {
  light: {
    primary: '#1f3f74',
    primaryHover: '#17305a',
    primarySoft: '#d9e2f2',
    onPrimary: '#ffffff',
    accent: '#d49ab8',
    accentSoft: '#f7e4ee',
    accentInk: '#7b2d5a',
    onAccent: '#15302e',
    surfaceTint: '#e7edf7',
    focus: '#1f3f74',
  },
  dark: {
    primary: '#94b4ea',
    primaryHover: '#b1c8f1',
    primarySoft: '#1f2e4b',
    onPrimary: '#0b1a33',
    accent: '#e3a6c6',
    accentSoft: '#3b1f30',
    accentInk: '#efbcd7',
    onAccent: '#2a0f1f',
    surfaceTint: '#16243a',
    focus: '#b1c8f1',
  },
};

export const wealthAdvisorySite: SiteCopy = {
  hero: 'growth',
  nav: {
    services: 'Services',
    team: 'Advisors',
    plans: 'Engagements',
    locations: 'Offices',
    partners: 'For partners',
  },
  ctaLabel: 'Talk to us',
  home: {
    eyebrow: 'Financial planning in Mumbai, Bengaluru and Delhi',
    intro:
      'Tell us what you are planning for in your own words. We listen, then match you with the advisor best placed to help, at a time that suits you.',
    assistantNote:
      'The assistant is an AI, not a person. It asks a few short questions, never gives investment advice and never asks for an OTP, PIN or password.',
    highlights: ['English and Hindi', 'Three offices', 'Video meetings for families abroad'],
    howItWorks: {
      title: 'From your first message to the right advisor, in three steps',
      intro: 'No sales calls and no product pitches. One short conversation, then a person who can actually help.',
      steps: [
        {
          title: 'Tell us what you are planning for',
          body: 'Fill in a short form or talk to our assistant. Two minutes, no jargon, no account numbers.',
        },
        {
          title: 'We understand, then match',
          body: 'We look at what you are planning for, your language and your timing, and match you with the right advisor.',
        },
        {
          title: 'Your advisor calls you back',
          body: 'A client coordinator gets in touch at the time you chose to set up a first meeting, in person or by video.',
        },
      ],
    },
    services: {
      eyebrow: 'Services',
      title: 'Six kinds of planning, one team',
      intro: 'Advisors across six areas, working as one team so nothing important falls between the gaps.',
    },
    partnersStrip: 'Working with employers, chartered accountants and law firms',
    trust: {
      eyebrow: 'Our promise',
      title: 'Planning that starts with listening',
      intro:
        'Technology helps us route your enquiry quickly. People, and only people, talk through your money with you.',
      points: [
        {
          title: 'Your details, your choice',
          body: 'We ask for only what we need, record what you agreed to, and delete your details if you withdraw consent.',
        },
        {
          title: 'Only advisors advise',
          body: 'Our assistant helps route your enquiry. It never names, rates or recommends anything. Only an advisor who knows your situation does that.',
        },
        {
          title: 'No codes, no pressure',
          body: 'Nobody from us will ever ask for an OTP, PIN or password, or push you to decide anything on a call.',
        },
      ],
    },
    cta: {
      title: 'Not sure where to start? That is exactly what we are here for.',
      body: 'Tell us a little about what you are planning for and a client coordinator will take it from there.',
    },
  },
  services: {
    eyebrow: 'Services',
    title: 'The right advisor, without the guesswork',
    intro:
      'Six planning services, one team. Tell us what you need and we will match you with the right advisor, or simply choose below.',
    description:
      'Financial planning, retirement, children’s education, insurance cover reviews, tax-planning help, and will and estate planning.',
    reasonsHeading: 'Why people get in touch',
    firstStepsHeading: 'Your first meeting',
    memberNoun: ['advisor', 'advisors'],
    notSure: {
      title: 'Not sure which service you need?',
      body: 'Choose “I’m not sure yet” on the form and a client coordinator will help.',
    },
    details: [
      {
        slug: 'financial-planning',
        icon: 'chart',
        tagline: 'A clear picture of your money, in one place.',
        intro:
          'Our advisors start by listening. Together you put your goals, savings and existing cover on one page, so every later conversation starts from the same picture.',
        reasons: [
          'Bringing savings, investments and insurance into one view',
          'Planning around a big change: marriage, a new job or a move',
          'Looking after money in India while living abroad',
          'A second look at a plan you already have',
        ],
        firstSteps: [
          'A client coordinator confirms your meeting and what to have ready.',
          'Your advisor asks about your goals, your timeline and what you already have.',
          'You receive a written note of what an engagement would cover, so you can decide in your own time.',
        ],
      },
      {
        slug: 'retirement-planning',
        icon: 'piggy-bank',
        tagline: 'Know where you stand before you stop working.',
        intro:
          'Whether retirement is two years away or twenty, our advisors help you see what you have, what you will need to decide, and in what order.',
        reasons: [
          'Wanting a clear picture before retiring',
          'Bringing old savings and pension accounts into one view',
          'Thinking through income once regular pay stops',
          'Helping a parent who has recently retired get organised',
        ],
        firstSteps: [
          'A short conversation about your plans and your timeline.',
          'Your advisor maps what you already have, without asking for passwords or codes.',
          'You leave with a written list of the questions worth settling, in English or Hindi.',
        ],
      },
      {
        slug: 'education-planning',
        icon: 'graduation',
        tagline: 'Planning ahead for a child’s education.',
        intro:
          'School, college or study abroad: our advisors help families plan for education alongside everything else they are saving for, without losing sight of either.',
        reasons: [
          'A child starting school or college in the next few years',
          'Thinking about studying abroad',
          'Balancing education goals with other family goals',
        ],
        firstSteps: [
          'Your advisor asks about each child’s timeline and your family’s other goals.',
          'You talk through the decisions ahead, one at a time.',
          'You receive a written summary you can share with the rest of the family.',
        ],
      },
      {
        slug: 'insurance-review',
        icon: 'shield',
        tagline: 'Understand the cover you already have.',
        intro:
          'Many families hold policies they no longer remember the details of. Our advisors read through what you share and explain it in plain words. We do not sell policies.',
        reasons: [
          'Old policies from different insurers that you want to understand',
          'A change in the family, such as a new baby or a parent moving in',
          'Wanting to know who your nominees are on each policy',
        ],
        firstSteps: [
          'A client coordinator lets you know which documents are useful to bring.',
          'Your advisor walks through each policy with you, in plain language.',
          'You leave with a list of questions to raise with your insurer, if any.',
        ],
      },
      {
        slug: 'tax-planning-help',
        icon: 'scales',
        tagline: 'Paperwork and planning conversations, done calmly.',
        intro:
          'Our advisors help you organise the documents and questions for your tax year, and work alongside your chartered accountant. Specific tax advice comes only from a qualified professional who has seen your documents.',
        reasons: [
          'Getting documents in order before the filing season',
          'A first year with income from more than one source',
          'Wanting your accountant and your advisor on the same page',
        ],
        firstSteps: [
          'A client coordinator shares a short checklist of documents.',
          'Your advisor helps you sort what you have and note what is missing.',
          'With your permission, we share a summary with your chartered accountant.',
        ],
      },
      {
        slug: 'estate-planning',
        icon: 'family',
        tagline: 'Put your wishes in writing, with care.',
        intro:
          'Our advisors help you think through what you would like to pass on and to whom, then introduce you to a partner law firm that drafts and reviews the documents. Legal advice comes only from the lawyer.',
        reasons: [
          'Writing a will for the first time',
          'Updating nominees after a change in the family',
          'Organising papers after a loss in the family',
          'Planning for a family member who will need support',
        ],
        firstSteps: [
          'A quiet, private conversation about your family and your wishes.',
          'Your advisor shares a checklist of documents to gather.',
          'If you would like, an introduction to a partner lawyer for the legal work.',
        ],
      },
    ],
  },
  team: {
    eyebrow: 'Advisors',
    title: 'People who take the time to listen',
    intro: 'Every advisor below works as part of one planning team, so you are never handed from stranger to stranger.',
    description: 'Meet the (fictional) advisors across our six services.',
    notice: {
      title: 'These are fictional profiles',
      body: 'Names, roles and portraits are invented for this demo, and none of these people holds a real registration. Any resemblance to real people is coincidental.',
    },
    offeringLabel: 'Focus',
    locationsLabel: 'Offices',
  },
  plans: {
    eyebrow: 'Engagements',
    title: 'Planning engagements, explained plainly',
    intro:
      'Each engagement describes what we will work on together and what you receive. None of them is a financial product, and none of them promises returns.',
    description: 'Four illustrative planning engagements. Demo content: no fees or returns are shown.',
    notice: {
      title: 'Illustrative engagements',
      body: 'These engagements are examples for this demo. No real fees are shown, nothing here is an offer, and paying for one only runs a test payment. Your advisor agrees the scope with you before any work starts.',
    },
    items: [
      {
        id: 'financial-plan',
        name: 'Family financial plan',
        forWhom: 'Families who want one clear picture of their money and their goals.',
        includes: [
          'Two meetings with an advisor',
          'A written summary of your goals, savings and cover as they stand today',
          'A review conversation after three months',
        ],
        duration: 'About six weeks',
        offeringSlug: 'financial-planning',
      },
      {
        id: 'retirement-review',
        name: 'Retirement readiness review',
        forWhom: 'People within about ten years of stopping work.',
        includes: [
          'A meeting to map what you already have',
          'A written list of the questions to settle before retiring',
          'A follow-up meeting to talk it through',
        ],
        duration: 'About four weeks',
        offeringSlug: 'retirement-planning',
      },
      {
        id: 'cover-review',
        name: 'Insurance cover review',
        forWhom: 'Anyone unsure what their existing policies actually cover.',
        includes: [
          'A plain-language summary of each policy you share',
          'A list of questions to raise with your insurer',
          'One follow-up meeting',
        ],
        duration: 'Two meetings over about three weeks',
        offeringSlug: 'insurance-review',
      },
      {
        id: 'will-session',
        name: 'Will and estate session',
        forWhom: 'Families who want to put their wishes in writing.',
        includes: [
          'A planning meeting with an advisor',
          'A checklist of documents to gather',
          'An introduction to a partner lawyer for the legal work',
        ],
        duration: 'Two meetings over about a month',
        offeringSlug: 'estate-planning',
      },
    ],
  },
  locations: {
    eyebrow: 'Offices',
    title: 'Three quiet, easy-to-reach offices',
    intro: 'Private meeting rooms, step-free access and people who know your name. Or meet us by video.',
    description: 'Three (fictional) offices in Mumbai, Bengaluru and Delhi.',
    notice: 'All three offices and their addresses are fictional. Please do not visit these addresses.',
    offeringsLabel: 'Services here',
    items: [
      {
        id: 'harbourside',
        name: 'Harbourside',
        city: 'Mumbai',
        addressLines: ['4th floor, 18 Sea Breeze Arcade', 'Mumbai 400000 (fictional address)'],
        hours: [
          { days: 'Monday to Friday', time: '9:30am to 6:30pm' },
          { days: 'Saturday', time: '10:00am to 2:00pm' },
        ],
        offerings: [
          'financial-planning',
          'retirement-planning',
          'education-planning',
          'insurance-review',
          'tax-planning-help',
          'estate-planning',
        ],
        access: ['Step-free entrance and lift', 'Private meeting rooms', 'Video meetings from this office'],
      },
      {
        id: 'jacaranda-court',
        name: 'Jacaranda Court',
        city: 'Bengaluru',
        addressLines: ['2nd floor, 7 Jacaranda Court, Garden Road', 'Bengaluru 560000 (fictional address)'],
        hours: [
          { days: 'Monday to Friday', time: '9:30am to 6:30pm' },
          { days: 'Saturday', time: 'By appointment' },
        ],
        offerings: ['financial-planning', 'retirement-planning', 'education-planning', 'insurance-review'],
        access: ['Step-free entrance', 'Accessible toilet', 'Parking for two-wheelers and cars'],
      },
      {
        id: 'neem-square',
        name: 'Neem Square',
        city: 'Delhi',
        addressLines: ['1st floor, 11 Neem Square, Ring Road', 'Delhi 110000 (fictional address)'],
        hours: [
          { days: 'Monday to Friday', time: '10:00am to 6:00pm' },
          { days: 'Saturday', time: 'Closed' },
        ],
        offerings: ['financial-planning', 'tax-planning-help', 'estate-planning', 'insurance-review'],
        access: ['Step-free entrance and lift', 'Quiet waiting area', 'A short walk from the metro'],
      },
    ],
  },
  partners: {
    eyebrow: 'For partners',
    title: 'Better planning is a team effort',
    intro:
      'We work with employers, chartered accountants, law firms and community associations to help people plan with less paperwork and more clarity.',
    description: 'Employers and HR teams, chartered accountants, law firms and community associations.',
    audiences: [
      {
        type: 'employer',
        title: 'Employers and HR teams',
        summary: 'Planning sessions and a clear point of contact for your teams.',
        offers: [
          'Group sessions on getting finances organised',
          'A dedicated client coordinator',
          'Aggregate, anonymised reporting only',
        ],
      },
      {
        type: 'chartered-accountant',
        title: 'Chartered accountants',
        summary: 'Work alongside us so your clients hear one consistent story.',
        offers: ['A direct referral line', 'Summaries shared back with client consent', 'Clear document checklists'],
      },
      {
        type: 'law-firm',
        title: 'Law firms',
        summary: 'Partner with us on wills and estate work for families.',
        offers: ['Warm introductions with client consent', 'Shared document checklists', 'Agreed handover steps'],
      },
      {
        type: 'community-association',
        title: 'Community and resident associations',
        summary: 'Talks on getting organised and staying safe from money scams.',
        offers: [
          'Free talks in English and Hindi',
          'Printed checklists for members',
          'No selling, ever, at any session',
        ],
      },
    ],
    wordmarks: [
      'Northstep Benefits',
      'Corvel and Nandan CAs',
      'Ambrella Law Partners',
      'Tulsi Grove Residents Forum',
      'Quillmark Software',
    ],
    formIntro:
      'Tell us a little about your organisation. Our partnerships team replies by email, usually within two working days.',
    notPartner: { title: 'Personal enquiries', individual: 'looking for help with your own money' },
  },
  contact: {
    eyebrow: 'Contact and book',
    title: 'Tell us what you are planning for',
    intro: 'Two minutes, in your own words. We will match you with the right advisor and get back to you.',
    description: 'Tell us what you are planning for and we will match you with the right advisor.',
    steps: [
      {
        title: 'We read your enquiry',
        body: 'A client coordinator looks at what you need, your language and your timing.',
      },
      { title: 'We match you', body: 'Your enquiry goes to the advisor best placed to help.' },
      {
        title: 'We get in touch',
        body: 'Someone from our team contacts you in the time window you chose. We will never ask for an OTP, PIN or password.',
      },
    ],
    assistantBody: 'Our AI assistant asks the same questions by voice, in English or Hindi. Or fill in the form below.',
  },
  assistantIntro:
    'asks five short questions so the right advisor can call you back. It cannot give investment, tax or legal advice, and it never asks for an OTP, PIN or password.',
  privacy: {
    about: 'a fictional wealth advisory brand used to demonstrate a client enquiry platform',
    contactPurpose: 'We use your details to respond to your enquiry and to match you with the right advisor.',
    assistantPurpose:
      'Our AI assistant may call you between 9am and 9pm India time to understand your needs before a person picks up your enquiry. It always says it is an AI assistant, it never gives investment advice, and it never asks for an OTP, PIN or password.',
    sensitiveExamples: 'account numbers, PAN or Aadhaar numbers, balances, OTPs or passwords',
    retention:
      'We keep enquiry details for up to 12 months after our last contact with you, then delete them, unless you become a client and the law requires us to keep records for longer.',
  },
  legal: {
    note: 'This page is written for a fictional wealth advisory firm so the demo is complete. It is not legal advice.',
    platform: 'a client enquiry platform',
    fictionalThings: 'firm, advisor, engagement or service',
    fictionalList: [
      'The brand, its offices, addresses and opening hours.',
      'Every advisor and staff profile, and every registration they might appear to hold. Portraits are illustrations, not photos of real people.',
      'Planning engagements and their test payments: no real fees, and nothing can actually be bought.',
      'Partner organisations named on the site.',
      'Email addresses ending in .example, which cannot receive mail.',
    ],
    noAdviceHeading: 'No investment, tax or legal advice',
    relationship:
      'Nothing on this site creates an advisory relationship, and nothing here is an offer to buy or sell anything.',
    sensitiveData: 'financial information',
    dontRely: 'Do not rely on anything here for investment, tax or legal decisions.',
  },
};
