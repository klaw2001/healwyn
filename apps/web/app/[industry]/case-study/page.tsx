import { BRANDS } from '@healwyn/core';
import { Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { architectureSvg, THEME_COLORS } from '@/lib/architecture-svg';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/case-study'>): Promise<Metadata> {
  const pack = await pagePack(props);
  return {
    title: 'How this demo was built',
    description: `The story of the lead-to-expert platform behind ${pack.brand.name}: the problem, the system, and what it does and does not prove.`,
  };
}

const JOURNEY = [
  ['Enquiry', 'A short form, checked by the same rules in the browser and on the server, with separate consents.'],
  ['AI assistant', 'A scripted assistant asks the qualifying questions by voice or typed chat. It never improvises.'],
  ['Routing', 'A deterministic engine picks the right expert and writes down why.'],
  ['Staff', 'The lead arrives in the CRM with a summary, an SLA timer, a score and its full history.'],
  ['Follow-up', 'Nurture sequences send reminders and stop the moment the person replies or opts out.'],
  ['Booking and payment', 'Real slots from the expert’s calendar, and a test-mode payment that closes the loop.'],
  ['Dashboard', 'Managers see the funnel, response times, no-shows and load, each number traceable to a query.'],
] as const;

const SKILLS = [
  [
    'Product thinking',
    'Turning a vague goal ("handle leads better") into a journey with clear stages, owners and failure states.',
  ],
  [
    'Full-stack engineering',
    'TypeScript end to end (Next.js, React, Postgres) and a Python voice agent, sharing one set of contracts.',
  ],
  [
    'Security and privacy by design',
    'Row level security per role and per industry, least-privilege database roles, signed webhooks, consent records that cannot be edited, and erasure on withdrawal (India’s DPDP rules).',
  ],
  [
    'Responsible AI',
    'The language model only maps an answer to an allowed option. Every spoken line is written in advance, and safety checks for emergencies, advice requests and prompt injection run first on every turn.',
  ],
  [
    'Accessibility',
    'Keyboard use throughout, labelled fields with linked errors, visible focus, and colour contrast tested automatically for every industry theme in light and dark mode.',
  ],
  [
    'Testing and honesty',
    'Unit, database and browser tests, a scripted evaluation of the assistant in which every safety scenario must pass, and written decisions for every trade-off.',
  ],
] as const;

export default async function CaseStudyPage(props: PageProps<'/[industry]/case-study'>) {
  const pack = await pagePack(props);
  const brands = Object.values(BRANDS).map((b) => b.name);
  return (
    <>
      <PageHeader
        eyebrow="Case study"
        title="How this demo was built"
        intro={`${pack.brand.name} is one of four fictional brands running on the same lead-to-expert platform. This page tells the story of the build: the problem, the system, and what it does and does not prove.`}
      />
      <Container className="py-section">
        <div className="mx-auto grid max-w-3xl gap-14">
          <Notice tone="demo">
            A portfolio demo with synthetic data. There are no real customers, patients or results here, and none are
            claimed.
          </Notice>

          <section aria-labelledby="problem-title">
            <h2 id="problem-title" className="text-3xl">
              The problem
            </h2>
            <p className="mt-4 text-lg">
              Service businesses that sell expertise (clinics, property, financial advice, interiors) lose people in the
              gap between &ldquo;I sent an enquiry&rdquo; and &ldquo;I spoke to the right person&rdquo;. Replies are
              slow, enquiries land with whoever is free rather than whoever fits, follow-ups depend on memory, and
              nobody can say afterwards where people dropped out.
            </p>
            <p className="mt-4">
              The brief was to build the whole path from first enquiry to a booked, paid appointment, in a way that is
              safe with sensitive information, honest about what an AI can do, and quick to adapt to another industry.
            </p>
          </section>

          <section aria-labelledby="system-title">
            <h2 id="system-title" className="text-3xl">
              The system
            </h2>
            <ol className="mt-6 grid gap-4">
              {JOURNEY.map(([title, body], index) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 place-items-center rounded-full bg-primary font-semibold text-on-primary"
                  >
                    {index + 1}
                  </span>
                  <p>
                    <strong>{title}.</strong> {body}
                  </p>
                </li>
              ))}
            </ol>
            <h3 className="mt-10 font-sans text-xl font-bold">How the parts fit together</h3>
            <div
              role="region"
              aria-label="Architecture diagram"
              tabIndex={0}
              className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface p-4 [&>svg]:block [&>svg]:w-full [&>svg]:min-w-[44rem]"
              // The diagram is our own static markup (apps/web/lib/architecture-svg.ts), not user content.
              dangerouslySetInnerHTML={{ __html: architectureSvg(THEME_COLORS, { id: 'case-study-architecture' }) }}
            />
            <p className="mt-3 text-sm text-ink-muted">
              On a small screen, scroll the diagram sideways. The same diagram, with its Mermaid source, is in the
              project&rsquo;s architecture notes.
            </p>
          </section>

          <section aria-labelledby="packs-title">
            <h2 id="packs-title" className="text-3xl">
              One platform, four industries
            </h2>
            <p className="mt-4">
              Everything specific to an industry lives in one &ldquo;industry pack&rdquo;: the brand and copy, the
              questions people answer, the pipeline stages, the follow-up messages, the routing weights, the
              assistant&rsquo;s script and safety rules, the booking and payment settings, the theme and the demo data.
              The four packs are {brands.slice(0, -1).join(', ')} and {brands.at(-1)}. In demo mode, one click re-skins
              the website, the CRM and the assistant.
            </p>
            <p className="mt-4">
              Each industry has its own safety rules. The clinic&rsquo;s assistant never gives medical advice and stops
              at emergency symptoms. The wealth assistant never gives investment advice and watches for fraud in
              progress, such as someone asking for a one-time password. Real estate and wealth advisory show
              regulatory-style notices on every page.
            </p>
          </section>

          <section aria-labelledby="result-title">
            <h2 id="result-title" className="text-3xl">
              The result, honestly
            </h2>
            <p className="mt-4">
              A working, tested demo of the full journey, not a business with results. What runs for real: the website
              and forms, the CRM with its security rules, routing, email follow-ups, booking with no double booking, the
              assistant&rsquo;s typed chat and browser voice, and the dashboard. What is simulated: SMS and WhatsApp
              messages, phone calls (they need a telephone provider), and payments, which run in test mode only.
            </p>
            <p className="mt-4">
              It runs on free tiers, and the project includes a costed list of where those free tiers would break first
              and what a paid client version would cost.
            </p>
          </section>

          <section aria-labelledby="skills-title">
            <h2 id="skills-title" className="text-3xl">
              What it shows
            </h2>
            <dl className="mt-6 grid gap-5">
              {SKILLS.map(([title, body]) => (
                <div key={title}>
                  <dt className="font-semibold">{title}</dt>
                  <dd className="mt-1 text-ink-muted">{body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p>
            <Link href="/contact" className="font-semibold text-primary underline underline-offset-4">
              Try the journey yourself: send a demo enquiry
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
