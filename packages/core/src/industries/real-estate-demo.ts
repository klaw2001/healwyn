import type { UrgencyLevel } from '../crm/types';
import {
  demoEmail,
  demoLeadId,
  demoPhone,
  demoStaffId,
  prng,
  uniqueName,
  type DemoLead,
  type DemoNote,
  type DemoStaffMember,
  type DemoTask,
  type Rng,
} from './demo-kit';

/**
 * Synthetic staff and forty synthetic leads for the real estate demo (pack
 * number 1). Every name, project and number is fictional. Leads are generated
 * deterministically, so the seed, the tests and a demo reset always produce the
 * same board. Phone numbers sit in the +91 70000 xxxxx demo range.
 */

const PACK_NUMBER = 1;
const staffId = (n: number) => demoStaffId(PACK_NUMBER, n);

export const realEstateDemoStaff: readonly DemoStaffMember[] = [
  {
    id: staffId(1),
    demoLogin: true,
    fullName: 'Kiran Deshpande',
    title: 'Senior advisor, apartments and villas',
    level: 'senior_advisor',
    role: 'specialist_doctor',
    specialties: ['apartments', 'villas'],
    languages: ['en', 'hi', 'kn', 'mr'],
    locations: ['banyan-square'],
    capacity: 18,
    listed: true,
    bio: 'Leads the Bengaluru apartments team and walks every site before showing it to anyone.',
  },
  {
    id: staffId(2),
    fullName: 'Farida Sheikh',
    title: 'Property advisor, apartments',
    level: 'property_advisor',
    role: 'specialist_doctor',
    specialties: ['apartments'],
    languages: ['en', 'hi', 'mr', 'ur'],
    locations: ['hillview'],
    capacity: 24,
    listed: true,
    bio: 'Plans site visits around school runs and office hours, and keeps every visit unhurried.',
  },
  {
    id: staffId(3),
    fullName: 'Vivek Narayan',
    title: 'Property advisor, villas and row houses',
    level: 'property_advisor',
    role: 'specialist_doctor',
    specialties: ['villas'],
    languages: ['en', 'hi', 'ta', 'kn'],
    locations: ['banyan-square', 'pearl-gate'],
    capacity: 22,
    listed: true,
    bio: 'Knows the villa communities in two cities and what daily life there is like.',
  },
  {
    id: staffId(4),
    fullName: 'Lavanya Reddy',
    title: 'Senior advisor, plots',
    level: 'senior_advisor',
    role: 'specialist_doctor',
    specialties: ['plots'],
    languages: ['en', 'hi', 'ur'],
    locations: ['pearl-gate'],
    capacity: 16,
    listed: true,
    bio: 'Leads the plots team and shares every layout document exactly as it is.',
  },
  {
    id: staffId(5),
    fullName: 'Joseph Mathew',
    title: 'Property advisor, resale homes',
    level: 'property_advisor',
    role: 'specialist_doctor',
    specialties: ['resale-homes'],
    languages: ['en', 'hi', 'ml'],
    locations: ['banyan-square', 'hillview'],
    capacity: 22,
    listed: true,
    bio: 'Arranges visits with owners and keeps buyers informed at every step.',
  },
  {
    id: staffId(6),
    fullName: 'Simran Gill',
    title: 'Property advisor, rentals',
    level: 'property_advisor',
    role: 'specialist_doctor',
    specialties: ['rentals'],
    languages: ['en', 'hi', 'pa'],
    locations: ['hillview', 'banyan-square'],
    capacity: 30,
    listed: true,
    bio: 'Helps people moving for work find a home to rent before they arrive.',
  },
  {
    id: staffId(7),
    fullName: 'Aditya Kamath',
    title: 'Property advisor, plots and villas',
    level: 'property_advisor',
    role: 'specialist_doctor',
    specialties: ['plots', 'villas'],
    languages: ['en', 'hi', 'kn'],
    locations: ['banyan-square', 'pearl-gate'],
    capacity: 20,
    listed: true,
    bio: 'Enjoys walking layouts with families who plan to build their own home one day.',
  },
  {
    id: staffId(8),
    fullName: 'Nandini Bose',
    title: 'Property advisor, home-loan paperwork',
    level: 'property_advisor',
    role: 'specialist_doctor',
    specialties: ['home-loan-paperwork'],
    languages: ['en', 'hi', 'bn'],
    locations: ['banyan-square', 'hillview', 'pearl-gate'],
    capacity: 28,
    listed: true,
    bio: 'Turns a long list of documents into a short, clear checklist. Never advises on loans.',
  },
  {
    id: staffId(9),
    demoLogin: true,
    fullName: 'Irfan Siddiqui',
    title: 'Relationship coordinator',
    level: 'relationship_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'ur', 'kn'],
    locations: ['banyan-square'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(10),
    fullName: 'Geeta Pawar',
    title: 'Relationship coordinator',
    level: 'relationship_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'mr'],
    locations: ['hillview'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(11),
    fullName: 'Mohan Krishnan',
    title: 'Relationship coordinator',
    level: 'relationship_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'ta'],
    locations: ['pearl-gate'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(12),
    demoLogin: true,
    fullName: 'Rekha Pillai',
    title: 'Home-loan and payments desk',
    level: 'loan_desk',
    role: 'billing_desk',
    specialties: [],
    languages: ['en', 'hi', 'ml'],
    locations: ['banyan-square', 'hillview', 'pearl-gate'],
    capacity: 35,
    listed: false,
  },
  {
    id: staffId(13),
    demoLogin: true,
    fullName: 'Sunil Bhatia',
    title: 'Sales manager',
    level: 'sales_manager',
    role: 'manager',
    specialties: [],
    languages: ['en', 'hi', 'pa'],
    locations: ['banyan-square', 'hillview', 'pearl-gate'],
    capacity: 1,
    listed: false,
  },
];

const MESSAGES = [
  'Looking for a 2BHK close to a metro line.',
  'Would like to see villas on a weekend.',
  'Need a home to rent before the school term starts.',
  'Would like to understand the paperwork for a home loan.',
  'Interested in plots in a planned layout.',
  'Prefer a resale flat that is ready to move into.',
  'Can we visit on a Sunday?',
  'Relocating for work later this year.',
];

const OFFERINGS = [
  'apartments',
  'villas',
  'plots',
  'resale-homes',
  'rentals',
  'home-loan-paperwork',
  'not-sure',
] as const;

/** How many demo leads sit in each stage (40 in total). */
const STAGE_COUNTS: readonly [string, number][] = [
  ['new', 8],
  ['ai_triaged', 6],
  ['site_visit_booked', 6],
  ['site_visit_missed', 3],
  ['site_visit_done', 6],
  ['negotiation', 5],
  ['token_paid', 3],
  ['lost', 3],
];

const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const coordinators = realEstateDemoStaff.filter((m) => m.role === 'care_coordinator').map((m) => m.id);

function advisorFor(offering: string, r: Rng): string {
  const team = realEstateDemoStaff.filter((m) => m.listed && m.specialties.includes(offering));
  return team.length ? r.pick(team).id : r.pick(coordinators);
}

function historyFor(stage: string, r: Rng): string[] {
  const viaTriage = r.chance(0.5) ? ['ai_triaged'] : [];
  switch (stage) {
    case 'new':
      return [];
    case 'ai_triaged':
      return ['ai_triaged'];
    case 'site_visit_booked':
      return [...viaTriage, 'site_visit_booked'];
    case 'site_visit_missed':
      return [...viaTriage, 'site_visit_booked', 'site_visit_missed'];
    case 'site_visit_done':
      return [...viaTriage, 'site_visit_booked', 'site_visit_done'];
    case 'negotiation':
      return ['site_visit_booked', 'site_visit_done', 'negotiation'];
    case 'token_paid':
      return ['site_visit_booked', 'site_visit_done', 'negotiation', 'token_paid'];
    case 'lost':
      return r.pick([['lost'], ['ai_triaged', 'lost'], ['site_visit_booked', 'site_visit_done', 'lost']]);
    default:
      return [stage];
  }
}

function taskTitle(stage: string): string | null {
  switch (stage) {
    case 'new':
    case 'ai_triaged':
      return 'Call back and book a site visit';
    case 'site_visit_missed':
      return 'Call to offer a new visit slot';
    case 'negotiation':
      return 'Share the paperwork checklist';
    default:
      return null;
  }
}

export function generateRealEstateDemoLeads(seed = 20261101): DemoLead[] {
  const r = prng(seed);
  const leads: DemoLead[] = [];
  const usedNames = new Set<string>();
  let n = 0;

  for (const [stage, count] of STAGE_COUNTS) {
    for (let i = 0; i < count; i += 1) {
      n += 1;
      const fullName = uniqueName(r, usedNames);

      const offering = r.pick(OFFERINGS);
      const urgency: UrgencyLevel = r.chance(0.06)
        ? 'urgent'
        : r.chance(0.2)
          ? 'high'
          : r.chance(0.15)
            ? 'low'
            : 'normal';
      // Renters rarely need a home loan; the paperwork desk's leads always do.
      const needsLoan = offering === 'home-loan-paperwork' ? true : offering === 'rentals' ? false : r.chance(0.55);
      const history = historyFor(stage, r);

      // New leads are recent (some are overdue on purpose); later stages are older.
      const createdMinutesAgo =
        stage === 'new'
          ? r.pick([20 * MINUTE, 75 * MINUTE, 4 * HOUR, 8 * HOUR, 18 * HOUR, 28 * HOUR, 2 * DAY, 3 * DAY])
          : r.int(2 * DAY, 40 * DAY);

      // New leads are often unassigned (the queue); later stages sit with the
      // advisor for that kind of home, or a coordinator when the lead is unsure.
      const assignedStaffId =
        stage === 'new'
          ? r.chance(0.5)
            ? null
            : r.pick(coordinators)
          : offering === 'not-sure'
            ? r.pick(coordinators)
            : advisorFor(offering, r);

      const respondedQuickly = r.int(15, 6 * HOUR);
      const firstResponseAfterMinutes =
        stage === 'new' ? (r.chance(0.4) ? Math.min(respondedQuickly, createdMinutesAgo - 5) : null) : respondedQuickly;

      const author = assignedStaffId ?? r.pick(coordinators);
      const firstNoteAt = firstResponseAfterMinutes ?? 30;
      const notes: DemoNote[] =
        stage === 'new' && firstResponseAfterMinutes === null
          ? []
          : [
              {
                templateId: r.pick(['call-no-answer', 'needs-callback', 'call-visit-booked']),
                afterMinutes: firstNoteAt,
                authorStaffId: author,
              },
              ...(needsLoan && r.chance(0.6)
                ? [
                    {
                      templateId: 'loan-paperwork-started',
                      // Never after "now": a brand-new lead's notes stay within its age.
                      afterMinutes: Math.min(firstNoteAt + 60, createdMinutesAgo - 1),
                      authorStaffId: author,
                    },
                  ]
                : []),
              ...(['site_visit_done', 'negotiation'].includes(stage) && r.chance(0.5)
                ? [{ templateId: 'visit-feedback', afterMinutes: firstNoteAt + 1 * DAY, authorStaffId: author }]
                : []),
            ];

      const tasks: DemoTask[] = [];
      const title = taskTitle(stage);
      if (title) {
        tasks.push({
          title,
          dueInMinutes: r.pick([-4 * HOUR, -27 * HOUR, 2 * HOUR, 6 * HOUR, 1 * DAY + 2 * HOUR, 3 * DAY]),
          completed: false,
          assigneeStaffId: author,
        });
      }
      if (stage === 'site_visit_booked') {
        tasks.push({
          title: 'Confirm the site visit the day before',
          dueInMinutes: r.int(1, 4) * DAY,
          completed: false,
          assigneeStaffId: author,
        });
      }
      if (stage === 'site_visit_done' && r.chance(0.5)) {
        tasks.push({
          title: 'Share the visit notes',
          dueInMinutes: -2 * DAY,
          completed: true,
          assigneeStaffId: author,
        });
      }

      const repliedAfterMinutes =
        ['ai_triaged', 'site_visit_booked', 'site_visit_done', 'negotiation'].includes(stage) && r.chance(0.3)
          ? r.int(2 * HOUR, 20 * HOUR)
          : null;

      leads.push({
        id: demoLeadId(PACK_NUMBER, n),
        fullName,
        phone: demoPhone(PACK_NUMBER, n),
        email: r.chance(0.6) ? demoEmail(fullName) : null,
        preferredLanguage: r.chance(0.3) ? 'hi' : 'en',
        stage,
        urgency,
        answers: {
          property_type: offering,
          preferred_time: r.pick(['morning', 'afternoon', 'evening', 'any']),
          move_timeline: r.pick(['within-3-months', '3-to-12-months', '3-to-12-months', 'just-exploring']),
          home_loan: needsLoan ? 'yes' : 'no',
        },
        message: r.chance(0.5) ? r.pick(MESSAGES) : null,
        assistantCallConsent: r.chance(0.6),
        assignedStaffId,
        stageHistory: history,
        createdMinutesAgo,
        firstResponseAfterMinutes,
        notes,
        tasks,
        optedOut: stage === 'site_visit_done' && i === 0,
        repliedAfterMinutes,
      });
    }
  }
  return leads;
}

export const realEstateDemoLeads: readonly DemoLead[] = generateRealEstateDemoLeads();
