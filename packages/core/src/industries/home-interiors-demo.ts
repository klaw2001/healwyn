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
 * Synthetic staff and forty synthetic leads for the home interiors demo (pack 3).
 * Every name is fictional; leads are generated deterministically so the seed, the
 * tests and the demo reset always produce the same board. Phone numbers sit in the
 * pack's +91 70000 demo block; nothing is real.
 */

const PACK = 3;
const staffId = (n: number) => demoStaffId(PACK, n);

export const homeInteriorsDemoStaff: readonly DemoStaffMember[] = [
  {
    id: staffId(1),
    demoLogin: true,
    fullName: 'Ritu Menon',
    title: 'Senior designer, full-home interiors',
    level: 'senior_designer',
    role: 'specialist_doctor',
    specialties: ['full-home-interiors', 'living-dining'],
    languages: ['en', 'hi', 'ml'],
    locations: ['jacaranda'],
    capacity: 14,
    listed: true,
    bio: 'Leads whole-home projects and makes sure every room feels part of one plan.',
  },
  {
    id: staffId(2),
    fullName: 'Nandini Shetty',
    title: 'Senior designer, kitchens and storage',
    level: 'senior_designer',
    role: 'specialist_doctor',
    specialties: ['modular-kitchens', 'wardrobes-storage'],
    languages: ['en', 'hi', 'kn'],
    locations: ['jacaranda', 'pearl-gate'],
    capacity: 14,
    listed: true,
    bio: 'Starts every kitchen by asking who cooks, when and for how many.',
  },
  {
    id: staffId(3),
    fullName: 'Arvind Krishnan',
    title: 'Interior designer, modular kitchens',
    level: 'interior_designer',
    role: 'specialist_doctor',
    specialties: ['modular-kitchens'],
    languages: ['en', 'ta', 'hi'],
    locations: ['seabreeze'],
    capacity: 20,
    listed: true,
    bio: 'Known for compact kitchens that never feel small.',
  },
  {
    id: staffId(4),
    fullName: 'Imran Siddiqui',
    title: 'Interior designer, wardrobes and storage',
    level: 'interior_designer',
    role: 'specialist_doctor',
    specialties: ['wardrobes-storage'],
    languages: ['en', 'hi', 'ur'],
    locations: ['pearl-gate'],
    capacity: 22,
    listed: true,
    bio: 'Finds storage in corners nobody else noticed.',
  },
  {
    id: staffId(5),
    fullName: 'Lavanya Iyer',
    title: 'Interior designer, living and dining',
    level: 'interior_designer',
    role: 'specialist_doctor',
    specialties: ['living-dining'],
    languages: ['en', 'ta'],
    locations: ['seabreeze'],
    capacity: 20,
    listed: true,
    bio: 'Plans rooms around light, conversation and the evening routine.',
  },
  {
    id: staffId(6),
    fullName: 'Rohit Bhatia',
    title: 'Interior designer, bedrooms and kids’ rooms',
    level: 'interior_designer',
    role: 'specialist_doctor',
    specialties: ['bedrooms-kids-rooms'],
    languages: ['en', 'hi', 'pa'],
    locations: ['jacaranda', 'seabreeze'],
    capacity: 22,
    listed: true,
    bio: 'Designs rooms that can change as children grow.',
  },
  {
    id: staffId(7),
    fullName: 'Swati Deshmukh',
    title: 'Senior designer, renovation and repairs',
    level: 'senior_designer',
    role: 'specialist_doctor',
    specialties: ['renovation-repairs', 'full-home-interiors'],
    languages: ['en', 'hi', 'mr'],
    locations: ['pearl-gate', 'jacaranda'],
    capacity: 14,
    listed: true,
    bio: 'Coordinates refresh projects and brings in qualified contractors for anything beyond the cosmetic.',
  },
  {
    id: staffId(8),
    fullName: 'Faisal Ahmed',
    title: 'Interior designer, renovation and repairs',
    level: 'interior_designer',
    role: 'specialist_doctor',
    specialties: ['renovation-repairs'],
    languages: ['en', 'hi', 'ur'],
    locations: ['pearl-gate'],
    capacity: 20,
    listed: true,
    bio: 'Turns tired rooms around with paint, panelling and careful planning.',
  },
  {
    id: staffId(9),
    demoLogin: true,
    fullName: 'Pooja Nair',
    title: 'Design coordinator',
    level: 'design_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'ml'],
    locations: ['jacaranda'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(10),
    fullName: 'Janani Subramanian',
    title: 'Design coordinator',
    level: 'design_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'ta'],
    locations: ['seabreeze'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(11),
    fullName: 'Sandeep Reddy',
    title: 'Design coordinator',
    level: 'design_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi'],
    locations: ['pearl-gate'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(12),
    demoLogin: true,
    fullName: 'Gopal Varma',
    title: 'Accounts desk',
    level: 'accounts_desk',
    role: 'billing_desk',
    specialties: [],
    languages: ['en', 'hi', 'kn'],
    locations: ['jacaranda', 'seabreeze', 'pearl-gate'],
    capacity: 35,
    listed: false,
  },
  {
    id: staffId(13),
    demoLogin: true,
    fullName: 'Shalini Mathur',
    title: 'Studio manager',
    level: 'studio_manager',
    role: 'manager',
    specialties: [],
    languages: ['en', 'hi'],
    locations: ['jacaranda', 'seabreeze', 'pearl-gate'],
    capacity: 1,
    listed: false,
  },
];

const MESSAGES = [
  'Our kitchen is ten years old and the cabinets no longer close properly.',
  'Need wardrobes for two bedrooms in a new flat.',
  'Moving into a 2BHK soon and would like it ready before then.',
  'Would like a calmer living room with better lighting.',
  'A study corner in our daughter’s room, please.',
  'Some cosmetic touch-ups and repainting before a family wedding.',
  'Can the designer visit on a Sunday?',
  'We like warm wood and simple lines.',
];

const PROJECTS = [
  'modular-kitchens',
  'wardrobes-storage',
  'full-home-interiors',
  'living-dining',
  'bedrooms-kids-rooms',
  'renovation-repairs',
  'not-sure',
] as const;

/** How many demo leads sit in each stage (40 in total). */
const STAGE_COUNTS: readonly [string, number][] = [
  ['new', 8],
  ['ai_triaged', 6],
  ['consultation_booked', 6],
  ['consultation_missed', 2],
  ['site_measured', 5],
  ['design_shared', 5],
  ['design_confirmed', 4],
  ['lost', 4],
];

const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const coordinators = homeInteriorsDemoStaff.filter((m) => m.role === 'care_coordinator').map((m) => m.id);

function designerFor(project: string, r: Rng): string {
  const team = homeInteriorsDemoStaff.filter((m) => m.listed && m.specialties.includes(project));
  return team.length ? r.pick(team).id : r.pick(coordinators);
}

function historyFor(stage: string, r: Rng): string[] {
  const viaTriage = r.chance(0.5) ? ['ai_triaged'] : [];
  switch (stage) {
    case 'new':
      return [];
    case 'ai_triaged':
      return ['ai_triaged'];
    case 'consultation_booked':
      return [...viaTriage, 'consultation_booked'];
    case 'consultation_missed':
      return [...viaTriage, 'consultation_booked', 'consultation_missed'];
    case 'site_measured':
      return [...viaTriage, 'consultation_booked', 'site_measured'];
    case 'design_shared':
      return ['consultation_booked', 'site_measured', 'design_shared'];
    case 'design_confirmed':
      return ['consultation_booked', 'site_measured', 'design_shared', 'design_confirmed'];
    case 'lost':
      return r.chance(0.5) ? ['ai_triaged', 'lost'] : ['consultation_booked', 'site_measured', 'lost'];
    default:
      return [stage];
  }
}

function taskFor(stage: string, r: Rng, assignee: string): DemoTask[] {
  const overdueOrSoon = () => r.pick([-3 * HOUR, -26 * HOUR, 2 * HOUR, 5 * HOUR, 1 * DAY + 3 * HOUR, 3 * DAY]);
  switch (stage) {
    case 'new':
    case 'ai_triaged':
      return [
        {
          title: 'Call back and book a design consultation',
          dueInMinutes: overdueOrSoon(),
          completed: false,
          assigneeStaffId: assignee,
        },
      ];
    case 'consultation_booked':
      return [
        {
          title: 'Confirm the consultation the day before',
          dueInMinutes: r.int(1, 4) * DAY,
          completed: false,
          assigneeStaffId: assignee,
        },
      ];
    case 'consultation_missed':
      return [
        {
          title: 'Call to offer a new consultation slot',
          dueInMinutes: overdueOrSoon(),
          completed: false,
          assigneeStaffId: assignee,
        },
      ];
    case 'site_measured':
      return r.chance(0.5)
        ? [
            {
              title: 'Share the measurement summary',
              dueInMinutes: -2 * DAY,
              completed: true,
              assigneeStaffId: assignee,
            },
          ]
        : [
            {
              title: 'Prepare the first design',
              dueInMinutes: overdueOrSoon(),
              completed: false,
              assigneeStaffId: assignee,
            },
          ];
    case 'design_shared':
      return [
        {
          title: 'Call to talk through the shared design',
          dueInMinutes: overdueOrSoon(),
          completed: false,
          assigneeStaffId: assignee,
        },
      ];
    default:
      return [];
  }
}

export function generateHomeInteriorsDemoLeads(seed = 20261013): DemoLead[] {
  const r = prng(seed);
  const leads: DemoLead[] = [];
  const usedNames = new Set<string>();
  let n = 0;

  for (const [stage, count] of STAGE_COUNTS) {
    for (let i = 0; i < count; i += 1) {
      n += 1;
      const fullName = uniqueName(r, usedNames);

      const project = r.pick(PROJECTS);
      const urgency: UrgencyLevel = r.chance(0.06)
        ? 'urgent'
        : r.chance(0.2)
          ? 'high'
          : r.chance(0.15)
            ? 'low'
            : 'normal';
      const instalments = r.chance(0.4);
      const history = historyFor(stage, r);

      // New leads are recent (some are overdue on purpose); later stages are older.
      const createdMinutesAgo =
        stage === 'new'
          ? r.pick([20 * MINUTE, 80 * MINUTE, 4 * HOUR, 8 * HOUR, 22 * HOUR, 30 * HOUR, 2 * DAY, 3 * DAY])
          : r.int(2 * DAY, 45 * DAY);

      // New leads are often unassigned (the queue); later stages sit with the
      // project's designer, or with a design coordinator when the caller is unsure.
      const assignedStaffId =
        stage === 'new'
          ? r.chance(0.5)
            ? null
            : r.pick(coordinators)
          : project === 'not-sure'
            ? r.pick(coordinators)
            : designerFor(project, r);

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
                templateId: r.pick(['call-no-answer', 'needs-callback', 'call-booked']),
                afterMinutes: firstNoteAt,
                authorStaffId: author,
              },
              ...(instalments && r.chance(0.6)
                ? [{ templateId: 'instalments-check', afterMinutes: firstNoteAt + 60, authorStaffId: author }]
                : []),
              ...(stage === 'consultation_booked' && r.chance(0.5)
                ? [{ templateId: 'photos-requested', afterMinutes: firstNoteAt + 90, authorStaffId: author }]
                : []),
            ];

      const repliedAfterMinutes =
        ['ai_triaged', 'consultation_booked', 'site_measured', 'design_shared'].includes(stage) && r.chance(0.3)
          ? r.int(2 * HOUR, 20 * HOUR)
          : null;

      leads.push({
        id: demoLeadId(PACK, n),
        fullName,
        phone: demoPhone(PACK, n),
        email: r.chance(0.6) ? demoEmail(fullName) : null,
        preferredLanguage: r.chance(0.3) ? 'hi' : 'en',
        stage,
        urgency,
        answers: {
          project_type: project,
          preferred_time: r.pick(['morning', 'afternoon', 'evening', 'any']),
          home_stage: r.pick(['under-construction', 'new-keys', 'new-keys', 'lived-in']),
          pay_in_instalments: instalments ? 'yes' : 'no',
        },
        message: r.chance(0.5) ? r.pick(MESSAGES) : null,
        assistantCallConsent: r.chance(0.6),
        assignedStaffId,
        stageHistory: history,
        createdMinutesAgo,
        firstResponseAfterMinutes,
        notes,
        tasks: taskFor(stage, r, author),
        optedOut: stage === 'site_measured' && i === 0,
        repliedAfterMinutes,
      });
    }
  }
  return leads;
}

export const homeInteriorsDemoLeads: readonly DemoLead[] = generateHomeInteriorsDemoLeads();
