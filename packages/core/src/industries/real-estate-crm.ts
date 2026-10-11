import type { CrmConfig, SequenceDefinition } from '../crm/types';

const HOUR = 60;
const DAY = 24 * HOUR;

/** Nurture sequences for the real estate pack (steps, enrolment stage, stop stages). */
export const realEstateSequences = [
  {
    id: 'new-lead-welcome',
    name: 'New lead welcome',
    description: 'Confirms the enquiry was received and explains what happens next.',
    enrolOnStage: 'new',
    cancelOnStages: ['site_visit_booked', 'site_visit_done', 'negotiation', 'token_paid', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'welcome-email' },
      { delayMinutes: 5, channel: 'whatsapp', templateId: 'welcome-whatsapp' },
      { delayMinutes: 2 * DAY, channel: 'email', templateId: 'welcome-nudge-email' },
    ],
  },
  {
    id: 'site-visit-reminder',
    name: 'Site visit reminder',
    description: 'Confirms a booked site visit and reminds the client the day before.',
    enrolOnStage: 'site_visit_booked',
    cancelOnStages: ['site_visit_done', 'site_visit_missed', 'negotiation', 'token_paid', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'visit-confirmed-email' },
      { delayMinutes: 1 * DAY, channel: 'sms', templateId: 'visit-reminder-sms' },
    ],
  },
  {
    id: 'missed-visit-recovery',
    name: 'Missed visit recovery',
    description: 'Offers a new slot when a booked site visit was missed.',
    enrolOnStage: 'site_visit_missed',
    cancelOnStages: ['site_visit_booked', 'site_visit_done', 'negotiation', 'token_paid', 'lost'],
    steps: [
      { delayMinutes: 2 * HOUR, channel: 'sms', templateId: 'missed-visit-sms' },
      { delayMinutes: 1 * DAY, channel: 'email', templateId: 'missed-visit-email' },
    ],
  },
  {
    id: 'post-visit-check-in',
    name: 'Post-visit check-in',
    description: 'Asks how the site visit went and whether anything is unclear.',
    enrolOnStage: 'site_visit_done',
    cancelOnStages: ['negotiation', 'token_paid', 'lost'],
    steps: [
      { delayMinutes: 1 * DAY, channel: 'whatsapp', templateId: 'post-visit-whatsapp' },
      { delayMinutes: 3 * DAY, channel: 'email', templateId: 'post-visit-email' },
    ],
  },
  {
    id: 'in-discussion-follow-up',
    name: 'In discussion follow-up',
    description: 'Keeps in touch while the client weighs up a home, without any pressure.',
    enrolOnStage: 'negotiation',
    cancelOnStages: ['site_visit_booked', 'token_paid', 'lost'],
    steps: [
      { delayMinutes: 2 * DAY, channel: 'email', templateId: 'discussion-email' },
      { delayMinutes: 5 * DAY, channel: 'sms', templateId: 'discussion-sms' },
      { delayMinutes: 10 * DAY, channel: 'email', templateId: 'discussion-last-email' },
    ],
  },
  {
    id: 'token-next-steps',
    name: 'Token next steps',
    description: 'Thanks the client for the token and explains the paperwork that follows.',
    enrolOnStage: 'token_paid',
    cancelOnStages: ['lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'token-received-email' },
      { delayMinutes: 2 * DAY, channel: 'whatsapp', templateId: 'paperwork-whatsapp' },
    ],
  },
] as const satisfies readonly SequenceDefinition[];

/**
 * Templates, note templates, SLA targets and scoring for the real estate pack.
 * Email is sent for real (Resend); SMS and WhatsApp are simulated. Templates
 * never predict prices or returns, never comment on a title, approval or
 * possession date, and never say how much loan someone could get.
 */
