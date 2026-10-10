import { BRAND } from '@healwyn/core';
import { ArrowRightIcon, Badge, buttonClasses, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DoctorAvatar } from '@/components/illustrations/doctor-avatar';
import { SpecialtyIcon } from '@/components/illustrations/specialty-icon';
import { PageHeader } from '@/components/page-header';
import { cliniciansFor, languageList, locationsFor, specialtyView, specialtyViews } from '@/lib/content';

export const dynamicParams = false;

export function generateStaticParams() {
  return specialtyViews().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<'/specialties/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const specialty = specialtyView(slug);
  return specialty ? { title: specialty.name, description: specialty.summary } : {};
}

export default async function SpecialtyPage({ params }: PageProps<'/specialties/[slug]'>) {
  const { slug } = await params;
  const specialty = specialtyView(slug);
  if (!specialty) notFound();
  const team = cliniciansFor(slug);
  const places = locationsFor(slug);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/specialties" className="underline-offset-4 hover:underline">
            Specialties
          </Link>
        }
        title={specialty.name}
        intro={
          <>
            <span className="block font-display text-2xl text-ink">{specialty.tagline}</span>
            <span className="mt-4 block">{specialty.intro}</span>
          </>
        }
        aside={
          <span className="grid size-40 place-items-center rounded-full bg-surface text-primary shadow-soft">
            <SpecialtyIcon name={specialty.icon} className="size-20" />
          </span>
        }
      >
        <Link href={`/contact?specialty=${specialty.slug}`} className={`${buttonClasses({ size: 'lg' })} mt-8`}>
          Ask about {specialty.name.toLowerCase()}
          <ArrowRightIcon className="text-xl" />
        </Link>
      </PageHeader>

      <Container className="grid gap-12 py-section lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="reasons-title">
          <h2 id="reasons-title" className="text-2xl">
            Why people book
          </h2>
          <ul className="mt-6 grid gap-3">
            {specialty.reasonsPeopleVisit.map((reason) => (
              <li key={reason} className="flex gap-3 rounded-md bg-surface-muted px-4 py-3">
                <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-accent" />
                {reason}
              </li>
            ))}
          </ul>
          <Notice className="mt-6">{BRAND.noAdviceNotice}</Notice>
        </section>

        <section aria-labelledby="first-visit-title">
          <h2 id="first-visit-title" className="text-2xl">
            Your first visit
          </h2>
          <ol className="mt-6 grid gap-5">
            {specialty.firstVisit.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-primary font-display font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </Container>

      <section aria-labelledby="team-title" className="border-t border-line bg-surface-muted">
        <Container className="py-section">
          <h2 id="team-title" className="text-3xl">
            The {specialty.name.toLowerCase()} team
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {team.map((member) => (
              <li key={member.id} className="flex gap-4 rounded-lg border border-line bg-surface p-5">
                <DoctorAvatar seed={member.fullName} className="size-16 shrink-0" />
                <div>
                  <p className="font-display text-lg font-semibold">{member.fullName}</p>
                  <p className="text-sm text-ink-muted">{member.title}</p>
                  <p className="mt-2 text-sm">Speaks {languageList(member.languages)}</p>
                  <Badge className="mt-3">Fictional profile</Badge>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-ink-muted">
            Available at{' '}
            {places.map((place, index) => (
              <span key={place.id}>
                {index > 0 ? ' and ' : ''}
                <Link href="/locations" className="font-semibold text-primary underline underline-offset-4">
                  {place.name}, {place.city}
                </Link>
              </span>
            ))}
            .
          </p>
        </Container>
      </section>
    </>
  );
}
