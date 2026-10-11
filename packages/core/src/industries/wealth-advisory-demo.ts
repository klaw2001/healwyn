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
 * Synthetic staff and forty synthetic leads for the wealth advisory demo (pack
 * number 2). Every name is fictional and nobody holds a real registration. Leads
 * are generated deterministically so the seed, the tests and the demo reset always
 * produce the same board. Phone numbers sit in the pack's +91 70000 demo block.
 */

const PACK_NUMBER = 2;
const staffId = (n: number) => demoStaffId(PACK_NUMBER, n);

export const wealthAdvisoryDemoStaff: readonly DemoStaffMember[] = [
  {
    id: staffId(1),
    demoLogin: true,
    fullName: 'Vandana Raghavan',
    title: 'Senior advisor, retirement planning',
    level: 'senior_advisor',
    role: 'specialist_doctor',
    specialties: ['retirement-planning', 'financial-planning'],
    languages: ['en', 'hi', 'ta'],
    locations: ['harbourside', 'jacaranda-court'],
    capacity: 18,
    listed: true,
    bio: 'Leads the retirement team and makes sure every client leaves knowing what happens next.',
  },
  {
    id: staffId(2),
    fullName: 'Imran Siddiqui',
    title: 'Senior advisor, will and estate planning',
    level: 'senior_advisor',
    role: 'specialist_doctor',
    specialties: ['estate-planning', 'tax-planning-help'],
    languages: ['en', 'hi', 'ur'],
    locations: ['neem-square'],
    capacity: 16,
    listed: true,
    bio: 'Works closely with partner lawyers so families can put their wishes in writing calmly.',
  },
  {
    id: staffId(3),
    fullName: 'Leela Fernandes',
    title: 'Advisor, children’s education planning',
    level: 'associate_advisor',
    role: 'specialist_doctor',
    specialties: ['education-planning', 'financial-planning'],
    languages: ['en', 'hi', 'mr'],
    locations: ['harbourside'],
    capacity: 24,
    listed: true,
    bio: 'Helps families plan for school, college and study abroad alongside everything else.',
  },
  {
    id: staffId(4),
    fullName: 'Harpreet Gill',
    title: 'Advisor, insurance cover reviews',
    level: 'associate_advisor',
    role: 'specialist_doctor',
    specialties: ['insurance-review'],
    languages: ['en', 'hi', 'pa'],
    locations: ['neem-square', 'harbourside'],
    capacity: 24,
    listed: true,
    bio: 'Reads the small print with you and explains each policy in plain words.',
  },
  {
    id: staffId(5),
    fullName: 'Suresh Natarajan',
    title: 'Advisor, tax-planning help',
    level: 'associate_advisor',
    role: 'specialist_doctor',
    specialties: ['tax-planning-help'],
    languages: ['en', 'ta', 'kn'],
    locations: ['jacaranda-court'],
    capacity: 22,
    listed: true,
    bio: 'Gets documents in order and keeps your chartered accountant in the loop.',
  },
  {
    id: staffId(6),
    fullName: 'Ayesha Qadri',
    title: 'Advisor, financial planning and families abroad',
    level: 'associate_advisor',
    role: 'specialist_doctor',
    specialties: ['financial-planning'],
    languages: ['en', 'hi', 'ur'],
    locations: ['harbourside'],
    capacity: 24,
    listed: true,
    bio: 'Meets many clients by video, especially families living outside India.',
  },
  {
    id: staffId(7),
    fullName: 'Prakash Menon',
    title: 'Senior advisor, insurance and retirement',
    level: 'senior_advisor',
    role: 'specialist_doctor',
    specialties: ['insurance-review', 'retirement-planning'],
    languages: ['en', 'hi', 'ml'],
    locations: ['jacaranda-court'],
    capacity: 16,
    listed: true,
    bio: 'Known for unhurried meetings and clear written summaries.',
  },
  {
    id: staffId(8),
    demoLogin: true,
    fullName: 'Tanya Bose',
    title: 'Client coordinator',
    level: 'client_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'bn'],
    locations: ['harbourside'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(9),
    fullName: 'Gitanjali Sen',
    title: 'Client coordinator',
    level: 'client_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'kn'],
    locations: ['jacaranda-court'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(10),
    fullName: 'Simran Arora',
    title: 'Client coordinator',
    level: 'client_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'pa'],
    locations: ['neem-square'],
    capacity: 40,
    listed: false,
  },
  {
    id: staffId(11),
    demoLogin: true,
    fullName: 'Firoz Bhatia',
    title: 'Operations desk',
    level: 'operations_desk',
    role: 'billing_desk',
    specialties: [],
    languages: ['en', 'hi', 'gu'],
    locations: ['harbourside', 'jacaranda-court', 'neem-square'],
    capacity: 35,
    listed: false,
  },
  {
    id: staffId(12),
    demoLogin: true,
    fullName: 'Rukmini Sethuraman',
    title: 'Practice head',
    level: 'practice_head',
    role: 'manager',
    specialties: [],
    languages: ['en', 'hi', 'ta'],
    locations: ['harbourside', 'jacaranda-court', 'neem-square'],
    capacity: 1,
    listed: false,
  },
];

const MESSAGES = [
  'Would like a retirement plan review.',
  'Planning for our daughter’s college in a few years.',
  'Want to understand what our insurance policies cover.',
  'Need help organising tax paperwork for this year.',
  'Living abroad, would prefer a video meeting.',
  'Would like to write a will with my spouse.',
  'Have a few old policies and investments to organise.',
  'Can we meet on a Saturday?',
];
const GOALS = [
  'financial-planning',
  'retirement-planning',
  'education-planning',
  'insurance-review',
  'tax-planning-help',
  'estate-planning',
  'not-sure',
] as const;

/** How many demo leads sit in each stage (40 in total). */
const STAGE_COUNTS: readonly [string, number][] = [
  ['new', 8],
  ['ai_triaged', 6],
  ['meeting_booked', 6],
  ['meeting_missed', 2],
  ['meeting_held', 5],
  ['plan_shared', 5],
  ['plan_started', 4],
  ['lost', 4],
];

const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const coordinators = wealthAdvisoryDemoStaff.filter((m) => m.role === 'care_coordinator').map((m) => m.id);
const operationsDesk = wealthAdvisoryDemoStaff.filter((m) => m.role === 'billing_desk').map((m) => m.id);

function advisorFor(goal: string, r: Rng): string {
  const team = wealthAdvisoryDemoStaff.filter((m) => m.listed && m.specialties.includes(goal));
  return team.length ? r.pick(team).id : r.pick(coordinators);
}

function historyFor(stage: string, r: Rng): string[] {
  const viaTriage = r.chance(0.5) ? ['ai_triaged'] : [];
  switch (stage) {
    case 'new':
      return [];
    case 'ai_triaged':
      return ['ai_triaged'];
    case 'meeting_booked':
      return [...viaTriage, 'meeting_booked'];
    case 'meeting_missed':
      return [...viaTriage, 'meeting_booked', 'meeting_missed'];
    case 'meeting_held':
      return [...viaTriage, 'meeting_booked', 'meeting_held'];
    case 'plan_shared':
      return [...viaTriage, 'meeting_booked', 'meeting_held', 'plan_shared'];
    case 'plan_started':
      return ['meeting_booked', 'meeting_held', 'plan_shared', 'plan_started'];
    case 'lost':
      return r.chance(0.5) ? ['ai_triaged', 'lost'] : ['meeting_booked', 'meeting_held', 'lost'];
    default:
      return [stage];
  }
}

function taskFor(stage: string): string | null {
  switch (stage) {
    case 'new':
    case 'ai_triaged':
      return 'Call back and book a first meeting';
    case 'meeting_missed':
      return 'Call to offer a new meeting time';
    case 'plan_shared':
      return 'Check whether the plan outline raised any questions';
    default:
      return null;
  }
}

export function generateWealthAdvisoryDemoLeads(seed = 20261012): DemoLead[] {
  const r = prng(seed);
  const leads: DemoLead[] = [];
  const usedNames = new Set<string>();
  let n = 0;

  for (const [stage, count] of STAGE_COUNTS) {
    for (let i = 0; i < count; i += 1) {
      n += 1;
      const fullName = uniqueName(r, usedNames);

      const goal = r.pick(GOALS);
      const urgency: UrgencyLevel = r.chance(0.05)
        ? 'urgent'
        : r.chance(0.2)
          ? 'high'
          : r.chance(0.2)
            ? 'low'
            : 'normal';
      const wantsTransferHelp = r.chance(0.4);
      const history = historyFor(stage, r);

      // New leads are recent (some are overdue on purpose); later stages are older.
      const createdMinutesAgo =
        stage === 'new'
          ? r.pick([20 * MINUTE, 75 * MINUTE, 4 * HOUR, 9 * HOUR, 22 * HOUR, 30 * HOUR, 2 * DAY, 4 * DAY])
          : r.int(2 * DAY, 45 * DAY);

      // New leads are often unassigned (the queue); later stages sit with the
      // matched advisor, or with a coordinator when the client was unsure.
      const assignedStaffId =
        stage === 'new'
          ? i < 4
            ? null
            : r.pick(coordinators)
          : goal === 'not-sure'
            ? r.pick(coordinators)
            : advisorFor(goal, r);

      const respondedAfter = r.int(15, 6 * HOUR);
      const firstResponseAfterMinutes =
        stage === 'new' ? (r.chance(0.4) ? Math.min(respondedAfter, createdMinutesAgo - 5) : null) : respondedAfter;

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
              ...(wantsTransferHelp && r.chance(0.7)
                ? [{ templateId: 'paperwork-check', afterMinutes: firstNoteAt + 90, authorStaffId: operationsDesk[0]! }]
                : []),
              ...(['plan_shared', 'plan_started'].includes(stage)
                ? [{ templateId: 'outline-sent', afterMinutes: firstNoteAt + 3 * DAY, authorStaffId: author }]
                : []),
            ];

      const tasks: DemoTask[] = [];
      const followUp = taskFor(stage);
      if (followUp) {
        tasks.push({
          title: followUp,
          dueInMinutes: r.pick([-4 * HOUR, -28 * HOUR, 2 * HOUR, 6 * HOUR, 1 * DAY + 2 * HOUR, 3 * DAY]),
          completed: false,
          assigneeStaffId: author,
        });
      }
      if (stage === 'meeting_booked') {
        tasks.push({
          title: 'Confirm the meeting the day before',
          dueInMinutes: r.int(1, 5) * DAY,
          completed: false,
          assigneeStaffId: author,
        });
      }
      if (stage === 'meeting_held' && r.chance(0.6)) {
        tasks.push({
          title: 'Send the meeting notes',
          dueInMinutes: -2 * DAY,
          completed: true,
          assigneeStaffId: author,
        });
      }
      if (wantsTransferHelp && ['meeting_booked', 'meeting_held', 'plan_shared'].includes(stage)) {
        tasks.push({
          title: 'Share the document checklist for existing holdings',
          dueInMinutes: r.pick([-1 * DAY, 1 * DAY, 2 * DAY]),
          completed: false,
          assigneeStaffId: operationsDesk[0]!,
        });
      }

      const repliedAfterMinutes =
        ['ai_triaged', 'meeting_booked', 'meeting_held', 'plan_shared'].includes(stage) && r.chance(0.35)
          ? r.int(2 * HOUR, 30 * HOUR)
          : null;

      leads.push({
        id: demoLeadId(PACK_NUMBER, n),
        fullName,
        phone: demoPhone(PACK_NUMBER, n),
        email: r.chance(0.7) ? demoEmail(fullName) : null,
        preferredLanguage: r.chance(0.3) ? 'hi' : 'en',
        stage,
        urgency,
        answers: {
          goal_area: goal,
          preferred_time: r.pick(['morning', 'afternoon', 'evening', 'any']),
          meeting_mode: r.pick(['office', 'video', 'either']),
          transfer_help: wantsTransferHelp ? 'yes' : 'no',
        },
        message: r.chance(0.5) ? r.pick(MESSAGES) : null,
        assistantCallConsent: r.chance(0.6),
        assignedStaffId,
        stageHistory: history,
        createdMinutesAgo,
        firstResponseAfterMinutes,
        notes,
        tasks,
        optedOut: stage === 'meeting_held' && i === 0,
        repliedAfterMinutes,
      });
    }
  }
  return leads;
}

export const wealthAdvisoryDemoLeads: readonly DemoLead[] = generateWealthAdvisoryDemoLeads();
