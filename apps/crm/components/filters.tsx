'use client';

import { buttonClasses, cx } from '@healwyn/ui';
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
    'min-h-10 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-primary';
  const field = 'grid min-w-0 content-end gap-1 text-sm font-semibold';

  return (
    <form onSubmit={apply} role="search" aria-label="Filter leads">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <label className={cx(field, 'col-span-2')}>
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
          <label key={definition.name} className={field}>
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
        <label className={field}>
          From
          <input name="from" type="date" defaultValue={params.get('from') ?? ''} className={control} />
        </label>
        <label className={field}>
          To
          <input name="to" type="date" defaultValue={params.get('to') ?? ''} className={control} />
        </label>
        <div className="col-span-2 flex items-end gap-2">
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
      </div>
    </form>
  );
}
