import type { ReactNode } from 'react';

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <svg aria-hidden="true" viewBox="0 0 64 64" className="size-12 text-primary">
        <circle cx="32" cy="32" r="26" fill="var(--hw-surface-teal)" />
        <path
          d="M22 33l7 7 14-15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="mt-3 font-semibold">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
