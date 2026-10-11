import type { CrmConfig, SequenceDefinition } from '../crm/types';

const HOUR = 60;
const DAY = 24 * HOUR;

/** Nurture sequences for the clinic pack (steps, enrolment stage, stop stages). */
export const clinicSequences = [
  {
    id: 'new-lead-welcome',
    name: 'New lead welcome',
    description: 'Confirms the enquiry was received and explains what happens next.',
    enrolOnStage: 'new',
    cancelOnStages: ['appointment_booked', 'visited', 'package_active', 'lost'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'welcome-email' },
      { delayMinutes: 5, channel: 'whatsapp', templateId: 'welcome-whatsapp' },
      { delayMinutes: 2 * DAY, channel: 'email', templateId: 'welcome-nudge-email' },
    ],
  },
  {
    id: 'appointment-reminder',
    name: 'Appointment reminder',
    description: 'Reminds the patient before a booked visit.',
    enrolOnStage: 'appointment_booked',
    cancelOnStages: ['visited', 'no_show', 'lost', 'follow_up_due', 'package_active'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'appointment-confirmed-email' },
      { delayMinutes: 1 * DAY, channel: 'sms', templateId: 'appointment-reminder-sms' },
    ],
  },
  {
    id: 'no-show-recovery',
    name: 'No-show recovery',
    description: 'Offers a new slot when a booked visit was missed.',
    enrolOnStage: 'no_show',
    cancelOnStages: ['appointment_booked', 'visited', 'lost'],
    steps: [
      { delayMinutes: 2 * HOUR, channel: 'sms', templateId: 'no-show-sms' },
      { delayMinutes: 1 * DAY, channel: 'email', templateId: 'no-show-email' },
    ],
  },
  {
    id: 'post-visit-check-in',
    name: 'Post-visit check-in',
    description: 'Asks how the visit went and whether anything is unclear.',
    enrolOnStage: 'visited',
    cancelOnStages: ['lost'],
    steps: [
      { delayMinutes: 1 * DAY, channel: 'whatsapp', templateId: 'post-visit-whatsapp' },
      { delayMinutes: 3 * DAY, channel: 'email', templateId: 'post-visit-email' },
    ],
  },
  {
    id: 'follow-up-due',
    name: 'Follow-up due',
    description: 'Nudges the patient to book the follow-up their doctor asked for.',
    enrolOnStage: 'follow_up_due',
    cancelOnStages: ['appointment_booked', 'lost', 'package_active'],
    steps: [
      { delayMinutes: 0, channel: 'email', templateId: 'follow-up-email' },
      { delayMinutes: 3 * DAY, channel: 'sms', templateId: 'follow-up-sms' },
      { delayMinutes: 7 * DAY, channel: 'email', templateId: 'follow-up-last-email' },
    ],
  },
  {
    id: 'package-renewal',
    name: 'Package renewal',
    description: 'Reminds the patient before a health package ends.',
    enrolOnStage: 'package_active',
    cancelOnStages: ['lost'],
    steps: [
      { delayMinutes: 330 * DAY, channel: 'email', templateId: 'renewal-email' },
      { delayMinutes: 350 * DAY, channel: 'whatsapp', templateId: 'renewal-whatsapp' },
    ],
  },
] as const satisfies readonly SequenceDefinition[];

/**
 * Templates, note templates, SLA targets and scoring for the clinic pack.
 * Email is sent for real (Resend); SMS and WhatsApp are simulated, because real
 * SMS in India needs DLT registration that a demo does not have.
 * Templates never contain medical advice.
 */
