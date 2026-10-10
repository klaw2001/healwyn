import { Container, Eyebrow } from '@healwyn/ui';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  intro,
  children,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-surface-teal">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -top-40 -right-32 size-[30rem] text-primary opacity-[0.09]"
      >
        <circle cx="200" cy="200" r="120" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="200" cy="200" r="160" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="200" cy="200" r="198" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <Container className="relative grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-20">
        <div className="max-w-3xl">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="text-4xl text-ink">{title}</h1>
          {intro ? <div className="mt-5 max-w-2xl text-lg text-ink-muted">{intro}</div> : null}
          {children}
        </div>
        {aside ? <div className="hidden lg:block">{aside}</div> : null}
      </Container>
    </div>
  );
}
