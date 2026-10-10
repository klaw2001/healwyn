'use client';

import { cx, isCurrentPath } from '@healwyn/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

export function NavLinks({ items, compact = false }: { items: readonly NavItem[]; compact?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={cx('grid gap-1', compact && 'sm:flex sm:gap-1')}>
      {items.map((item) => {
        const current =
          isCurrentPath(item.href, pathname) || (item.href === '/pipeline' && pathname.startsWith('/leads/'));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? 'page' : undefined}
              className="flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-ink"
            >
              <span aria-hidden="true" className="text-lg">
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
