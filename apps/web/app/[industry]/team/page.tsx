import { Badge, buttonClasses, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PersonAvatar } from '@/components/illustrations/person-avatar';
import { PageHeader } from '@/components/page-header';
import { languageList, listedStaff, locationName, offeringName } from '@/lib/content';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/team'>): Promise<Metadata> {
  const { team } = (await pagePack(props)).site;
  return { title: team.eyebrow, description: team.description };
}

export default async function TeamPage(props: PageProps<'/[industry]/team'>) {
  const pack = await pagePack(props);
  const { team } = pack.site;
  const levels = pack.staffLevels;
  return (
    <>
      <PageHeader eyebrow={team.eyebrow} title={team.title} intro={team.intro} />
      <Container className="py-section">
        <Notice tone="demo" title={team.notice.title} className="mb-10 max-w-3xl">
          {team.notice.body}
        </Notice>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listedStaff(pack).map((member) => (
            <li key={member.id}>
              <article
                aria-labelledby={`doctor-${member.id}`}
                className="flex h-full flex-col rounded-lg border border-line bg-surface p-6 shadow-soft"
              >
                <div className="flex items-start gap-4">
                  <PersonAvatar seed={member.fullName} whiteCoat={pack.id === 'clinic'} className="size-20 shrink-0" />
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
                    <dt className="w-24 shrink-0 font-semibold">{team.offeringLabel}</dt>
                    <dd>{member.specialties.map((slug) => offeringName(pack, slug)).join(', ')}</dd>
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
                    <dt className="w-24 shrink-0 font-semibold">{team.locationsLabel}</dt>
                    <dd>{member.locations.map((id) => locationName(pack, id)).join('; ')}</dd>
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
          <p className="text-lg text-ink-muted">You do not need to choose anyone. We match you with the right team.</p>
          <Link href="/contact" className={`${buttonClasses({ size: 'lg' })} mt-5`}>
            {pack.site.ctaLabel}
          </Link>
        </div>
      </Container>
    </>
  );
}
