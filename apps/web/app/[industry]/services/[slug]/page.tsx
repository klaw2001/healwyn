import { industryPacks } from '@healwyn/core';
import { ArrowRightIcon, Badge, buttonClasses, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OfferingIcon } from '@/components/illustrations/offering-icon';
import { PersonAvatar } from '@/components/illustrations/person-avatar';
import { PageHeader } from '@/components/page-header';
import { languageList, locationsFor, offeringView, staffFor } from '@/lib/content';
import { packFor } from '@/lib/pack';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(industryPacks).flatMap((pack) =>
    pack.offerings.map((offering) => ({ industry: pack.id, slug: offering.slug })),
  );
}

export async function generateMetadata({ params }: PageProps<'/[industry]/services/[slug]'>): Promise<Metadata> {
  const { industry, slug } = await params;
  const offering = offeringView(packFor(industry), slug);
  return offering ? { title: offering.name, description: offering.summary } : {};
}

export default async function OfferingPage({ params }: PageProps<'/[industry]/services/[slug]'>) {
  const { industry, slug } = await params;
  const pack = packFor(industry);
  const { services } = pack.site;
  const specialty = offeringView(pack, slug);
  if (!specialty) notFound();
  const team = staffFor(pack, slug);
  const places = locationsFor(pack, slug);
  const whiteCoat = pack.id === 'clinic';

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/services" className="underline-offset-4 hover:underline">
            {services.eyebrow}
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
            <OfferingIcon name={specialty.icon} className="size-20" />
          </span>
        }
      >
        <Link href={`/contact?service=${specialty.slug}`} className={`${buttonClasses({ size: 'lg' })} mt-8`}>
          Ask about {specialty.name.toLowerCase()}
          <ArrowRightIcon className="text-xl" />
        </Link>
      </PageHeader>

      <Container className="grid gap-12 py-section lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="reasons-title">
          <h2 id="reasons-title" className="text-2xl">
            {services.reasonsHeading}
          </h2>
          <ul className="mt-6 grid gap-3">
            {specialty.reasons.map((reason) => (
              <li key={reason} className="flex gap-3 rounded-md bg-surface-muted px-4 py-3">
                <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-accent" />
                {reason}
              </li>
            ))}
          </ul>
          <Notice className="mt-6">{pack.brand.noAdviceNotice}</Notice>
        </section>

        <section aria-labelledby="first-visit-title">
          <h2 id="first-visit-title" className="text-2xl">
            {services.firstStepsHeading}
          </h2>
          <ol className="mt-6 grid gap-5">
            {specialty.firstSteps.map((step, index) => (
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
                <PersonAvatar seed={member.fullName} whiteCoat={whiteCoat} className="size-16 shrink-0" />
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
