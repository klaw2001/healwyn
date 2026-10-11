import { Button, Container, Notice } from '@healwyn/ui';
import type { Metadata } from 'next';
import { packFor } from '@/lib/pack';
import { confirmUnsubscribe } from './actions';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  description: 'Stop follow-up messages from us.',
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ params: route, searchParams }: PageProps<'/[industry]/unsubscribe'>) {
  const pack = packFor((await route).industry);
  const { brand } = pack;
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <Container className="py-section">
      <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-10">
        <h1 className="text-3xl">Unsubscribe from our messages</h1>
        {error ? (
          <Notice tone="emergency" className="mt-6">
            {error === 'invalid'
              ? 'This unsubscribe link is not valid. Please use the link from your most recent message, or email us.'
              : `Something went wrong and nothing was changed. Please try again, or email ${brand.privacyEmail}.`}
          </Notice>
        ) : null}
        {token ? (
          <form action={confirmUnsubscribe} className="mt-6">
            <p className="text-ink-muted">
              We will stop sending you follow-up emails and messages straight away. If you contact us, we will still
              reply.
            </p>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="industry" value={pack.id} />
            <Button type="submit" size="lg" className="mt-6">
              Unsubscribe
            </Button>
          </form>
        ) : !error ? (
          <p className="mt-6 text-ink-muted">
            Use the unsubscribe link at the bottom of any message from us, or email {brand.privacyEmail}.
          </p>
        ) : null}
        <p className="mt-8 text-sm text-ink-muted">
          Want us to delete your details too? Email {brand.privacyEmail} and we will erase them.
        </p>
      </div>
    </Container>
  );
}
