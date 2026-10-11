import { toFormPack } from '@healwyn/core';
import { Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AssistantLauncher } from '@/components/assistant/assistant-widget';
import { PatientForm } from '@/components/forms/patient-form';
import { PageHeader } from '@/components/page-header';
import { assistantView } from '@/lib/assistant-view';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/contact'>): Promise<Metadata> {
  const { contact } = (await pagePack(props)).site;
  return { title: contact.eyebrow, description: contact.description };
}

export default async function ContactPage(props: PageProps<'/[industry]/contact'>) {
  const pack = await pagePack(props);
  const { brand, site } = pack;
  const { contact } = site;
  const successSteps = [
    ...contact.steps.map((step) => step.body),
    'If you agreed to a call from our AI assistant, it may call first, between 9am and 9pm, to ask a few short questions.',
  ];
  return (
    <>
      <PageHeader eyebrow={contact.eyebrow} title={contact.title} intro={contact.intro} />
      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <div>
          <Notice tone="emergency" title="Not for emergencies" className="mb-8">
            {brand.emergencyNotice}
          </Notice>
          <div className="mb-8 flex flex-col gap-4 rounded-xl border border-line bg-surface-teal p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-xl">Prefer to talk?</h2>
              <p className="mt-1 text-ink-muted">{contact.assistantBody}</p>
            </div>
            <AssistantLauncher view={assistantView(pack)} className="shrink-0" />
          </div>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-8">
            <PatientForm pack={toFormPack(pack)} successSteps={successSteps} />
          </div>
        </div>

        <aside aria-labelledby="next-steps-title" className="lg:pt-2">
          <div className="lg:sticky lg:top-28">
            <h2 id="next-steps-title" className="text-2xl">
              What happens next
            </h2>
            <ol className="mt-6 grid gap-6">
              {contact.steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display font-semibold text-on-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-sans font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 rounded-lg bg-surface-teal p-5 text-sm">
              <h2 className="font-sans text-base font-semibold">Your privacy</h2>
              <p className="mt-2 text-ink-muted">
                We ask only for what we need to respond. You can withdraw consent at any time and we will delete your
                details. Read the{' '}
                <Link href="/privacy" className="font-semibold text-primary underline underline-offset-4">
                  privacy notice
                </Link>
                .
              </p>
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              Representing an organisation?{' '}
              <Link href="/partners" className="font-semibold text-primary underline underline-offset-4">
                Partner enquiries
              </Link>
            </p>
          </div>
        </aside>
      </Container>
    </>
  );
}
