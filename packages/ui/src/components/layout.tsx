import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('mx-auto w-full max-w-content px-4 sm:px-8', className)} {...props} />;
}

export interface SectionProps {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  tone?: 'plain' | 'muted' | 'teal';
  className?: string;
  /** Heading level for the section title. */
  as?: 'h2' | 'h3';
}

const tones = {
  plain: '',
  muted: 'bg-surface-muted',
  teal: 'bg-surface-teal',
};

/** A page section with an accessible name taken from its heading. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = 'plain',
  className,
  as: Heading = 'h2',
}: SectionProps) {
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className={cx('py-section', tones[tone], className)}>
      <Container>
        <div className="max-w-prose">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <Heading id={headingId} className="text-3xl text-ink">
            {title}
          </Heading>
          {intro ? <div className="mt-4 text-lg text-ink-muted">{intro}</div> : null}
        </div>
        {children ? <div className="mt-10 sm:mt-12">{children}</div> : null}
      </Container>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cx(
        'mb-3 flex items-center gap-2 text-sm font-semibold tracking-[0.08em] text-accent-ink uppercase',
        className,
      )}
    >
      <span aria-hidden="true" className="inline-block h-0.5 w-6 rounded-full bg-accent" />
      {children}
    </p>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-lg border border-line bg-surface p-6 shadow-soft sm:p-7', className)} {...props} />
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'teal';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-muted text-ink-muted border-line',
    accent: 'bg-accent-soft text-accent-ink border-transparent',
    teal: 'bg-primary-soft text-ink border-transparent',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
