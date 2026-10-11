import type { UrgencyLevel } from '../crm/types';
import { clinicDemoStaff } from './clinic-demo-data';
import {
  demoEmail,
  demoLeadId,
  demoPhone,
  prng,
  uniqueName,
  type DemoLead,
  type DemoNote,
  type DemoTask,
  type Rng,
} from './demo-kit';

/**
 * Forty synthetic leads for the clinic demo, generated deterministically so the
 * seed, the tests and Phase 4's demo reset always produce the same board.
 * Phone numbers sit in the +91 70000 xxxxx demo range; nothing is real.
 */

const MESSAGES = [
  'Would like a routine check-up.',
  'Looking for a dental cleaning appointment.',
  'Want a desk-work posture routine.',
  'Interested in the everyday health check package.',
  'Would like a skin check before travelling.',
  'Follow-up on my annual check-up from last year.',
  'Prefer a woman doctor if possible.',
  'Can I come in on a Saturday?',
];
const SPECIALTIES = [
  'general-medicine',
  'dermatology',
  'dental',
  'physiotherapy',
  'womens-health',
  'diagnostics',
  'not-sure',
] as const;

/** How many demo leads sit in each stage (40 in total). */
const STAGE_COUNTS: readonly [string, number][] = [
  ['new', 8],
  ['ai_triaged', 6],
  ['appointment_booked', 6],
  ['no_show', 2],
  ['visited', 5],
  ['follow_up_due', 5],
  ['package_active', 4],
  ['lost', 4],
];

const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const coordinators = clinicDemoStaff.filter((m) => m.role === 'care_coordinator').map((m) => m.id);

function clinicianFor(specialty: string, r: Rng): string {
  const team = clinicDemoStaff.filter((m) => m.listed && m.specialties.includes(specialty));
  return team.length ? r.pick(team).id : r.pick(coordinators);
}

function historyFor(stage: string, r: Rng): string[] {
  const viaTriage = r.chance(0.5) ? ['ai_triaged'] : [];
  switch (stage) {
    case 'new':
      return [];
    case 'ai_triaged':
      return ['ai_triaged'];
    case 'appointment_booked':
      return [...viaTriage, 'appointment_booked'];
    case 'no_show':
      return [...viaTriage, 'appointment_booked', 'no_show'];
    case 'visited':
      return [...viaTriage, 'appointment_booked', 'visited'];
    case 'follow_up_due':
      return ['appointment_booked', 'visited', 'follow_up_due'];
    case 'package_active':
      return ['appointment_booked', 'visited', 'package_active'];
    case 'lost':
      return r.chance(0.5) ? ['ai_triaged', 'lost'] : ['lost'];
    default:
      return [stage];
  }
}

export function generateClinicDemoLeads(seed = 20261011): DemoLead[] {
  const r = prng(seed);
  const leads: DemoLead[] = [];
  const usedNames = new Set<string>();
  let n = 0;

  for (const [stage, count] of STAGE_COUNTS) {
    for (let i = 0; i < count; i += 1) {
      n += 1;
      const fullName = uniqueName(r, usedNames);

      const specialty = r.pick(SPECIALTIES);
      const urgency: UrgencyLevel = r.chance(0.08)
        ? 'urgent'
        : r.chance(0.2)
          ? 'high'
          : r.chance(0.15)
            ? 'low'
            : 'normal';
      const hasInsurance = r.chance(0.45);
      const history = historyFor(stage, r);

      // New leads are recent (some are overdue on purpose); later stages are older.
      const createdMinutesAgo =
        stage === 'new'
          ? r.pick([25 * MINUTE, 90 * MINUTE, 5 * HOUR, 7 * HOUR, 20 * HOUR, 30 * HOUR, 2 * DAY, 3 * DAY])
          : r.int(2 * DAY, 30 * DAY);

      // Who has the lead: new leads are often unassigned (the queue); later
      // stages sit with the specialty's clinician, or a coordinator if unsure.
      const assignedStaffId =
        stage === 'new'
          ? r.chance(0.5)
            ? null
            : r.pick(coordinators)
          : specialty === 'not-sure'
            ? r.pick(coordinators)
            : clinicianFor(specialty, r);

      const respondedQuickly = r.int(15, 6 * HOUR);
      const firstResponseAfterMinutes =
        stage === 'new' ? (r.chance(0.4) ? Math.min(respondedQuickly, createdMinutesAgo - 5) : null) : respondedQuickly;

      const author = assignedStaffId ?? r.pick(coordinators);
      const notes: DemoNote[] =
        stage === 'new' && firstResponseAfterMinutes === null
          ? []
          : [
              {
                templateId: r.pick(['call-no-answer', 'needs-callback', 'call-booked']),
                afterMinutes: firstResponseAfterMinutes ?? 30,
                authorStaffId: author,
              },
              ...(hasInsurance && r.chance(0.6)
                ? [
                    {
                      templateId: 'insurance-check',
                      afterMinutes: (firstResponseAfterMinutes ?? 30) + 60,
                      authorStaffId: author,
                    },
                  ]
                : []),
            ];

      const tasks: DemoTask[] = [];
      if (['new', 'ai_triaged', 'follow_up_due', 'no_show'].includes(stage)) {
        tasks.push({
          title:
            stage === 'follow_up_due'
              ? 'Call to book the follow-up'
              : stage === 'no_show'
                ? 'Call to offer a new slot'
                : 'Call back and book a first visit',
          dueInMinutes: r.pick([-3 * HOUR, -26 * HOUR, 2 * HOUR, 5 * HOUR, 1 * DAY + 3 * HOUR, 3 * DAY]),
          completed: false,
          assigneeStaffId: author,
        });
      }
      if (stage === 'appointment_booked') {
        tasks.push({
          title: 'Confirm the appointment the day before',
          dueInMinutes: r.int(1, 4) * DAY,
          completed: false,
          assigneeStaffId: author,
        });
      }
      if (stage === 'visited' && r.chance(0.5)) {
        tasks.push({
          title: 'Share the visit summary',
          dueInMinutes: -2 * DAY,
          completed: true,
          assigneeStaffId: author,
        });
      }

      const repliedAfterMinutes =
        ['ai_triaged', 'appointment_booked', 'visited'].includes(stage) && r.chance(0.3)
          ? r.int(2 * HOUR, 20 * HOUR)
          : null;

      leads.push({
        id: demoLeadId(0, n),
        fullName,
        phone: demoPhone(0, n),
        email: r.chance(0.6) ? demoEmail(fullName) : null,
        preferredLanguage: r.chance(0.3) ? 'hi' : 'en',
        stage,
        urgency,
        answers: {
          concern_category: specialty,
          preferred_time: r.pick(['morning', 'afternoon', 'evening', 'any']),
          visit_type: r.chance(0.3) ? 'follow-up' : 'first',
          has_insurance: hasInsurance ? 'yes' : 'no',
        },
        message: r.chance(0.5) ? r.pick(MESSAGES) : null,
        assistantCallConsent: r.chance(0.6),
        assignedStaffId,
        stageHistory: history,
        createdMinutesAgo,
        firstResponseAfterMinutes,
        notes,
        tasks,
        optedOut: stage === 'visited' && i === 0,
        repliedAfterMinutes,
      });
    }
  }
  return leads;
}

export const clinicDemoLeads: readonly DemoLead[] = generateClinicDemoLeads();
