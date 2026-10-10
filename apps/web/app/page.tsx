import {
  BRAND,
  clinicDemoStaff,
  clinicLocations,
  clinicPack,
  howItWorks,
  partnerWordmarks,
  specialtyDetails,
  trustPoints,
} from '@healwyn/core';
import { ArrowRightIcon, buttonClasses, CheckIcon, Container, Eyebrow, Notice, Section } from '@healwyn/ui';
import Link from 'next/link';
import { HeroIllustration, Swash } from '@/components/illustrations/hero';
import { SpecialtyIcon } from '@/components/illustrations/specialty-icon';

const highlights = ['English and Hindi', 'Women doctors on request', `${clinicLocations.length} clinics`];

function splitTagline(tagline: string) {
  // Underline the phrase "right doctor" when the tagline contains it, keeping
  // any punctuation that follows on the same line as the phrase.
  const phrase = 'right doctor';
  const index = tagline.indexOf(phrase);
  if (index === -1) return { before: tagline, phrase: '', punctuation: '', after: '' };
  const rest = tagline.slice(index + phrase.length);
  const punctuation = /^[,.;:!?]*/.exec(rest)?.[0] ?? '';
  return { before: tagline.slice(0, index), phrase, punctuation, after: rest.slice(punctuation.length) };
}

export default function HomePage() {
  const tagline = splitTagline(BRAND.tagline);
  const clinicianCount = clinicDemoStaff.filter((m) => m.clinician).length;

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <Container className="grid items-center gap-10 pt-10 pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:pt-20 lg:pb-24">
          <div>
            <Eyebrow>Multi-specialty clinics in Bengaluru and Pune</Eyebrow>
            <h1 id="hero-title" className="text-display text-ink">
              {tagline.before}
              {tagline.phrase ? (
                <span className="whitespace-nowrap">
                  <span className="relative inline-block">
                    {tagline.phrase}
                    <Swash className="absolute -bottom-[0.12em] left-0 h-[0.28em] w-full" />
                  </span>
                  {tagline.punctuation}
                </span>
              ) : null}
              {tagline.after}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-muted sm:text-xl sm:leading-relaxed">
              Tell us what you need in your own words. We listen, then match you with the doctor&apos;s team best placed
              to help, at a time that suits you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className={buttonClasses({ size: 'lg' })}>
                Talk to us
                <ArrowRightIcon className="text-xl" />
              </Link>
              <Link href="/specialties" className={buttonClasses({ size: 'lg', variant: 'secondary' })}>
                Explore specialties
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-muted">
              {highlights.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <CheckIcon className="text-base text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <HeroIllustration className="mx-auto w-full max-w-md lg:max-w-none" />
        </Container>
      </section>

      {/* How it works */}
      <Section
        id="how-it-works"
        tone="muted"
        eyebrow="How it works"
        title="From your first message to the right team, in three steps"
        intro="No phone trees, no repeating yourself. One short conversation, then a person who can actually help."
      >
        <ol className="relative grid gap-6 md:grid-cols-3 md:gap-8">
          <span
            aria-hidden="true"
            className="absolute top-7 bottom-7 left-7 border-l-2 border-dashed border-primary/40 md:top-7 md:right-[16%] md:bottom-auto md:left-[16%] md:border-t-2 md:border-l-0"
          />
          {howItWorks.map((step, index) => (
            <li key={step.title} className="relative flex gap-5 md:flex-col md:gap-6">
              <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full border-2 border-primary bg-surface font-display text-xl font-semibold text-primary md:mx-auto">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="md:text-center">
                <h3 className="text-xl">{step.title}</h3>
                <p className="mt-2 text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Specialties */}
      <Section
        id="specialties"
        eyebrow="Specialties"
        title="Six specialties under one roof"
        intro={`${clinicianCount} doctors and clinicians across ${clinicPack.offerings.length} specialties, working as one team so nobody falls between the gaps.`}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {specialtyDetails.map((detail) => {
            const offering = clinicPack.offerings.find((o) => o.slug === detail.slug);
            return (
              <li key={detail.slug}>
                <Link
                  href={`/specialties/${detail.slug}`}
                  className="group flex h-full flex-col rounded-lg border border-line bg-surface p-6 shadow-soft transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
                >
                  <span className="grid size-12 place-items-center rounded-md bg-surface-teal text-primary">
                    <SpecialtyIcon name={detail.icon} className="size-7" />
                  </span>
                  <span className="mt-5 font-display text-xl font-semibold text-ink">{offering?.name}</span>
                  <span className="mt-2 flex-1 text-ink-muted">{offering?.summary}</span>
                  <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary">
                    About {offering?.name.toLowerCase()}
                    <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Partner strip */}
      <section aria-labelledby="partners-title" className="border-y border-line bg-surface">
        <Container className="flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-sm">
            <h2 id="partners-title" className="text-xl">
              Working with employers, insurers and labs
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Fictional partner names, shown for demonstration.</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {partnerWordmarks.map((name, index) => (
              <li
                key={name}
                className={
                  index % 2 === 0
                    ? 'font-display text-lg font-semibold tracking-tight text-ink-muted'
                    : 'text-sm font-bold tracking-[0.14em] text-ink-muted uppercase'
                }
              >
                {name}
              </li>
            ))}
          </ul>
          <Link
            href="/partners"
            className={`${buttonClasses({ variant: 'secondary', size: 'sm' })} shrink-0 self-start lg:self-auto`}
          >
            Partner with us
          </Link>
        </Container>
      </section>

      {/* Trust */}
      <Section
        id="trust"
        tone="teal"
        eyebrow="Our promise"
        title="Care that starts with listening"
        intro="Technology helps us route your enquiry quickly. People, and only people, look after your health."
      >
        <ul className="grid gap-5 md:grid-cols-3">
          {trustPoints.map((point) => (
            <li key={point.title} className="rounded-lg bg-surface p-6 shadow-soft">
              <span className="grid size-10 place-items-center rounded-full bg-accent text-on-accent">
                <CheckIcon className="text-xl" />
              </span>
              <h3 className="mt-4 text-xl">{point.title}</h3>
              <p className="mt-2 text-ink-muted">{point.body}</p>
            </li>
          ))}
        </ul>
        <Notice tone="info" className="mt-8 max-w-3xl">
          {BRAND.noAdviceNotice}
        </Notice>
      </Section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-title">
        <Container className="py-section">
          <div className="relative overflow-hidden rounded-xl bg-primary px-6 py-12 text-on-primary sm:px-12 sm:py-16">
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 200 200"
              className="absolute -right-16 -bottom-20 size-72 opacity-20"
            >
              <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
            <div className="relative max-w-2xl">
              <h2 id="cta-title" className="text-3xl">
                Not sure where to start? That is exactly what we are here for.
              </h2>
              <p className="mt-4 text-lg opacity-90">
                Tell us a little about what you need and a care coordinator will take it from there.
              </p>
              <Link href="/contact" className={`${buttonClasses({ variant: 'accent', size: 'lg' })} mt-8`}>
                Talk to us
                <ArrowRightIcon className="text-xl" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
