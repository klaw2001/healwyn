import { healthPackages } from '@healwyn/core';
import { Badge, buttonClasses, CheckIcon, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { specialtyName } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Health packages',
  description: 'Four illustrative health packages. Demo content: no prices are shown.',
};

export default function HealthPackagesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Health packages"
        title="Check-ups, planned around you"
        intro="Each package brings a consultation, the tests your doctor chooses and a follow-up conversation into one visit."
      />
      <Container className="py-section">
        <Notice tone="demo" title="Illustrative packages" className="mb-10 max-w-3xl">
          These packages are examples for this demo. No prices are shown and none of them can be bought. Your doctor
          decides which tests are right for you.
        </Notice>
        <ul className="grid gap-6 md:grid-cols-2">
          {healthPackages.map((pkg, index) => (
            <li key={pkg.id}>
              <article
                aria-labelledby={`package-${pkg.id}`}
                className="relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface p-7 shadow-soft"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-1.5 ${index % 2 === 0 ? 'bg-primary' : 'bg-accent'}`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">{specialtyName(pkg.specialtySlug)}</Badge>
                  <Badge tone="accent">Demo, no pricing</Badge>
                </div>
                <h2 id={`package-${pkg.id}`} className="mt-5 text-2xl">
                  {pkg.name}
                </h2>
                <p className="mt-2 text-ink-muted">{pkg.forWhom}</p>
                <h3 className="mt-6 font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">
                  Includes
                </h3>
                <ul className="mt-3 grid flex-1 gap-2.5">
                  {pkg.includes.map((item) => (
                    <li key={item} className="flex gap-3">
                      <CheckIcon className="mt-1 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">{pkg.duration}</p>
                <Link
                  href={`/contact?specialty=${pkg.specialtySlug}`}
                  className={`${buttonClasses({ variant: 'secondary' })} mt-5 self-start`}
                >
                  Ask about this package
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
