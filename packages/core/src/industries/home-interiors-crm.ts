import type { CrmConfig, SequenceDefinition } from '../crm/types';

const HOUR = 60;
const DAY = 24 * HOUR;

/** Nurture sequences for the home interiors pack (steps, enrolment stage, stop stages). */
export const homeInteriorsSequences = [
  {
    id: 'new-lead-welcome',
    name: 'New lead welcome',
    description: 'Confirms the enquiry was received and explains what happens next.',
    enrolOnStage: 'new',
    cancelOnStages: ['consultation_booked', 'site_measured', 'design_shared', 'design_confirmed', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'welcome-email' },
      { delayMinutes: 5, channel: 'whatsapp', templateId: 'welcome-whatsapp' },
      { delayMinutes: 2 * DAY, channel: 'email', templateId: 'welcome-nudge-email' },
    ],
  },
  {
    id: 'consultation-reminder',
    name: 'Consultation reminder',
    description: 'Confirms a booked design consultation and reminds the client the day before.',
    enrolOnStage: 'consultation_booked',
    cancelOnStages: ['consultation_missed', 'site_measured', 'design_shared', 'design_confirmed', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'consultation-confirmed-email' },
      { delayMinutes: 1 * DAY, channel: 'sms', templateId: 'consultation-reminder-sms' },
    ],
  },
  {
    id: 'missed-consultation',
    name: 'Missed consultation',
    description: 'Offers a new slot when a booked design consultation was missed.',
    enrolOnStage: 'consultation_missed',
    cancelOnStages: ['consultation_booked', 'site_measured', 'design_confirmed', 'lost'],
    steps: [
      { delayMinutes: 2 * HOUR, channel: 'sms', templateId: 'missed-sms' },
      { delayMinutes: 1 * DAY, channel: 'email', templateId: 'missed-email' },
    ],
  },
  {
    id: 'after-measurement',
    name: 'After the site visit',
    description: 'Thanks the client for the visit and says when to expect the design.',
    enrolOnStage: 'site_measured',
    cancelOnStages: ['design_shared', 'design_confirmed', 'lost'],
    steps: [
      { delayMinutes: 1 * DAY, channel: 'whatsapp', templateId: 'after-visit-whatsapp' },
      { delayMinutes: 4 * DAY, channel: 'email', templateId: 'after-visit-email' },
    ],
  },
  {
    id: 'design-review',
    name: 'Design review',
    description: 'Checks in while the client reviews a shared design.',
    enrolOnStage: 'design_shared',
    cancelOnStages: ['design_confirmed', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'design-shared-email' },
      { delayMinutes: 3 * DAY, channel: 'sms', templateId: 'design-review-sms' },
      { delayMinutes: 7 * DAY, channel: 'email', templateId: 'design-last-email' },
    ],
  },
  {
    id: 'settling-in',
    name: 'Settling in',
    description: 'Welcomes a confirmed client and checks in once the rooms are lived in.',
    enrolOnStage: 'design_confirmed',
    cancelOnStages: ['lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'design-confirmed-email' },
      { delayMinutes: 180 * DAY, channel: 'whatsapp', templateId: 'settling-in-whatsapp' },
    ],
  },
] as const satisfies readonly SequenceDefinition[];

/**
 * Templates, note templates, SLA targets and scoring for the home interiors pack.
 * Email is sent for real (Resend); SMS and WhatsApp are simulated. Templates never
 * contain structural, electrical or legal advice, and never promise prices, timelines
 * or warranties.
 */
