import type { IndustryPack } from './industries/types';

/**
 * The guided tour in the demo bar: the five-minute path from docs/PITCH.md,
 * step by step across the website and the CRM. Each step names the page it
 * belongs to and the element it highlights (`data-tour="…"`).
 */
export interface TourStep {
  readonly id: string;
  readonly app: 'web' | 'crm';
  readonly path: string;
  /** The `data-tour` value of the element to highlight on that page. */
  readonly target: string;
  readonly title: string;
  readonly body: string;
}

export function demoTour(pack: IndustryPack): TourStep[] {
  const { brand, booking, leadNoun } = pack;
  const expert = pack.roleLabels.specialist_doctor.toLowerCase();
  return [
    {
      id: 'brand',
      app: 'web',
      path: '/',
      target: 'hero',
      title: `${brand.name}: one industry pack`,
      body: `Everything here comes from the ${brand.shortName} pack: the copy, the theme, the services and the questions. Switch industry in this bar and the whole site, the CRM and the assistant change with it.`,
    },
    {
      id: 'enquiry',
      app: 'web',
      path: '/contact',
      target: 'enquiry-form',
      title: 'Send an enquiry',
      body: `Fill in the form as a ${leadNoun}. The same rules check it in the browser and on the server, and each consent is stored separately with its exact wording.`,
    },
    {
      id: 'assistant',
      app: 'web',
      path: '/contact',
      target: 'assistant',
      title: 'Talk to the AI assistant',
      body: `Try "Talk to our assistant": it says it is an AI, asks for consent, asks a few short questions and never gives advice. Typed chat works everywhere; voice needs a microphone.`,
    },
    {
      id: 'booking',
      app: 'web',
      path: '/contact',
      target: 'enquiry-form',
      title: `Book a ${booking.noun}`,
      body: `After sending, choose "Choose a time" on the thank-you panel. The slots are real: they come from the ${expert}'s calendar, and the database refuses double booking.`,
    },
    {
      id: 'payment',
      app: 'web',
      path: '/contact',
      target: 'enquiry-form',
      title: 'Pay a test fee',
      body: 'From the booking page, choose "Pay online (test payment)". No real money moves; a paid payment moves the lead to the won stage.',
    },
    {
      id: 'pipeline',
      app: 'crm',
      path: '/pipeline',
      target: 'pipeline',
      title: 'The lead arrives in the CRM',
      body: `Sign in as the front desk. The new ${leadNoun} is on the pipeline with its stage, SLA timer and score. Open it.`,
    },
    {
      id: 'lead',
      app: 'crm',
      path: '/pipeline',
      target: 'pipeline',
      title: 'Summary, routing, booking, payments',
      body: `On the lead's page: the assistant's summary, the routing suggestion with its reasons, the ${booking.noun} and the test payment, and the full timeline.`,
    },
    {
      id: 'dashboard',
      app: 'crm',
      path: '/dashboard',
      target: 'dashboard',
      title: 'The manager dashboard',
      body: 'Sign in as the manager. Every number is a query over the data: the funnel, first response against the SLA, no-shows, staff load and the assistant’s calls.',
    },
  ];
}
