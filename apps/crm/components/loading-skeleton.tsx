export default function Loading() {
  return (
    <div className="px-4 py-6 sm:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 animate-pulse rounded bg-surface-muted" />
      <div className="mt-2 h-4 w-80 animate-pulse rounded bg-surface-muted" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
