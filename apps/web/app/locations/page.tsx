import { clinicLocations } from '@healwyn/core';
import { buttonClasses, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LocationMap } from '@/components/illustrations/location-map';
import { PageHeader } from '@/components/page-header';
import { specialtyName } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Locations',
  description: 'Two (fictional) clinics in Bengaluru and Pune.',
};

export default function LocationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Locations"
        title="Two calm, easy-to-reach clinics"
        intro="Step-free entrances, quiet waiting rooms and staff who know your name."
      />
      <Container className="py-section">
        <Notice tone="demo" className="mb-10 max-w-3xl">
          Both clinics and their addresses are fictional. Please do not visit these addresses.
        </Notice>
        <ul className="grid gap-8 lg:grid-cols-2">
          {clinicLocations.map((location, index) => (
            <li key={location.id}>
              <article
                aria-labelledby={`location-${location.id}`}
                className="h-full overflow-hidden rounded-xl border border-line bg-surface shadow-soft"
              >
                <LocationMap variant={index === 0 ? 'lake' : 'river'} className="h-44 w-full sm:h-52" />
                <div className="p-6 sm:p-8">
                  <p className="text-sm font-semibold tracking-[0.08em] text-accent-ink uppercase">{location.city}</p>
                  <h2 id={`location-${location.id}`} className="mt-1 text-3xl">
                    {location.name}
                  </h2>
                  <address className="mt-4 text-ink-muted not-italic">
                    {location.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>

                  <h3 className="mt-6 font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">
                    Opening hours
                  </h3>
                  <dl className="mt-2 grid gap-1">
                    {location.hours.map((row) => (
                      <div key={row.days} className="flex justify-between gap-4 border-b border-line py-2">
                        <dt>{row.days}</dt>
                        <dd className="font-semibold">{row.time}</dd>
                      </div>
                    ))}
                  </dl>

                  <h3 className="mt-6 font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">
                    Specialties here
                  </h3>
                  <p className="mt-2">{location.specialties.map(specialtyName).join(', ')}</p>

                  <h3 className="mt-6 font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">
                    Access
                  </h3>
                  <ul className="mt-2 grid gap-1">
                    {location.access.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          ))}
        </ul>
        <div className="mt-12 text-center">
          <Link href="/contact" className={buttonClasses({ size: 'lg' })}>
            Book a visit
          </Link>
        </div>
      </Container>
    </>
  );
}
