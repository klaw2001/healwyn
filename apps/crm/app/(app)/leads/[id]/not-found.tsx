import { buttonClasses } from '@healwyn/ui';
import Link from 'next/link';

export default function LeadNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-3xl">This lead is not available to you</h1>
      <p className="mt-3 text-ink-muted">It may be assigned to another team, or the link may be wrong.</p>
      <Link href="/pipeline" className={`${buttonClasses()} mt-6`}>
        Back to the pipeline
      </Link>
    </div>
  );
}
