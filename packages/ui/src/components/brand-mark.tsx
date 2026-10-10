import { cx } from '../cx';

/** The logo mark: a speech bubble whose sound wave leads to a single dot, the right doctor. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cx('size-9 shrink-0', className)} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="12" fill="var(--hw-primary)" />
      <path
        d="M11 13.5c0-2 1.6-3.5 3.5-3.5h11c2 0 3.5 1.6 3.5 3.5v8c0 2-1.6 3.5-3.5 3.5H18l-5 4.2V25h-.5A1.5 1.5 0 0 1 11 23.5Z"
        fill="var(--hw-on-primary)"
      />
      <path
        d="M15 18.2c1-1.6 2-1.6 3 0s2 1.6 3 0 2-1.6 3 0"
        fill="none"
        stroke="var(--hw-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="31" cy="30" r="4" fill="var(--hw-accent)" />
    </svg>
  );
}

export function BrandLockup({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="font-display text-xl leading-none font-semibold tracking-tight text-ink">{name}</span>
    </span>
  );
}