export const homeInteriorsCrm = {
  templates: [
    {
      id: 'welcome-email',
      channel: 'email',
      subject: 'We have your enquiry (ref {reference})',
      body: 'Hello {firstName},\n\nThank you for contacting {brand}. We have your enquiry about {specialty} and a design coordinator is matching you with the right designer.\n\nSomeone from the studio will contact you in the time window you chose to set up a design consultation. If you have photos of the rooms or a floor plan, it helps to have them ready. If anything changes, simply reply to this email.\n\nIf you smell gas, see sparks or smoke, or water is near the wiring at home, leave the area and call 112.',
    },
    {
      id: 'welcome-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, this is {brand}. We have your enquiry (ref {reference}) and will call you at the time you chose.',
    },
    {
      id: 'welcome-nudge-email',
      channel: 'email',
      subject: 'Still planning your home?',
      body: 'Hello {firstName},\n\nWe tried to reach you about your enquiry (ref {reference}). If you would still like help with {specialty}, reply with a time that suits you and we will call.\n\nIf you no longer need us, no reply is needed.',
    },
    {
      id: 'consultation-confirmed-email',
      channel: 'email',
      subject: 'Your design consultation is booked',
      body: 'Hello {firstName},\n\nYour {specialty} design consultation is booked. Your designer will look at the space and take measurements, so it helps if someone can let them in to every room you would like to change. Photos of things you like are always welcome.\n\nNeed to change the time? Reply to this email.',
    },
    {
      id: 'consultation-reminder-sms',
      channel: 'sms',
      body: '{brand}: a reminder of your design consultation tomorrow. Reply R to reschedule.',
    },
    {
      id: 'missed-sms',
      channel: 'sms',
      body: '{brand}: we missed you at your design consultation today. Reply YES and we will offer a new time.',
    },
    {
      id: 'missed-email',
      channel: 'email',
      subject: 'Shall we find another time?',
      body: 'Hello {firstName},\n\nWe missed you at your design consultation. Plans change, and that is fine. Reply to this email and we will find a new time that suits you.',
    },
    {
      id: 'after-visit-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, thank you for having us over. Your {brand} designer is working on your design. Reply here with any photos or ideas you would like to add.',
    },
    {
      id: 'after-visit-email',
      channel: 'email',
      subject: 'Your design is on its way',
      body: 'Hello {firstName},\n\nThank you for showing us your home. Your designer is preparing the design and will share it with you to review. If you think of anything you would like to add, reply and we will pass it on.',
    },
    {
      id: 'design-shared-email',
      channel: 'email',
      subject: 'Your design is ready to review',
      body: 'Hello {firstName},\n\nYour designer has shared your {specialty} design and an illustrative scope. Take your time. If you would like changes or want to talk it through, reply and we will set up a call.',
    },
    {
      id: 'design-review-sms',
      channel: 'sms',
      body: '{brand}: any thoughts on your design? Reply CALL and your designer will ring you.',
    },
    {
      id: 'design-last-email',
      channel: 'email',
      subject: 'A last note about your design',
      body: 'Hello {firstName},\n\nThis is our last reminder about the design your designer shared. Reply whenever you are ready, whether you would like changes or would like to go ahead.',
    },
    {
      id: 'design-confirmed-email',
      channel: 'email',
      subject: 'Thank you for confirming your design',
      body: 'Hello {firstName},\n\nThank you for confirming your {specialty} design with {brand}. Your designer will be in touch with the next steps and the written scope. If you have questions at any point, reply to this email.',
    },
    {
      id: 'settling-in-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, how are you finding your new rooms? If something needs a look, reply VISIT and the {brand} studio will call you.',
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
      label: 'Called, consultation booked',
      body: 'Spoke with the client. Design consultation booked. Reminder sequence will follow.',
    },
    {
      id: 'instalments-check',
      label: 'Instalment options requested',
      body: 'Client would like to pay in instalments. Accounts desk to explain the options before the consultation.',
    },
    {
      id: 'needs-callback',
      label: 'Asked for a call back',
      body: 'Client asked to be called back at a different time.',
    },
    {
      id: 'photos-requested',
      label: 'Asked for photos and a floor plan',
      body: 'Asked the client to share photos of the rooms and a floor plan, if they have one, before the visit.',
    },
  ],

  sla: {
    firstResponseMinutes: { urgent: 1 * HOUR, high: 4 * HOUR, normal: 1 * DAY, low: 2 * DAY },
  },

  scoring: [
    { id: 'offering', label: 'Knows which service they need', points: 15, when: { kind: 'offeringChosen' } },
    {
      id: 'keys-in-hand',
      label: 'Has just got the keys',
      points: 10,
      when: { kind: 'answer', questionId: 'home_stage', equals: 'new-keys' },
    },
    {
      id: 'instalments',
      label: 'Asked about instalments',
      points: 5,
      when: { kind: 'answer', questionId: 'pay_in_instalments', equals: 'yes' },
    },
    { id: 'email', label: 'Gave an email address', points: 5, when: { kind: 'hasEmail' } },
    { id: 'details', label: 'Described the project', points: 5, when: { kind: 'hasMessage' } },
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
      label: 'Booked, measured or reviewing a design',
      points: 20,
      when: { kind: 'stage', in: ['consultation_booked', 'site_measured', 'design_shared', 'design_confirmed'] },
    },
    { id: 'won', label: 'Design confirmed', points: 10, when: { kind: 'stage', in: ['design_confirmed'] } },
    { id: 'lost', label: 'Marked as lost', points: -60, when: { kind: 'stage', in: ['lost'] } },
    { id: 'opted-out', label: 'Unsubscribed from messages', points: -30, when: { kind: 'optedOut' } },
  ],
} as const satisfies Omit<CrmConfig, 'sequences'>;
