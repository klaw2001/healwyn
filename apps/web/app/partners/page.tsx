import { BRAND, partnerAudiences } from '@healwyn/core';
import { CheckIcon, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PartnerForm } from '@/components/forms/partner-form';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'For partners',
  description: 'Corporate wellness, insurance and TPA partners, referring doctors and diagnostic labs.',
};

export default function PartnersPage() {
  return (
    <>
      <PageHeader
        eyebrow="For partners"
        title="Better care is a team effort"
        intro="We work with employers, insurers, referring doctors and labs to get people to the right care, faster and with less paperwork."
      />
      <Container className="py-section">
        <ul className="grid gap-5 sm:grid-cols-2">
          {partnerAudiences.map((audience) => (
            <li key={audience.type} className="rounded-lg border border-line bg-surface p-6 shadow-soft">
              <h2 className="text-2xl">{audience.title}</h2>
              <p className="mt-2 text-ink-muted">{audience.summary}</p>
              <ul className="mt-4 grid gap-2">
                {audience.offers.map((offer) => (
                  <li key={offer} className="flex gap-3">
                    <CheckIcon className="mt-1 shrink-0 text-primary" />
                    {offer}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Container>

      <section aria-labelledby="partner-form-title" className="border-t border-line bg-surface-muted">
        <Container className="grid gap-10 py-section lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 id="partner-form-title" className="text-3xl">
              Start a conversation
            </h2>
            <p className="mt-4 text-ink-muted">
              Tell us a little about your organisation. Our partnerships team replies by email, usually within two
              working days.
            </p>
            <p className="mt-4 text-sm text-ink-muted">
              Prefer email? Write to <span className="font-semibold text-ink">{BRAND.partnersEmail}</span> (placeholder
              address).
            </p>
            <Notice tone="emergency" title="Patient enquiries" className="mt-6">
              This form is for organisations. If you are a patient, please use the{' '}
              <Link href="/contact" className="font-semibold underline underline-offset-4">
                contact page
              </Link>
              . {BRAND.emergencyNotice}
            </Notice>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-8">
            <PartnerForm />
          </div>
        </Container>
      </section>
    </>
  );
}