export const realEstateCrm = {
  templates: [
    {
      id: 'welcome-email',
      channel: 'email',
      subject: 'We have your enquiry (ref {reference})',
      body: 'Hello {firstName},\n\nThank you for contacting {brand}. We have your enquiry and a relationship coordinator is matching you with the property advisor who knows that kind of home best.\n\nSomeone from the team will contact you in the time window you chose. If anything changes, simply reply to this email.\n\nIf you ever feel unsafe at a property or a building site, leave and call 112.',
    },
    {
      id: 'welcome-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, this is {brand}. We have your enquiry (ref {reference}) and will call you at the time you chose.',
    },
    {
      id: 'welcome-nudge-email',
      channel: 'email',
      subject: 'Still looking for the right home?',
      body: 'Hello {firstName},\n\nWe tried to reach you about your enquiry (ref {reference}). If you would still like help, reply with a time that suits you and we will call.\n\nIf you no longer need us, no reply is needed.',
    },
    {
      id: 'visit-confirmed-email',
      channel: 'email',
      subject: 'Your site visit is booked',
      body: 'Hello {firstName},\n\nYour site visit is booked. Your advisor will meet you at the experience centre or on site, as agreed. Please wear comfortable shoes, and you are welcome to bring family or a friend.\n\nNeed to change the time? Reply to this email.',
    },
    {
      id: 'visit-reminder-sms',
      channel: 'sms',
      body: '{brand}: a reminder of your site visit tomorrow. Reply R to reschedule.',
    },
    {
      id: 'missed-visit-sms',
      channel: 'sms',
      body: '{brand}: we missed you at today’s site visit. Reply YES and we will offer a new time.',
    },
    {
      id: 'missed-visit-email',
      channel: 'email',
      subject: 'Shall we find another time?',
      body: 'Hello {firstName},\n\nWe missed you at your site visit. Plans change, and that is fine. Reply to this email and we will find a new time that suits you.',
    },
    {
      id: 'post-visit-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, thank you for visiting with {brand}. If anything you saw is unclear, reply here and your advisor will help.',
    },
    {
      id: 'post-visit-email',
      channel: 'email',
      subject: 'How was your site visit?',
      body: 'Hello {firstName},\n\nThank you for visiting with {brand}. If you would like to see another home, or have questions about what you saw, reply and your advisor will get back to you.',
    },
    {
      id: 'discussion-email',
      channel: 'email',
      subject: 'Anything we can help with?',
      body: 'Hello {firstName},\n\nTake all the time you need. If you would like another visit, the project documents to share with your own lawyer, or a call with your advisor, just reply to this email.',
    },
    {
      id: 'discussion-sms',
      channel: 'sms',
      body: '{brand}: your advisor is here when you are ready. Reply CALL and we will ring you.',
    },
    {
      id: 'discussion-last-email',
      channel: 'email',
      subject: 'A last note from your advisor',
      body: 'Hello {firstName},\n\nThis is our last note for now. If you would like to pick things up again, reply whenever you are ready and your advisor will call you.',
    },
    {
      id: 'token-received-email',
      channel: 'email',
      subject: 'Thank you, we have your token',
      body: 'Hello {firstName},\n\nThank you. We have received your token (ref {reference}). Your advisor will share a paperwork checklist and the project documents next. Please have every document checked by your own lawyer before you sign anything.\n\nQuestions? Reply to this email.',
    },
    {
      id: 'paperwork-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, your {brand} advisor has shared the paperwork checklist by email. Reply HELP if anything is unclear.',
    },
  ],

  noteTemplates: [
    {
      id: 'call-no-answer',
      label: 'Called, no answer',
      body: 'Called at the preferred time. No answer. Will try again tomorrow.',
    },
    {
      id: 'call-visit-booked',
      label: 'Called, site visit booked',
      body: 'Spoke with the client. Site visit booked. Reminder sequence will follow.',
    },
    {
      id: 'loan-paperwork-started',
      label: 'Loan paperwork started',
      body: 'Client will need a home loan. Home-loan desk to share the partner-bank document checklist. No loan advice given.',
    },
    {
      id: 'needs-callback',
      label: 'Asked for a call back',
      body: 'Client asked to be called back at a different time.',
    },
    {
      id: 'visit-feedback',
      label: 'Site visit feedback',
      body: 'Spoke after the site visit. Client would like to see one more option before deciding.',
    },
  ],

  sla: {
    firstResponseMinutes: { urgent: 1 * HOUR, high: 4 * HOUR, normal: 1 * DAY, low: 2 * DAY },
  },

  scoring: [
    { id: 'offering', label: 'Knows what kind of home they want', points: 15, when: { kind: 'offeringChosen' } },
    {
      id: 'moving-soon',
      label: 'Hoping to move within 3 months',
      points: 15,
      when: { kind: 'answer', questionId: 'move_timeline', equals: 'within-3-months' },
    },
    {
      id: 'needs-loan',
      label: 'Will need a home loan',
      points: 5,
      when: { kind: 'answer', questionId: 'home_loan', equals: 'yes' },
    },
    {
      id: 'exploring',
      label: 'Just exploring',
      points: -5,
      when: { kind: 'answer', questionId: 'move_timeline', equals: 'just-exploring' },
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
      label: 'Booked or visited a site',
      points: 20,
      when: { kind: 'stage', in: ['site_visit_booked', 'site_visit_done', 'negotiation', 'token_paid'] },
    },
    { id: 'won', label: 'Token paid', points: 10, when: { kind: 'stage', in: ['token_paid'] } },
    { id: 'lost', label: 'Marked as lost', points: -60, when: { kind: 'stage', in: ['lost'] } },
    { id: 'opted-out', label: 'Unsubscribed from messages', points: -30, when: { kind: 'optedOut' } },
  ],
} as const satisfies Omit<CrmConfig, 'sequences'>;
