import { getActivePack } from '@healwyn/core';
import { Badge, buttonClasses, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DoctorAvatar } from '@/components/illustrations/doctor-avatar';
import { PageHeader } from '@/components/page-header';
import { clinicians, languageList, locationName, specialtyName } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Doctors',
  description: 'Meet the (fictional) doctors and clinicians across our six specialties.',
};

export default function DoctorsPage() {
  const levels = getActivePack().staffLevels;
  return (
    <>
      <PageHeader
        eyebrow="Doctors"
        title="People who take the time to listen"
        intro="Every clinician below works as part of a specialty team, so you are never handed from stranger to stranger."
      />
      <Container className="py-section">
        <Notice tone="demo" title="These are fictional profiles" className="mb-10 max-w-3xl">
          Names, roles and portraits are invented for this demo. Any resemblance to real people is coincidental.
        </Notice>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {clinicians.map((member) => (
            <li key={member.id}>
              <article
                aria-labelledby={`doctor-${member.id}`}
                className="flex h-full flex-col rounded-lg border border-line bg-surface p-6 shadow-soft"
              >
                <div className="flex items-start gap-4">
                  <DoctorAvatar seed={member.fullName} className="size-20 shrink-0" />
                  <div>
                    <h2 id={`doctor-${member.id}`} className="text-xl leading-tight">
                      {member.fullName}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">{member.title}</p>
                  </div>
                </div>
                {member.bio ? <p className="mt-5 flex-1 text-ink-muted">{member.bio}</p> : null}
                <dl className="mt-5 grid gap-2 border-t border-line pt-4 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 font-semibold">Specialty</dt>
                    <dd>{member.specialties.map(specialtyName).join(', ')}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 font-semibold">Role</dt>
                    <dd>{levels.find((l) => l.id === member.level)?.label}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 font-semibold">Languages</dt>
                    <dd>{languageList(member.languages)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 font-semibold">Clinics</dt>
                    <dd>{member.locations.map(locationName).join('; ')}</dd>
                  </div>
                </dl>
                <Badge tone="accent" className="mt-5 self-start">
                  Fictional profile
                </Badge>
              </article>
            </li>
          ))}
        </ul>
        <div className="mt-12 text-center">
          <p className="text-lg text-ink-muted">
            You do not need to choose a doctor. We match you with the right team.
          </p>
          <Link href="/contact" className={`${buttonClasses({ size: 'lg' })} mt-5`}>
            Talk to us
          </Link>
        </div>
      </Container>
    </>
  );
}