export const clinicCrm = {
  templates: [
    {
      id: 'welcome-email',
      channel: 'email',
      subject: 'We have your enquiry (ref {reference})',
      body: 'Hello {firstName},\n\nThank you for contacting {brand}. We have your enquiry about {specialty} and a care coordinator is matching you with the right doctor’s team.\n\nSomeone from that team will contact you in the time window you chose. If anything changes, simply reply to this email.\n\nIf this is an emergency, call your local emergency number or go to the nearest hospital.',
    },
    {
      id: 'welcome-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, this is {brand}. We have your enquiry (ref {reference}) and will call you at the time you chose.',
    },
    {
      id: 'welcome-nudge-email',
      channel: 'email',
      subject: 'Still looking for the right doctor?',
      body: 'Hello {firstName},\n\nWe tried to reach you about your enquiry (ref {reference}). If you would still like help with {specialty}, reply with a time that suits you and we will call.\n\nIf you no longer need us, no reply is needed.',
    },
    {
      id: 'appointment-confirmed-email',
      channel: 'email',
      subject: 'Your appointment is booked',
      body: 'Hello {firstName},\n\nYour {specialty} appointment is booked. Please bring any recent reports and a list of medicines you take. You can bring someone with you.\n\nNeed to change the time? Reply to this email.',
    },
    {
      id: 'appointment-reminder-sms',
      channel: 'sms',
      body: '{brand}: a reminder of your appointment tomorrow. Reply R to reschedule.',
    },
    {
      id: 'no-show-sms',
      channel: 'sms',
      body: '{brand}: we missed you today. Reply YES and we will offer a new time.',
    },
    {
      id: 'no-show-email',
      channel: 'email',
      subject: 'Shall we find another time?',
      body: 'Hello {firstName},\n\nWe missed you at your appointment. Things come up, and that is fine. Reply to this email and we will find a new time that suits you.',
    },
    {
      id: 'post-visit-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, how was your visit to {brand}? If anything your doctor said is unclear, reply here and we will help.',
    },
    {
      id: 'post-visit-email',
      channel: 'email',
      subject: 'How was your visit?',
      body: 'Hello {firstName},\n\nThank you for visiting {brand}. If you have questions about the next steps your doctor described, reply and a care coordinator will help.',
    },
    {
      id: 'follow-up-email',
      channel: 'email',
      subject: 'Time to book your follow-up',
      body: 'Hello {firstName},\n\nYour doctor asked to see you again. Reply with a time that suits you and we will book your follow-up.',
    },
    {
      id: 'follow-up-sms',
      channel: 'sms',
      body: '{brand}: your doctor asked for a follow-up visit. Reply BOOK and we will call you.',
    },
    {
      id: 'follow-up-last-email',
      channel: 'email',
      subject: 'A last reminder about your follow-up',
      body: 'Hello {firstName},\n\nThis is our last reminder about the follow-up your doctor asked for. Reply whenever you are ready and we will book it.',
    },
    {
      id: 'renewal-email',
      channel: 'email',
      subject: 'Your health package ends soon',
      body: 'Hello {firstName},\n\nYour health package with {brand} ends in about a month. Reply if you would like to renew it or talk through your options.',
    },
    {
      id: 'renewal-whatsapp',
      channel: 'whatsapp',
      body: 'Hello {firstName}, your {brand} health package ends soon. Reply RENEW and we will call you.',
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
      label: 'Called, appointment booked',
      body: 'Spoke with the patient. Appointment booked. Reminder sequence will follow.',
    },
    {
      id: 'insurance-check',
      label: 'Insurance check started',
      body: 'Insurance details requested. Billing desk to confirm cover before the visit.',
    },
    {
      id: 'needs-callback',
      label: 'Asked for a call back',
      body: 'Patient asked to be called back at a different time.',
    },
  ],

  sla: {
    firstResponseMinutes: { urgent: 1 * HOUR, high: 4 * HOUR, normal: 1 * DAY, low: 2 * DAY },
  },

  scoring: [
    { id: 'offering', label: 'Knows which specialty they need', points: 15, when: { kind: 'offeringChosen' } },
    {
      id: 'insured',
      label: 'Has insurance to use',
      points: 10,
      when: { kind: 'answer', questionId: 'has_insurance', equals: 'yes' },
    },
    {
      id: 'returning',
      label: 'Returning patient',
      points: 10,
      when: { kind: 'answer', questionId: 'visit_type', equals: 'follow-up' },
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
      label: 'Booked or visited',
      points: 20,
      when: { kind: 'stage', in: ['appointment_booked', 'visited', 'follow_up_due', 'package_active'] },
    },
    { id: 'won', label: 'Package active', points: 10, when: { kind: 'stage', in: ['package_active'] } },
    { id: 'lost', label: 'Marked as lost', points: -60, when: { kind: 'stage', in: ['lost'] } },
    { id: 'opted-out', label: 'Unsubscribed from messages', points: -30, when: { kind: 'optedOut' } },
  ],
} as const satisfies Omit<CrmConfig, 'sequences'>;
