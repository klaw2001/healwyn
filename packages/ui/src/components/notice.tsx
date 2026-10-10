import type { ReactNode } from 'react';
import { cx } from '../cx';
import { AlertIcon, InfoIcon } from './icons';

export type NoticeTone = 'emergency' | 'info' | 'demo';

const tones: Record<NoticeTone, string> = {
  emergency: 'border-danger bg-danger-soft text-ink',
  info: 'border-primary bg-surface-teal text-ink',
  demo: 'border-accent bg-accent-soft text-ink',
};

/** A static callout. Not a live region: it is read in document order. */
export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'emergency' ? AlertIcon : InfoIcon;
  return (
    <div role="note" className={cx('flex gap-3 rounded-r-md border-l-4 px-4 py-3 text-sm', tones[tone], className)}>
      <Icon className={cx('mt-0.5 shrink-0 text-lg', tone === 'emergency' ? 'text-danger' : 'text-primary')} />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  );
}
