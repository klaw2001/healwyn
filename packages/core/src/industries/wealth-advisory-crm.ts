import type { CrmConfig, SequenceDefinition } from '../crm/types';

const HOUR = 60;
const DAY = 24 * HOUR;

/** Nurture sequences for the wealth advisory pack (steps, enrolment stage, stop stages). */
export const wealthAdvisorySequences = [
  {
    id: 'new-lead-welcome',
    name: 'New lead welcome',
    description: 'Confirms the enquiry was received, explains what happens next and that we never ask for codes.',
    enrolOnStage: 'new',
    cancelOnStages: ['meeting_booked', 'meeting_held', 'plan_shared', 'plan_started', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'welcome-email' },
      { delayMinutes: 5, channel: 'whatsapp', templateId: 'welcome-whatsapp' },
      { delayMinutes: 2 * DAY, channel: 'email', templateId: 'welcome-nudge-email' },
    ],
  },
  {
    id: 'meeting-reminder',
    name: 'Meeting reminder',
    description: 'Confirms a booked advisory meeting and reminds the client the day before.',
    enrolOnStage: 'meeting_booked',
    cancelOnStages: ['meeting_held', 'meeting_missed', 'plan_shared', 'plan_started', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'meeting-confirmed-email' },
      { delayMinutes: 1 * DAY, channel: 'sms', templateId: 'meeting-reminder-sms' },
    ],
  },
  {
    id: 'missed-meeting-recovery',
    name: 'Missed meeting recovery',
    description: 'Offers a new time when a booked meeting was missed.',
    enrolOnStage: 'meeting_missed',
    cancelOnStages: ['meeting_booked', 'meeting_held', 'lost'],
    steps: [
      { delayMinutes: 2 * HOUR, channel: 'sms', templateId: 'missed-meeting-sms' },
      { delayMinutes: 1 * DAY, channel: 'email', templateId: 'missed-meeting-email' },
    ],
  },
  {
    id: 'after-first-meeting',
    name: 'After the first meeting',
    description: 'Thanks the client and asks whether anything from the meeting is unclear.',
    enrolOnStage: 'meeting_held',
    cancelOnStages: ['plan_started', 'lost'],
    steps: [
      { delayMinutes: 1 * DAY, channel: 'whatsapp', templateId: 'after-meeting-whatsapp' },
      { delayMinutes: 3 * DAY, channel: 'email', templateId: 'after-meeting-email' },
    ],
  },
  {
    id: 'plan-decision',
    name: 'Plan outline follow-up',
    description: 'Gives the client time to read the shared plan outline and offers to answer questions. Never pushes.',
    enrolOnStage: 'plan_shared',
    cancelOnStages: ['meeting_booked', 'plan_started', 'lost'],
    steps: [
      { delayMinutes: 3 * DAY, channel: 'email', templateId: 'plan-questions-email' },
      { delayMinutes: 7 * DAY, channel: 'sms', templateId: 'plan-questions-sms' },
      { delayMinutes: 14 * DAY, channel: 'email', templateId: 'plan-last-email' },
    ],
  },
  {
    id: 'annual-review',
    name: 'Annual review',
    description: 'Invites the client to a yearly review of their plan.',
    enrolOnStage: 'plan_started',
    cancelOnStages: ['lost'],
    steps: [
      { delayMinutes: 330 * DAY, channel: 'email', templateId: 'review-email' },
      { delayMinutes: 350 * DAY, channel: 'whatsapp', templateId: 'review-whatsapp' },
    ],
  },
] as const satisfies readonly SequenceDefinition[];

/**
 * Templates, note templates, SLA targets and scoring for the wealth advisory pack.
 * Email is sent for real (Resend); SMS and WhatsApp are simulated. Templates never
 * name, rate or recommend a product, never mention returns, and remind clients that
 * nobody from the firm asks for an OTP, PIN or password.
 */
