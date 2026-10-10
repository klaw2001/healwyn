import { BRAND } from '@healwyn/core';
import { Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PatientForm } from '@/components/forms/patient-form';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Contact and book',
  description: 'Tell us what you need and we will match you with the right doctor’s team.',
};

const nextSteps = [
  { title: 'We read your enquiry', body: 'A care coordinator looks at what you need, your language and your timing.' },
  { title: 'We match you', body: 'Your enquiry goes to the doctor’s team best placed to help.' },
  { title: 'We get in touch', body: 'Someone from that team contacts you in the time window you chose.' },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact and book"
        title="Tell us what you need"
        intro="Two minutes, in your own words. We will match you with the right doctor’s team and get back to you."
      />
      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <div>
          <Notice tone="emergency" title="Not for emergencies" className="mb-8">
            {BRAND.emergencyNotice}
          </Notice>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-8">
            <PatientForm />
          </div>
        </div>

        <aside aria-labelledby="next-steps-title" className="lg:pt-2">
          <div className="lg:sticky lg:top-28">
            <h2 id="next-steps-title" className="text-2xl">
              What happens next
            </h2>
            <ol className="mt-6 grid gap-6">
              {nextSteps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display font-semibold text-on-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-sans font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 rounded-lg bg-surface-teal p-5 text-sm">
              <h2 className="font-sans text-base font-semibold">Your privacy</h2>
              <p className="mt-2 text-ink-muted">
                We ask only for what we need to respond. You can withdraw consent at any time and we will delete your
                details. Read the{' '}
                <Link href="/privacy" className="font-semibold text-primary underline underline-offset-4">
                  privacy notice
                </Link>
                .
              </p>
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              Representing an employer, insurer or lab?{' '}
              <Link href="/partners" className="font-semibold text-primary underline underline-offset-4">
                Partner enquiries
              </Link>
            </p>
          </div>
        </aside>
      </Container>
    </>
  );
}
