import type { PackTheme, SiteCopy } from './types';

/**
 * The home interiors studio's public website copy. All of it is fictional demo content.
 * Rules: no structural, electrical, plumbing, gas or legal advice, no real prices, timelines
 * or warranties, no real people. Packages are illustrative scopes, never quotes.
 */

/** Terracotta and sage: warm clay for actions, a soft green accent. */
export const homeInteriorsTheme: PackTheme = {
  light: {
    primary: '#9a3f22',
    primaryHover: '#7c3219',
    primarySoft: '#f4ddd2',
    onPrimary: '#ffffff',
    accent: '#a7bd8f',
    accentSoft: '#e5eedb',
    accentInk: '#4a6130',
    onAccent: '#15302e',
    surfaceTint: '#f7ebe3',
    focus: '#9a3f22',
  },
  dark: {
    primary: '#ee9f81',
    primaryHover: '#f5b8a0',
    primarySoft: '#472a20',
    onPrimary: '#2a1109',
    accent: '#b7cd9e',
    accentSoft: '#2a3522',
    accentInk: '#c5d9ae',
    onAccent: '#172010',
    surfaceTint: '#2b1f1a',
    focus: '#f5b8a0',
  },
};

export const homeInteriorsSite: SiteCopy = {
  hero: 'room',
  nav: {
    services: 'Services',
    team: 'Designers',
    plans: 'Sample scopes',
    locations: 'Studios',
    partners: 'For partners',
  },
  ctaLabel: 'Talk to a designer',
  home: {
    eyebrow: 'Home interiors studios in Bengaluru, Chennai and Hyderabad',
    intro:
      'Tell us about your home in your own words. We listen, then match you with the designer best placed to help, at a time that suits you.',
    assistantNote:
      'The assistant is an AI, not a person. It asks a few short questions and never gives structural, electrical or pricing advice.',
    highlights: ['English and Hindi', 'Home visits for measurements', 'Three studios'],
    howItWorks: {
      title: 'From your first message to the right designer, in three steps',
      intro: 'No sales scripts, no repeating yourself. One short conversation, then a designer who can actually help.',
      steps: [
        {
          title: 'Tell us about your home',
          body: 'Fill in a short form or talk to our assistant. Two minutes, no design jargon.',
        },
        {
          title: 'We understand, then match',
          body: 'We look at the rooms you want to change, your language and your timing, and match you with the right designer.',
        },
        {
          title: 'Your designer calls you back',
          body: 'A design coordinator gets in touch at the time you chose and sets up a design consultation.',
        },
      ],
    },
    services: {
      eyebrow: 'Services',
      title: 'Six ways we can help at home',
      intro: 'Designers who work on kitchens, storage, whole homes and single rooms, as one team.',
    },
    partnersStrip: 'Working with builders, architects and makers',
    trust: {
      eyebrow: 'Our promise',
      title: 'Design that starts with listening',
      intro: 'Technology helps us route your enquiry quickly. People, and only people, design your home with you.',
      points: [
        {
          title: 'Your details, your choice',
          body: 'We ask for only what we need, record what you agreed to, and delete your details if you withdraw consent.',
        },
        {
          title: 'Safety checks by qualified people',
          body: 'Our assistant never says a wall can go or that wiring is fine. A qualified engineer or electrician checks every safety concern.',
        },
        {
          title: 'Clear at every step',
          body: 'You will always know who is contacting you, why, and what happens next. Scopes and costs come from your designer, in writing.',
        },
      ],
    },
    cta: {
      title: 'Not sure where to start? That is exactly what we are here for.',
      body: 'Tell us a little about your home and a design coordinator will take it from there.',
    },
  },
  services: {
    eyebrow: 'Services',
    title: 'The right designer for every room',
    intro:
      'Six services, one studio team. Tell us what you would like to change and we will match you with the right designer, or simply choose below.',
    description:
      'Modular kitchens, wardrobes and storage, full-home interiors, living and dining rooms, bedrooms and kids’ rooms, and renovation and repairs.',
    reasonsHeading: 'Why people get in touch',
    firstStepsHeading: 'Your design consultation',
    memberNoun: ['designer', 'designers'],
    notSure: {
      title: 'Not sure which service you need?',
      body: 'Choose “I’m not sure” on the form and a design coordinator will help.',
    },
    details: [
      {
        slug: 'modular-kitchens',
        icon: 'kitchen',
        tagline: 'A kitchen that fits the way you cook.',
        intro:
          'Our kitchen designers start with how your family cooks, stores and cleans up, then plan cabinets, counters and storage around it.',
        reasons: [
          'An old kitchen that no longer works for the family',
          'A new home with an empty kitchen shell',
          'Too little storage or counter space',
          'Planning a kitchen before moving in',
        ],
        firstSteps: [
          'A design coordinator confirms your consultation and what to have ready, such as photos or a floor plan.',
          'Your designer visits, measures the kitchen and asks how you use it.',
          'You receive a layout and an illustrative scope to think over in your own time.',
        ],
      },
      {
        slug: 'wardrobes-storage',
        icon: 'ruler',
        tagline: 'Room for everything, made to measure.',
        intro:
          'From bedroom wardrobes to shoe racks and loft storage, our designers plan storage that uses every useful centimetre without crowding the room.',
        reasons: [
          'Wardrobes for a new home',
          'Storage that has run out as the family grew',
          'Making a small room feel less cluttered',
          'Shoe, linen or utility storage',
        ],
        firstSteps: [
          'Your designer asks what needs storing and who uses each space.',
          'They measure the walls and corners you would like to use.',
          'You receive a storage plan with options for finishes.',
        ],
      },
      {
        slug: 'full-home-interiors',
        icon: 'lamp',
        tagline: 'One designer, every room, one plan.',
        intro:
          'For a new or newly bought home, one lead designer plans every room together, so the home feels finished and consistent from the day you move in.',
        reasons: [
          'Moving into a new home and starting from bare walls',
          'Wanting one consistent style across every room',
          'Not having time to coordinate many different people',
          'Planning around a move-in date',
        ],
        firstSteps: [
          'Your lead designer walks through the home with you, room by room.',
          'They measure every room and note what you would like to keep.',
          'You receive a whole-home plan, room by room, with an illustrative scope.',
        ],
      },
      {
        slug: 'living-dining',
        icon: 'sofa',
        tagline: 'Rooms for everyday life and for guests.',
        intro:
          'Our designers plan living and dining rooms that work on an ordinary weekday and on a festival evening full of family.',
        reasons: [
          'A living room that feels cramped or dark',
          'A TV wall, display or storage unit',
          'A dining space for a growing family',
          'Lighting and soft furnishings to tie a room together',
        ],
        firstSteps: [
          'Your designer asks how the room is used through the day.',
          'They measure the room and note light, doors and windows.',
          'You receive a layout and a mood board to react to.',
        ],
      },
      {
        slug: 'bedrooms-kids-rooms',
        icon: 'bed',
        tagline: 'Calm bedrooms and rooms that grow with children.',
        intro:
          'From a quiet main bedroom to a kids’ room with space to study and play, our designers plan rooms that are easy to live in and easy to change later.',
        reasons: [
          'A calmer, less cluttered bedroom',
          'A kids’ room with a study corner',
          'A room for a family member moving in',
          'Planning a room that can change as children grow',
        ],
        firstSteps: [
          'Your designer asks who uses the room and how.',
          'They measure the room, including windows and doors.',
          'You receive a layout and options for furniture and finishes.',
        ],
      },
      {
        slug: 'renovation-repairs',
        icon: 'paint',
        tagline: 'Fresh finishes, coordinated with care.',
        intro:
          'Our renovation team handles cosmetic work such as painting, panelling and new finishes. Anything structural, electrical, plumbing or gas related is checked and carried out by qualified contractors we coordinate with.',
        reasons: [
          'Repainting and refreshing tired rooms',
          'New flooring, panelling or ceiling finishes',
          'Updating a home before a family event',
          'Coordinating several trades in one plan',
        ],
        firstSteps: [
          'Your designer visits and notes what you would like to refresh.',
          'Anything that needs a safety check is passed to a qualified engineer or electrician first.',
          'You receive an illustrative scope for the cosmetic work.',
        ],
      },
    ],
  },
  team: {
    eyebrow: 'Designers',
    title: 'People who take the time to listen',
    intro: 'Every designer below works as part of one studio team, so you are never handed from stranger to stranger.',
    description: 'Meet the (fictional) designers across our six services.',
    notice: {
      title: 'These are fictional profiles',
      body: 'Names, roles and portraits are invented for this demo. Any resemblance to real people is coincidental.',
    },
    offeringLabel: 'Service',
    locationsLabel: 'Studios',
  },
  plans: {
    eyebrow: 'Sample scopes',
    title: 'Illustrative scopes, planned around your home',
    intro: 'Each scope shows what a project of that kind usually covers. Your designer shapes the real one with you.',
    description: 'Four illustrative design scopes. Demo content: no prices or timelines are promised.',
    notice: {
      title: 'Illustrative scopes',
      body: 'These scopes are examples for this demo. No real prices, timelines or warranties are shown, and paying for one only runs a test payment. Your designer agrees the real scope with you in writing.',
    },
    items: [
      {
        id: 'kitchen-refresh',
        name: 'Kitchen refresh',
        forWhom: 'Families who want a kitchen that works better, without a full remodel.',
        includes: [
          'A home visit and kitchen measurements',
          'A new layout with 3D views',
          'A material and finish board to choose from',
        ],
        duration: 'Usually a few design meetings',
        offeringSlug: 'modular-kitchens',
      },
      {
        id: 'wardrobe-makeover',
        name: 'Wardrobe makeover',
        forWhom: 'Anyone who has run out of storage in one or two bedrooms.',
        includes: ['Measurements of each wall', 'A storage plan for each wardrobe', 'Finish and handle options'],
        duration: 'Usually two design meetings',
        offeringSlug: 'wardrobes-storage',
      },
      {
        id: 'move-in-ready-2bhk',
        name: 'Move-in ready 2BHK',
        forWhom: 'New homeowners who want every room planned before they move in.',
        includes: [
          'A walk-through and measurements of every room',
          'A whole-home plan with 3D views',
          'One lead designer from first visit to handover',
        ],
        duration: 'Planned around your move-in date',
        offeringSlug: 'full-home-interiors',
      },
      {
        id: 'living-room-refresh',
        name: 'Living room refresh',
        forWhom: 'Families who want a brighter, calmer living room.',
        includes: ['A layout and lighting plan', 'A TV wall or storage design', 'A mood board for soft furnishings'],
        duration: 'Usually two or three design meetings',
        offeringSlug: 'living-dining',
      },
    ],
  },
  locations: {
    eyebrow: 'Studios',
    title: 'Three studios with a material library',
    intro: 'Touch the finishes before you choose them. Every studio has samples, a quiet meeting room and tea.',
    description: 'Three (fictional) design studios in Bengaluru, Chennai and Hyderabad.',
    notice: 'All three studios and their addresses are fictional. Please do not visit these addresses.',
    offeringsLabel: 'Services here',
    items: [
      {
        id: 'jacaranda',
        name: 'Jacaranda Studio',
        city: 'Bengaluru',
        addressLines: ['21 Jacaranda Arcade, Old Mill Road', 'Bengaluru 560000 (fictional address)'],
        hours: [
          { days: 'Tuesday to Sunday', time: '10:00am to 7:00pm' },
          { days: 'Monday', time: 'Closed' },
        ],
        offerings: [
          'modular-kitchens',
          'wardrobes-storage',
          'full-home-interiors',
          'living-dining',
          'bedrooms-kids-rooms',
          'renovation-repairs',
        ],
        access: [
          'Step-free entrance and lift',
          'Material library on the ground floor',
          'Parking for cars and two-wheelers',
        ],
      },
      {
        id: 'seabreeze',
        name: 'Seabreeze Studio',
        city: 'Chennai',
        addressLines: ['8 Coral Street, Seabreeze Colony', 'Chennai 600000 (fictional address)'],
        hours: [
          { days: 'Monday to Saturday', time: '10:00am to 7:00pm' },
          { days: 'Sunday', time: '10:00am to 2:00pm' },
        ],
        offerings: ['modular-kitchens', 'wardrobes-storage', 'living-dining', 'bedrooms-kids-rooms'],
        access: ['Step-free entrance', 'Quiet meeting room for families', 'Seating in the sample area'],
      },
      {
        id: 'pearl-gate',
        name: 'Pearl Gate Studio',
        city: 'Hyderabad',
        addressLines: ['17 Lotus Mews, Pearl Gate Road', 'Hyderabad 500000 (fictional address)'],
        hours: [
          { days: 'Monday to Saturday', time: '10:30am to 7:30pm' },
          { days: 'Sunday', time: 'By appointment' },
        ],
        offerings: ['modular-kitchens', 'wardrobes-storage', 'full-home-interiors', 'renovation-repairs'],
        access: ['Lift to the first-floor studio', 'Accessible toilet', 'Parking for two-wheelers'],
      },
    ],
  },
  partners: {
    eyebrow: 'For partners',
    title: 'Better homes are a team effort',
    intro:
      'We work with builders, architects, suppliers and skilled contractors to give homeowners one clear plan and fewer surprises.',
    description: 'Builders and developers, architects and engineers, material suppliers and contractors.',
    audiences: [
      {
        type: 'builder-developer',
        title: 'Builders and developers',
        summary: 'Interior options for buyers at handover, planned with your project team.',
        offers: [
          'A single design coordinator for your buyers',
          'Sample-flat design support',
          'Clear handover of measurements and plans',
        ],
      },
      {
        type: 'architect-engineer',
        title: 'Architects and engineers',
        summary: 'Interior design that respects your plans and your safety checks.',
        offers: [
          'Shared drawings with the owner’s consent',
          'Structural and services questions sent to you first',
          'One point of contact for the interiors',
        ],
      },
      {
        type: 'material-supplier',
        title: 'Material and furniture suppliers',
        summary: 'Show your finishes in our material libraries.',
        offers: ['Sample space in our studios', 'Clear specifications from our designers', 'Agreed delivery schedules'],
      },
      {
        type: 'contractor',
        title: 'Contractors and craftspeople',
        summary: 'Work with our designers on carpentry, painting and finishing.',
        offers: [
          'Clear drawings and scopes',
          'Fair, planned schedules',
          'Qualified trades for electrical, plumbing and gas work',
        ],
      },
    ],
    wordmarks: [
      'Teakline Builders',
      'Ochre and Oak Supplies',
      'Bluebell Tile Works',
      'Northlight Architects',
      'Vellum Lighting',
    ],
    formIntro:
      'Tell us a little about your organisation. Our partnerships team replies by email, usually within two working days.',
    notPartner: { title: 'Home enquiries', individual: 'a homeowner or tenant' },
  },
  contact: {
    eyebrow: 'Contact and book',
    title: 'Tell us about your home',
    intro: 'Two minutes, in your own words. We will match you with the right designer and get back to you.',
    description: 'Tell us about your home and we will match you with the right designer.',
    steps: [
      {
        title: 'We read your enquiry',
        body: 'A design coordinator looks at the rooms you want to change, your language and your timing.',
      },
      { title: 'We match you', body: 'Your enquiry goes to the designer best placed to help.' },
      {
        title: 'We get in touch',
        body: 'Someone from the studio contacts you in the time window you chose to book a design consultation.',
      },
    ],
    assistantBody: 'Our AI assistant asks the same questions by voice, in English or Hindi. Or fill in the form below.',
  },
  assistantIntro:
    'asks five short questions so the right designer can call you back. It cannot give structural, electrical, legal or pricing advice.',
  privacy: {
    about: 'a fictional home interiors brand used to demonstrate a design enquiry platform',
    contactPurpose: 'We use your details to respond to your enquiry and to match you with the right designer.',
    assistantPurpose:
      'Our AI assistant may call you between 9am and 9pm India time to understand your needs before a person picks up your enquiry. It always says it is an AI assistant, and it never gives structural, electrical, legal or pricing advice.',
    sensitiveExamples: 'ID numbers, bank details, property documents or door codes',
    retention:
      'We keep enquiry details for up to 12 months after our last contact with you, then delete them, unless you become a client and the law requires us to keep project and payment records for longer.',
  },
  legal: {
    note: 'This page is written for a fictional home interiors studio so the demo is complete. It is not legal advice.',
    platform: 'a home interiors enquiry platform',
    fictionalThings: 'studio, designer, scope or service',
    fictionalList: [
      'The brand, its studios, addresses and opening hours.',
      'Every designer and staff profile. Portraits are illustrations, not photos of real people.',
      'Design scopes and their test payments: no real prices, timelines or warranties, and nothing can actually be bought.',
      'Partner organisations named on the site.',
      'Email addresses ending in .example, which cannot receive mail.',
    ],
    noAdviceHeading: 'No structural, electrical or legal advice',
    relationship: 'Nothing on this site creates a contract for design or building work.',
    sensitiveData: 'details about your home and finances',
    dontRely: 'Do not rely on anything here for safety, building or legal decisions.',
  },
};
