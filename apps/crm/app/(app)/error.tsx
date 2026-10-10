'use client';

import { Button } from '@healwyn/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-3xl">This screen did not load</h1>
      <p className="mt-3 text-ink-muted">
        Something went wrong on our side. Nothing you were working on has been lost. Try again, and if it keeps
        happening, tell your manager.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
