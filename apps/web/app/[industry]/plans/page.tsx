import { Badge, buttonClasses, CheckIcon, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { offeringName } from '@/lib/content';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/plans'>): Promise<Metadata> {
  const { plans } = (await pagePack(props)).site;
  return { title: plans.eyebrow, description: plans.description };
}

export default async function PlansPage(props: PageProps<'/[industry]/plans'>) {
  const pack = await pagePack(props);
  const { plans } = pack.site;
  return (
    <>
      <PageHeader eyebrow={plans.eyebrow} title={plans.title} intro={plans.intro} />
      <Container className="py-section">
        <Notice tone="demo" title={plans.notice.title} className="mb-10 max-w-3xl">
          {plans.notice.body}
        </Notice>
        <ul className="grid gap-6 md:grid-cols-2">
          {plans.items.map((pkg, index) => (
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
                  <Badge tone="teal">{offeringName(pack, pkg.offeringSlug)}</Badge>
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
                  href={`/contact?service=${pkg.offeringSlug}`}
                  className={`${buttonClasses({ variant: 'secondary' })} mt-5 self-start`}
                >
                  Ask about this
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
