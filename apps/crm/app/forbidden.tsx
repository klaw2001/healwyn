import { buttonClasses, Container } from '@healwyn/ui';
import Link from 'next/link';

export default function Forbidden() {
  return (
    <Container className="py-24 text-center">
      <p className="font-display text-6xl font-semibold text-primary">403</p>
      <h1 className="mt-4 text-3xl">This screen is not part of your role</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        Ask a manager if you think you need access. Everything you can work on is in your workspace.
      </p>
      <Link href="/workspace" className={`${buttonClasses()} mt-8`}>
        Go to my workspace
      </Link>
    </Container>
  );
}
