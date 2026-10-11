import { toFormPack } from '@healwyn/core';
import { CheckIcon, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PartnerForm } from '@/components/forms/partner-form';
import { PageHeader } from '@/components/page-header';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/partners'>): Promise<Metadata> {
  const { partners } = (await pagePack(props)).site;
  return { title: partners.eyebrow, description: partners.description };
}

export default async function PartnersPage(props: PageProps<'/[industry]/partners'>) {
  const pack = await pagePack(props);
  const { brand } = pack;
  const { partners } = pack.site;
  return (
    <>
      <PageHeader eyebrow={partners.eyebrow} title={partners.title} intro={partners.intro} />
      <Container className="py-section">
        <ul className="grid gap-5 sm:grid-cols-2">
          {partners.audiences.map((audience) => (
            <li key={audience.type} className="rounded-lg border border-line bg-surface p-6 shadow-soft">
              <h2 className="text-2xl">{audience.title}</h2>
              <p className="mt-2 text-ink-muted">{audience.summary}</p>
              <ul className="mt-4 grid gap-2">
                {audience.offers.map((offer) => (
                  <li key={offer} className="flex gap-3">
                    <CheckIcon className="mt-1 shrink-0 text-primary" />
                    {offer}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Container>

      <section aria-labelledby="partner-form-title" className="border-t border-line bg-surface-muted">
        <Container className="grid gap-10 py-section lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 id="partner-form-title" className="text-3xl">
              Start a conversation
            </h2>
            <p className="mt-4 text-ink-muted">{partners.formIntro}</p>
            <p className="mt-4 text-sm text-ink-muted">
              Prefer email? Write to <span className="font-semibold text-ink">{brand.partnersEmail}</span> (placeholder
              address).
            </p>
            <Notice tone="emergency" title={partners.notPartner.title} className="mt-6">
              This form is for organisations. If you are {partners.notPartner.individual}, please use the{' '}
              <Link href="/contact" className="font-semibold underline underline-offset-4">
                contact page
              </Link>
              . {brand.emergencyNotice}
            </Notice>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-8">
            <PartnerForm pack={toFormPack(pack)} />
          </div>
        </Container>
      </section>
    </>
  );
}
