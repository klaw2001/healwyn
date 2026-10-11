import { buttonClasses, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LocationMap } from '@/components/illustrations/location-map';
import { PageHeader } from '@/components/page-header';
import { offeringName } from '@/lib/content';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/locations'>): Promise<Metadata> {
  const { locations } = (await pagePack(props)).site;
  return { title: locations.eyebrow, description: locations.description };
}

export default async function LocationsPage(props: PageProps<'/[industry]/locations'>) {
  const pack = await pagePack(props);
  const { locations } = pack.site;
  return (
    <>
      <PageHeader eyebrow={locations.eyebrow} title={locations.title} intro={locations.intro} />
      <Container className="py-section">
        <Notice tone="demo" className="mb-10 max-w-3xl">
          {locations.notice}
        </Notice>
        <ul className="grid gap-8 lg:grid-cols-2">
          {locations.items.map((location, index) => (
            <li key={location.id}>
              <article
                aria-labelledby={`location-${location.id}`}
                className="h-full overflow-hidden rounded-xl border border-line bg-surface shadow-soft"
              >
                <LocationMap variant={index % 2 === 0 ? 'lake' : 'river'} className="h-44 w-full sm:h-52" />
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
                    {locations.offeringsLabel}
                  </h3>
                  <p className="mt-2">{location.offerings.map((slug) => offeringName(pack, slug)).join(', ')}</p>

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
          <Link href="/book" className={buttonClasses({ size: 'lg' })}>
            Book a {pack.booking.noun}
          </Link>
        </div>
      </Container>
    </>
  );
}
