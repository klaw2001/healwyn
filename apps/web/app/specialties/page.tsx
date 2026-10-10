import { ArrowRightIcon, buttonClasses, Container } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SpecialtyIcon } from '@/components/illustrations/specialty-icon';
import { PageHeader } from '@/components/page-header';
import { cliniciansFor, specialtyViews } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Specialties',
  description: 'General medicine, dermatology, dental, physiotherapy, women’s health and diagnostics, under one roof.',
};

export default function SpecialtiesPage() {
  const specialties = specialtyViews();
  return (
    <>
      <PageHeader
        eyebrow="Specialties"
        title="The right specialist, without the guesswork"
        intro="Six specialties working as one team. Tell us what you need and we will match you with the right one, or simply choose below."
      />
      <Container className="py-section">
        <ul className="grid gap-5 md:grid-cols-2">
          {specialties.map((specialty) => {
            const team = cliniciansFor(specialty.slug);
            return (
              <li key={specialty.slug}>
                <Link
                  href={`/specialties/${specialty.slug}`}
                  className="group grid h-full gap-5 rounded-lg border border-line bg-surface p-6 shadow-soft transition-[border-color,box-shadow] hover:border-primary hover:shadow-lift sm:grid-cols-[auto_1fr] sm:p-7"
                >
                  <span className="grid size-14 place-items-center rounded-lg bg-surface-teal text-primary">
                    <SpecialtyIcon name={specialty.icon} className="size-8" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-display text-2xl font-semibold text-ink">{specialty.name}</span>
                    <span className="mt-1 font-semibold text-accent-ink">{specialty.tagline}</span>
                    <span className="mt-3 text-ink-muted">{specialty.summary}</span>
                    <span className="mt-4 text-sm text-ink-muted">
                      {team.length} {team.length === 1 ? 'clinician' : 'clinicians'} in this team
                    </span>
                    <span className="mt-4 inline-flex items-center gap-1.5 font-semibold text-primary">
                      About {specialty.name.toLowerCase()}
                      <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 flex flex-col items-start gap-5 rounded-lg border border-dashed border-line-strong bg-surface-muted p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-2xl">Not sure which specialty you need?</h2>
            <p className="mt-2 text-ink-muted">Choose “I’m not sure” on the form and a care coordinator will help.</p>
          </div>
          <Link href="/contact" className={`${buttonClasses()} shrink-0`}>
            Talk to us
          </Link>
        </div>
      </Container>
    </>
  );
}
