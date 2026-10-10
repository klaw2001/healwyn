'use client';

import { Button } from '@healwyn/ui';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setSequencePaused } from '../actions';

export function PauseToggle({ sequenceId, name, paused }: { sequenceId: string; name: string; paused: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant={paused ? 'primary' : 'secondary'}
      disabled={pending}
      aria-pressed={paused}
      onClick={() =>
        start(async () => {
          const result = await setSequencePaused(sequenceId, !paused);
          if (result.ok) router.refresh();
        })
      }
    >
      {pending ? 'Saving…' : paused ? 'Resume' : 'Pause'}
      <span className="sr-only"> {name}</span>
    </Button>
  );
}