export const wealthAdvisoryCrm = {
  templates: [
    {
      id: 'welcome-email',
      channel: 'email',
      subject: 'We have your enquiry (ref {reference})',
      body: 'Hello {firstName},\n\nThank you for contacting {brand}. We have your enquiry about {specialty} and a client coordinator is matching you with the right advisor.\n\nSomeone from our team will contact you in the time window you chose. If anything changes, simply reply to this email.\n\nPlease remember: nobody from {brand} will ever ask for an OTP, PIN or password. If someone is pressing you to pay or share a code right now, stop and call 1930 or your bank.',
    },
    {
      id: 'welcome-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, this is {brand}. We have your enquiry (ref {reference}) and will call you at the time you chose. We will never ask for an OTP, PIN or password.',
    },
    {
      id: 'welcome-nudge-email',
      channel: 'email',
      subject: 'Still looking for the right advisor?',
      body: 'Hello {firstName},\n\nWe tried to reach you about your enquiry (ref {reference}). If you would still like help with {specialty}, reply with a time that suits you and we will call.\n\nIf you no longer need us, no reply is needed.',
    },
    {
      id: 'meeting-confirmed-email',
      channel: 'email',
      subject: 'Your advisory meeting is booked',
      body: 'Hello {firstName},\n\nYour {specialty} meeting is booked. If it helps, bring a list of what you already hold, such as policies or account statements. Please do not send passwords or full account numbers. You are welcome to bring someone with you.\n\nNeed to change the time? Reply to this email.',
    },
    {
      id: 'meeting-reminder-sms',
      channel: 'sms',
      body: '{brand}: a reminder of your advisory meeting tomorrow. Reply R to reschedule. We never ask for OTPs.',
    },
    {
      id: 'missed-meeting-sms',
      channel: 'sms',
      body: '{brand}: we missed you today. Reply YES and we will offer a new time.',
    },
    {
      id: 'missed-meeting-email',
      channel: 'email',
      subject: 'Shall we find another time?',
      body: 'Hello {firstName},\n\nWe missed you at your meeting. Things come up, and that is fine. Reply to this email and we will find a new time that suits you, in person or by video.',
    },
    {
      id: 'after-meeting-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, thank you for meeting {brand}. If anything from the meeting is unclear, reply here and we will help.',
    },
    {
      id: 'after-meeting-email',
      channel: 'email',
      subject: 'Thank you for meeting us',
      body: 'Hello {firstName},\n\nThank you for meeting {brand}. If you have questions about the next steps your advisor described, reply and a client coordinator will help. There is no rush to decide anything.',
    },
    {
      id: 'plan-questions-email',
      channel: 'email',
      subject: 'Any questions about your plan outline?',
      body: 'Hello {firstName},\n\nYour advisor shared an outline of what a {specialty} engagement would cover. Take the time you need to read it. If anything is unclear, reply and we will set up a short call.',
    },
    {
      id: 'plan-questions-sms',
      channel: 'sms',
      body: '{brand}: any questions about your plan outline? Reply CALL and we will ring you. No pressure to decide.',
    },
    {
      id: 'plan-last-email',
      channel: 'email',
      subject: 'A last note about your plan outline',
      body: 'Hello {firstName},\n\nThis is our last note about the plan outline your advisor shared. Reply whenever you are ready, or if you would like to talk it through again.',
    },
    {
      id: 'review-email',
      channel: 'email',
      subject: 'Time for your yearly review',
      body: 'Hello {firstName},\n\nIt has been almost a year since you started your plan with {brand}. Reply if you would like to book a review meeting with your advisor.',
    },
    {
      id: 'review-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, your yearly review with {brand} is coming up. Reply REVIEW and we will call you to book it.',
    },
  ],

  noteTemplates: [
    {
      id: 'call-no-answer',
      label: 'Called, no answer',
      body: 'Called at the preferred time. No answer. Will try again tomorrow.',
    },
    {
      id: 'call-booked',
      label: 'Called, meeting booked',
      body: 'Spoke with the client. Advisory meeting booked. Reminder sequence will follow.',
    },
    {
      id: 'paperwork-check',
      label: 'Paperwork check started',
      body: 'Client has existing investments or policies to organise. Operations desk to share a document checklist before the meeting.',
    },
    {
      id: 'needs-callback',
      label: 'Asked for a call back',
      body: 'Client asked to be called back at a different time.',
    },
    {
      id: 'outline-sent',
      label: 'Plan outline sent',
      body: 'Advisor sent the written outline of what the engagement covers. Client is reading it; no follow-up pressure.',
    },
  ],

  sla: {
    firstResponseMinutes: { urgent: 1 * HOUR, high: 4 * HOUR, normal: 1 * DAY, low: 2 * DAY },
  },

  scoring: [
    { id: 'offering', label: 'Knows which service they need', points: 15, when: { kind: 'offeringChosen' } },
    {
      id: 'holdings',
      label: 'Has investments or policies to organise',
      points: 10,
      when: { kind: 'answer', questionId: 'transfer_help', equals: 'yes' },
    },
    { id: 'email', label: 'Gave an email address', points: 5, when: { kind: 'hasEmail' } },
    { id: 'details', label: 'Described what they need', points: 5, when: { kind: 'hasMessage' } },
    {
      id: 'call-consent',
      label: 'Agreed to an assistant call',
      points: 10,
      when: { kind: 'consent', purpose: 'assistant_call' },
    },
    {
      id: 'fresh',
      label: 'Enquired in the last 24 hours',
      points: 15,
      when: { kind: 'createdWithinHours', hours: 24 },
    },
    { id: 'urgent', label: 'High or urgent need', points: 10, when: { kind: 'urgency', in: ['high', 'urgent'] } },
    { id: 'replied', label: 'Replied to a message', points: 20, when: { kind: 'replied' } },
    {
      id: 'progressing',
      label: 'Booked or met an advisor',
      points: 20,
      when: { kind: 'stage', in: ['meeting_booked', 'meeting_held', 'plan_shared', 'plan_started'] },
    },
    { id: 'outline', label: 'Has a plan outline', points: 10, when: { kind: 'stage', in: ['plan_shared'] } },
    { id: 'won', label: 'Plan started', points: 10, when: { kind: 'stage', in: ['plan_started'] } },
    { id: 'lost', label: 'Marked as lost', points: -60, when: { kind: 'stage', in: ['lost'] } },
    { id: 'opted-out', label: 'Unsubscribed from messages', points: -30, when: { kind: 'optedOut' } },
  ],
} as const satisfies Omit<CrmConfig, 'sequences'>;
