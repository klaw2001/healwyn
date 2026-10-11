import { ArrowRightIcon, buttonClasses, Container } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferingIcon } from '@/components/illustrations/offering-icon';
import { PageHeader } from '@/components/page-header';
import { offeringViews, staffFor } from '@/lib/content';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/services'>): Promise<Metadata> {
  const { services } = (await pagePack(props)).site;
  return { title: services.eyebrow, description: services.description };
}

export default async function ServicesPage(props: PageProps<'/[industry]/services'>) {
  const pack = await pagePack(props);
  const { services } = pack.site;
  const [one, many] = services.memberNoun;
  return (
    <>
      <PageHeader eyebrow={services.eyebrow} title={services.title} intro={services.intro} />
      <Container className="py-section">
        <ul className="grid gap-5 md:grid-cols-2">
          {offeringViews(pack).map((offering) => {
            const team = staffFor(pack, offering.slug);
            return (
              <li key={offering.slug}>
                <Link
                  href={`/services/${offering.slug}`}
                  className="group grid h-full gap-5 rounded-lg border border-line bg-surface p-6 shadow-soft transition-[border-color,box-shadow] hover:border-primary hover:shadow-lift sm:grid-cols-[auto_1fr] sm:p-7"
                >
                  <span className="grid size-14 place-items-center rounded-lg bg-surface-teal text-primary">
                    <OfferingIcon name={offering.icon} className="size-8" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-display text-2xl font-semibold text-ink">{offering.name}</span>
                    <span className="mt-1 font-semibold text-accent-ink">{offering.tagline}</span>
                    <span className="mt-3 text-ink-muted">{offering.summary}</span>
                    <span className="mt-4 text-sm text-ink-muted">
                      {team.length} {team.length === 1 ? one : many} in this team
                    </span>
                    <span className="mt-4 inline-flex items-center gap-1.5 font-semibold text-primary">
                      About {offering.name.toLowerCase()}
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
            <h2 className="text-2xl">{services.notSure.title}</h2>
            <p className="mt-2 text-ink-muted">{services.notSure.body}</p>
          </div>
          <Link href="/contact" className={`${buttonClasses()} shrink-0`}>
            {pack.site.ctaLabel}
          </Link>
        </div>
      </Container>
    </>
  );
}
