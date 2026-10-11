import type { PackTheme, SiteCopy } from './types';

/**
 * The real estate brand's public website copy. All of it is fictional demo
 * content. Rules: no legal, tax, loan, investment or valuation advice; no price,
 * return or possession-date predictions; no real projects, prices or people.
 */

/**
 * Leaf green and lavender: fresh and calm, and clearly apart from the clinic's
 * teal and marigold, the interiors pack's terracotta and the wealth pack's navy.
 */
export const realEstateTheme: PackTheme = {
  light: {
    primary: '#3f6212',
    primaryHover: '#33500e',
    primarySoft: '#e2ecd0',
    onPrimary: '#ffffff',
    accent: '#b3a4e6',
    accentSoft: '#ece8fa',
    accentInk: '#5541a8',
    onAccent: '#15302e',
    surfaceTint: '#eef2e2',
    focus: '#3f6212',
  },
  dark: {
    primary: '#b5d37a',
    primaryHover: '#c9e099',
    primarySoft: '#2c3a16',
    onPrimary: '#16200a',
    accent: '#c2b5f0',
    accentSoft: '#2a2445',
    accentInk: '#cfc4f5',
    onAccent: '#1a1338',
    surfaceTint: '#1c2814',
    focus: '#c9e099',
  },
};

export const realEstateSite: SiteCopy = {
  hero: 'home',
  nav: {
    services: 'Homes',
    team: 'Advisors',
    plans: 'Visit packages',
    locations: 'Experience centres',
    partners: 'For partners',
  },
  ctaLabel: 'Talk to us',
  home: {
    eyebrow: 'New launches and resale homes in Bengaluru, Pune and Hyderabad',
    intro:
      'Tell us what you are looking for in your own words. We listen, then match you with the property advisor who knows that kind of home best, at a time that suits you.',
    assistantNote:
      'The assistant is an AI, not a person. It asks a few short questions and never gives legal, loan or investment advice.',
    highlights: ['English and Hindi', 'Guided site visits', 'Three cities'],
    howItWorks: {
      title: 'From your first message to the right advisor, in three steps',
      intro: 'No endless calls from strangers. One short conversation, then one advisor who knows what you need.',
      steps: [
        {
          title: 'Tell us what you are looking for',
          body: 'Fill in a short form or talk to our assistant. Two minutes, no jargon.',
        },
        {
          title: 'We understand, then match',
          body: 'We look at the kind of home, your language and your timing, and match you with the right advisor.',
        },
        {
          title: 'Your advisor calls you back',
          body: 'Your advisor gets in touch at the time you chose and plans site visits around you.',
        },
      ],
    },
    services: {
      eyebrow: 'Homes',
      title: 'Six ways we can help',
      intro: 'Flats, villas, plots, resale homes and rentals, with help on home-loan paperwork, from one team.',
    },
    partnersStrip: 'Working with partner banks, relocation teams and channel partners',
    trust: {
      eyebrow: 'Our promise',
      title: 'Honest help, at your pace',
      intro: 'Technology helps us route your enquiry quickly. People, and only people, help you find a home.',
      points: [
        {
          title: 'Your details, your choice',
          body: 'We ask for only what we need, record what you agreed to, and delete your details if you withdraw consent.',
        },
        {
          title: 'Facts, not forecasts',
          body: 'We share what a home offers, as it is. We never predict prices or returns, and we never tell you a title or approval is fine: your own lawyer checks that.',
        },
        {
          title: 'No pressure',
          body: 'You will always know who is calling, why, and what happens next. Taking your time is welcome.',
        },
      ],
    },
    cta: {
      title: 'Not sure where to start? That is exactly what we are here for.',
      body: 'Tell us a little about what you are looking for and a relationship coordinator will take it from there.',
    },
  },
  services: {
    eyebrow: 'Homes',
    title: 'The right home, without the guesswork',
    intro:
      'Six kinds of help from one team. Tell us what you are looking for and we will match you with the right advisor, or simply choose below.',
    description:
      'Apartments, villas and row houses, plots, resale homes, rentals and help with home-loan paperwork, from one team.',
    reasonsHeading: 'Why people get in touch',
    firstStepsHeading: 'What happens first',
    memberNoun: ['advisor', 'advisors'],
    notSure: {
      title: 'Not sure what kind of home suits you?',
      body: 'Choose “I’m not sure yet” on the form and a relationship coordinator will help.',
    },
    details: [
      {
        slug: 'apartments',
        icon: 'apartment',
        tagline: 'Flats in communities that are easy to live in.',
        intro:
          'Our apartment advisors know the new launches and ready-to-move towers in each city. They walk every site before they show it to you, and plan visits so you see several homes in one trip.',
        reasons: [
          'Buying a first home',
          'Moving to a bigger flat as a family grows',
          'Finding a home close to work, school or a metro line',
          'Seeing a few new launches side by side',
        ],
        firstSteps: [
          'Your advisor asks about the areas, size and amenities that matter to you.',
          'You visit a few homes together, at your own pace.',
          'You receive each project’s documents, as they are, to check with your own lawyer.',
        ],
      },
      {
        slug: 'villas',
        icon: 'villa',
        tagline: 'A little more room around you.',
        intro:
          'Villas and row houses suit people who want a garden, a terrace or simply quieter neighbours. Our advisors know the gated villa communities in each city and what daily life there is like.',
        reasons: [
          'Wanting an independent home with outdoor space',
          'Living close to family in the same community',
          'Moving out of the city centre',
        ],
        firstSteps: [
          'A short call about the space, layout and location you have in mind.',
          'Guided visits to villas and row houses that fit, often on a weekend.',
          'A written note of what you saw at each home, so you can compare in your own time.',
        ],
      },
      {
        slug: 'plots',
        icon: 'plot',
        tagline: 'Land in a planned layout, to build on when you are ready.',
        intro:
          'Some people would rather design their own home. Our plot advisors show residential plots in planned layouts and share each layout’s documents as they are.',
        reasons: [
          'Planning to build a home in a few years',
          'Wanting a plot near family or a home town',
          'Seeing what a planned layout looks like before deciding',
        ],
        firstSteps: [
          'Your advisor asks about the size and area you are considering.',
          'A guided walk of the layout, its roads and its shared spaces.',
          'Copies of the layout’s documents for your own lawyer to check.',
        ],
      },
      {
        slug: 'resale-homes',
        icon: 'office',
        tagline: 'Lived-in homes in settled neighbourhoods.',
        intro:
          'A resale home lets you see exactly what you are getting: the light, the neighbours and the daily commute. Our advisors arrange visits with owners and keep you informed at every step.',
        reasons: [
          'Wanting to move into a finished home',
          'Preferring a neighbourhood that is already settled',
          'Seeing the real home, not a show flat',
        ],
        firstSteps: [
          'Your advisor shortlists resale homes that match what you asked for.',
          'Visits are arranged with the owners at times that suit you.',
          'You receive the documents the owner shares, to check with your own lawyer.',
        ],
      },
      {
        slug: 'rentals',
        icon: 'key',
        tagline: 'A home to rent, seen before you decide.',
        intro:
          'Moving for work, studies or a change of scene? Our rental advisors shortlist homes that fit, then show them to you in person or on a video call.',
        reasons: [
          'Relocating to a new city for work',
          'Needing a home before a school or college term starts',
          'Renting while you decide where to buy',
        ],
        firstSteps: [
          'A short call about the area, size and move-in date you need.',
          'A shortlist of homes to rent, with guided visits.',
          'A checklist of what to read in a rent agreement, to go through with your own lawyer.',
        ],
      },
      {
        slug: 'home-loan-paperwork',
        icon: 'loan',
        tagline: 'The paperwork, sorted step by step.',
        intro:
          'Our home-loan desk helps you gather the documents partner banks usually ask for. We never advise on loans, amounts or interest rates: the bank decides, and you choose.',
        reasons: [
          'Not knowing which documents a bank will ask for',
          'Wanting help keeping the paperwork in order',
          'Being introduced to a partner bank',
        ],
        firstSteps: [
          'The home-loan desk shares a checklist of documents partner banks usually ask for.',
          'You meet the desk to go through the checklist together.',
          'If you wish, we introduce you to a partner bank, which makes its own decision.',
        ],
      },
    ],
  },
  team: {
    eyebrow: 'Advisors',
    title: 'People who know the neighbourhoods',
    intro:
      'Every advisor below works as part of a small team for one kind of home, so you are never handed from stranger to stranger.',
    description: 'Meet the (fictional) property advisors across our three cities.',
    notice: {
      title: 'These are fictional profiles',
      body: 'Names, roles and portraits are invented for this demo. Any resemblance to real people is coincidental.',
    },
    offeringLabel: 'Focus',
    locationsLabel: 'Experience centres',
  },
  plans: {
    eyebrow: 'Visit packages',
    title: 'What is included, before you decide',
    intro:
      'Each package brings guided visits, documents and a named advisor together, so nothing falls between the gaps.',
    description: 'Four illustrative visit packages. Demo content: no prices are shown.',
    notice: {
      title: 'Illustrative packages',
      body: 'These packages are examples for this demo. No real prices are shown, and paying a token only runs a test payment. Nothing here is an offer to sell or rent a home.',
    },
    items: [
      {
        id: 'guided-site-visits',
        name: 'Guided site visits',
        forWhom: 'Anyone who wants to see several new homes in one day.',
        includes: [
          'Visits to up to three fictional projects with one advisor',
          'Pick-up from an experience centre',
          'A written note of what you saw at each home',
        ],
        duration: 'One day, usually a weekend',
        offeringSlug: 'apartments',
      },
      {
        id: 'plot-walkthrough',
        name: 'Plot walkthrough',
        forWhom: 'People who want to build a home of their own one day.',
        includes: [
          'A guided walk of a planned layout',
          'Copies of the layout’s documents, as they are',
          'A follow-up call to answer questions about the visit',
        ],
        duration: 'About half a day',
        offeringSlug: 'plots',
      },
      {
        id: 'rental-shortlist',
        name: 'Rental shortlist',
        forWhom: 'People moving to a new city who need a home to rent.',
        includes: [
          'A shortlist of homes that match what you asked for',
          'Guided visits, in person or by video call',
          'A checklist of what to read in a rent agreement',
        ],
        duration: 'About a week from first call to visits',
        offeringSlug: 'rentals',
      },
      {
        id: 'paperwork-checklist',
        name: 'Paperwork checklist',
        forWhom: 'Anyone who will need a home loan and wants the documents in order.',
        includes: [
          'A checklist of documents partner banks usually ask for',
          'A session with the home-loan desk to go through it',
          'An introduction to a partner bank, if you wish',
        ],
        duration: 'One meeting of about an hour',
        offeringSlug: 'home-loan-paperwork',
      },
    ],
  },
  locations: {
    eyebrow: 'Experience centres',
    title: 'Three easy-to-reach experience centres',
    intro: 'Quiet meeting rooms, model layouts to look at and a team that plans site visits around you.',
    description: 'Three (fictional) experience centres in Bengaluru, Pune and Hyderabad.',
    notice: 'All three centres and their addresses are fictional. Please do not visit these addresses.',
    offeringsLabel: 'Help available here',
    items: [
      {
        id: 'banyan-square',
        name: 'Banyan Square',
        city: 'Bengaluru',
        addressLines: ['21 Banyan Square, Silver Oak Road', 'Bengaluru 560000 (fictional address)'],
        hours: [
          { days: 'Tuesday to Sunday', time: '10:00am to 7:00pm' },
          { days: 'Monday', time: 'Closed' },
        ],
        offerings: ['apartments', 'villas', 'plots', 'resale-homes', 'rentals', 'home-loan-paperwork'],
        access: ['Step-free entrance and lift', 'Visitor parking', 'Site-visit pick-up from the centre on request'],
      },
      {
        id: 'hillview',
        name: 'Hillview',
        city: 'Pune',
        addressLines: ['8 Tamarind Walk, Hillview Road', 'Pune 411000 (fictional address)'],
        hours: [
          { days: 'Tuesday to Sunday', time: '10:00am to 7:00pm' },
          { days: 'Monday', time: 'Closed' },
        ],
        offerings: ['apartments', 'villas', 'resale-homes', 'rentals', 'home-loan-paperwork'],
        access: ['Step-free entrance', 'Accessible toilet', 'Parking for two-wheelers and cars'],
      },
      {
        id: 'pearl-gate',
        name: 'Pearl Gate',
        city: 'Hyderabad',
        addressLines: ['5 Pearl Gate Arcade, Lotus Ring Road', 'Hyderabad 500000 (fictional address)'],
        hours: [
          { days: 'Tuesday to Sunday', time: '10:00am to 6:30pm' },
          { days: 'Monday', time: 'Closed' },
        ],
        offerings: ['apartments', 'villas', 'plots', 'home-loan-paperwork'],
        access: ['Step-free entrance and lift', 'Quiet meeting rooms', 'Visitor parking'],
      },
    ],
  },
  partners: {
    eyebrow: 'For partners',
    title: 'Finding a home is a team effort',
    intro:
      'We work with channel partners, banks, relocation teams and landowners to help people find the right home, with less back and forth.',
    description: 'Channel partners and brokers, banks and housing finance companies, relocation teams and landowners.',
    audiences: [
      {
        type: 'channel-partner',
        title: 'Channel partners and brokers',
        summary: 'Introduce a client and stay in the loop, with their consent.',
        offers: [
          'A named advisor for every client you introduce',
          'Clear updates at each stage',
          'Shared site-visit plans',
        ],
      },
      {
        type: 'partner-bank',
        title: 'Banks and housing finance companies',
        summary: 'Receive complete, well-organised paperwork from clients who choose you.',
        offers: [
          'A single home-loan desk contact',
          'Document checklists agreed with you',
          'Introductions only when the client asks',
        ],
      },
      {
        type: 'corporate-relocation',
        title: 'Employer relocation teams',
        summary: 'Help people joining your teams find a home to rent or buy.',
        offers: [
          'A dedicated relationship coordinator',
          'Rental shortlists before people arrive',
          'Aggregate updates only',
        ],
      },
      {
        type: 'developer-landowner',
        title: 'Developers and landowners',
        summary: 'Talk to us about bringing a project or a plot layout to our clients.',
        offers: [
          'Guided site visits by our advisors',
          'Clear, consistent information for visitors',
          'Regular visit summaries',
        ],
      },
    ],
    wordmarks: [
      'Saffron Arch Bank',
      'Tidewater Relocations',
      'Oakline Developers',
      'Coralstone Home Finance',
      'Lantern Bay Brokers',
    ],
    formIntro:
      'Tell us a little about your organisation. Our partnerships team replies by email, usually within two working days.',
    notPartner: { title: 'Home enquiries', individual: 'looking for a home' },
  },
  contact: {
    eyebrow: 'Contact and visit',
    title: 'Tell us what you are looking for',
    intro: 'Two minutes, in your own words. We will match you with the right property advisor and get back to you.',
    description: 'Tell us what you are looking for and we will match you with the right property advisor.',
    steps: [
      {
        title: 'We read your enquiry',
        body: 'A relationship coordinator looks at what you need, your language and your timing.',
      },
      { title: 'We match you', body: 'Your enquiry goes to the advisor who knows that kind of home best.' },
      { title: 'We get in touch', body: 'Your advisor contacts you in the time window you chose.' },
    ],
    assistantBody: 'Our AI assistant asks the same questions by voice, in English or Hindi. Or fill in the form below.',
  },
  assistantIntro:
    'asks five short questions so the right property advisor can call you back. It cannot give legal, loan or investment advice.',
  privacy: {
    about: 'a fictional residential real estate brand used to demonstrate a home-buyer enquiry platform',
    contactPurpose: 'We use your details to respond to your enquiry and to match you with the right property advisor.',
    assistantPurpose:
      'Our AI assistant may call you between 9am and 9pm India time to understand what you are looking for before a person picks up your enquiry. It always says it is an AI assistant, and it never gives legal, tax, loan or investment advice.',
    sensitiveExamples: 'ID numbers, bank account details, income figures or loan documents',
    retention:
      'We keep enquiry details for up to 12 months after our last contact with you, then delete them, unless you go ahead with a home and the law requires us to keep transaction records for longer.',
  },
  legal: {
    note: 'This page is written for a fictional real estate brand so the demo is complete. It is not legal advice.',
    platform: 'a home-buyer enquiry platform',
    fictionalThings: 'developer, project, home, advisor or service',
    fictionalList: [
      'The brand, its experience centres, projects, addresses and opening hours.',
      'Every advisor and staff profile. Portraits are illustrations, not photos of real people.',
      'Visit packages and their test payments: no real prices, and no home can actually be bought or rented.',
      'Partner banks, developers and other organisations named on the site.',
      'Email addresses ending in .example, which cannot receive mail.',
    ],
    noAdviceHeading: 'No legal, tax, loan or investment advice',
    relationship: 'Nothing on this site creates an advisory, brokerage or legal relationship.',
    sensitiveData: 'financial and identity information',
    dontRely: 'Do not rely on anything here for property, legal, tax or loan decisions.',
  },
};
