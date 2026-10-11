import { buttonClasses, Container } from '@healwyn/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Container className="py-section text-center">
      <p className="font-display text-6xl font-semibold text-primary">404</p>
      <h1 className="mt-4 text-3xl">We could not find that page</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-muted">
        The link may be old, or the page may have moved. These might help:
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className={buttonClasses()}>
          Go to the home page
        </Link>
        <Link href="/contact" className={buttonClasses({ variant: 'secondary' })}>
          Get in touch
        </Link>
      </div>
    </Container>
  );
}
