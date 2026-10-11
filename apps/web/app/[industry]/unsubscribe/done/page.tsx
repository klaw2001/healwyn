import { CheckIcon, Container } from '@healwyn/ui';
import type { Metadata } from 'next';
import { pagePack } from '@/lib/pack';

export const metadata: Metadata = {
  title: 'You are unsubscribed',
  robots: { index: false, follow: false },
};

export default async function UnsubscribedPage(props: PageProps<'/[industry]/unsubscribe/done'>) {
  const { brand } = await pagePack(props);
  return (
    <Container className="py-section">
      <div className="mx-auto max-w-xl rounded-xl border border-success bg-success-soft p-6 sm:p-10" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-success text-surface">
          <CheckIcon className="text-2xl" />
        </span>
        <h1 className="mt-5 text-3xl">You are unsubscribed</h1>
        <p className="mt-3 text-lg">We will not send you any more follow-up messages. This took effect immediately.</p>
        <p className="mt-6 text-sm text-ink-muted">
          Changed your mind, or want your details deleted? Email {brand.privacyEmail}.
        </p>
      </div>
    </Container>
  );
}
