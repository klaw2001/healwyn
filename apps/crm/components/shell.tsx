import { BRAND, can, ROLE_LABELS } from '@healwyn/core';
import { Badge, BrandMark, MenuIcon } from '@healwyn/ui';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/app/login/actions';
import type { Session } from '@/lib/server/session';
import { BoardIcon, FlowIcon, InboxIcon } from './icons';
import { NavLinks, type NavItem } from './nav-links';
import { ThemeToggle } from './theme-toggle';
import { UndoProvider } from './undo';

export async function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const theme = (await cookies()).get('hw_theme')?.value;
  const items: NavItem[] = [
    { href: '/workspace', label: 'My workspace', icon: <InboxIcon /> },
    { href: '/pipeline', label: 'Pipeline', icon: <BoardIcon /> },
    ...(can(session.role, 'screen.sequences') ? [{ href: '/sequences', label: 'Sequences', icon: <FlowIcon /> }] : []),
  ];
  const userBlock = (
    <div className="grid gap-3">
      <div>
        <p className="font-semibold">{session.name}</p>
        <Badge tone="teal" className="mt-1">
          {ROLE_LABELS[session.role]}
        </Badge>
      </div>
      <ThemeToggle initial={theme === 'light' || theme === 'dark' ? theme : 'system'} />
      <form action={signOut}>
        <button type="submit" className="text-sm font-semibold text-primary underline underline-offset-4">
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <UndoProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-5 py-3 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-surface-muted lg:flex lg:flex-col lg:justify-between lg:p-5">
          <div>
            <Link href="/workspace" className="flex items-center gap-2.5 rounded-md">
              <BrandMark className="size-8" />
              <span className="font-display text-lg leading-tight font-semibold">
                {BRAND.shortName}
                <span className="block font-sans text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
                  Staff CRM
                </span>
              </span>
            </Link>
            <nav aria-label="CRM" className="mt-8">
              <NavLinks items={items} />
            </nav>
          </div>
          <div className="border-t border-line pt-5">
            {userBlock}
            <p className="mt-5 text-xs text-ink-muted">{BRAND.demoNotice}</p>
          </div>
        </aside>

        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur lg:hidden">
          <Link href="/workspace" className="flex items-center gap-2 rounded-md">
            <BrandMark className="size-8" />
            <span className="font-display font-semibold">{BRAND.shortName} CRM</span>
          </Link>
          <details className="group relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-semibold [&::-webkit-details-marker]:hidden">
              <MenuIcon className="text-lg" />
              Menu
            </summary>
            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-line bg-surface p-4 shadow-lift">
              <nav aria-label="CRM">
                <NavLinks items={items} />
              </nav>
              <div className="mt-4 border-t border-line pt-4">{userBlock}</div>
            </div>
          </details>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 focus:outline-none">
          {children}
        </main>
      </div>
    </UndoProvider>
  );
}

export function PageTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
