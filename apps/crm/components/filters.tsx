'use client';

import { buttonClasses } from '@healwyn/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  name: string;
  label: string;
  options: readonly FilterOption[];
}

const FILTER_KEYS = ['q', 'assignee', 'specialty', 'language', 'urgency', 'source', 'from', 'to', 'type'];

/** Filters live in the URL, so views can be bookmarked and shared, and work without JavaScript. */
export function Filters({ definitions }: { definitions: readonly FilterDefinition[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const data = new FormData(event.currentTarget);
    for (const key of FILTER_KEYS) {
      const value = String(data.get(key) ?? '').trim();
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const active = FILTER_KEYS.filter((key) => params.get(key)).length;
  const control =
    'min-h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-primary';

  return (
    <form onSubmit={apply} role="search" aria-label="Filter leads" className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-52 flex-1 gap-1 text-sm font-semibold">
          Search
          <input
            name="q"
            type="search"
            defaultValue={params.get('q') ?? ''}
            placeholder="Name, phone or email"
            className={control}
          />
        </label>
        {definitions.map((definition) => (
          <label key={definition.name} className="grid gap-1 text-sm font-semibold">
            {definition.label}
            <select name={definition.name} defaultValue={params.get(definition.name) ?? ''} className={control}>
              <option value="">Any</option>
              {definition.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="grid gap-1 text-sm font-semibold">
          From
          <input name="from" type="date" defaultValue={params.get('from') ?? ''} className={control} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          To
          <input name="to" type="date" defaultValue={params.get('to') ?? ''} className={control} />
        </label>
        <button type="submit" className={buttonClasses({ size: 'sm' })} disabled={pending}>
          {pending ? 'Filtering…' : 'Apply'}
        </button>
        {active ? (
          <button
            type="button"
            className={buttonClasses({ size: 'sm', variant: 'ghost' })}
            onClick={() => {
              const next = new URLSearchParams(params);
              FILTER_KEYS.forEach((key) => next.delete(key));
              startTransition(() => router.push(`${pathname}?${next.toString()}`));
            }}
          >
            Clear {active} filter{active === 1 ? '' : 's'}
          </button>
        ) : null}
      </div>
    </form>
  );
}
