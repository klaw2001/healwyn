import type { ComponentType, ReactNode } from 'react';
import { cx } from '../cx';
import { BrandLockup } from './brand-mark';
import { buttonClasses } from './button';
import { CloseIcon, MenuIcon } from './icons';
import { Container } from './layout';
import { Notice } from './notice';

export interface NavLink {
  href: string;
  label: string;
}

/** Any anchor-like component, e.g. Next.js <Link>. Defaults to a plain <a>. */
export type LinkComponent = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
  'aria-current'?: 'page';
  'aria-label'?: string;
}>;

const PlainLink: LinkComponent = ({ children, ...props }) => <a {...props}>{children}</a>;

export function isCurrentPath(href: string, currentPath: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export interface NavProps {
  brandName: string;
  links: readonly NavLink[];
  cta: NavLink;
  currentPath: string;
  LinkComponent?: LinkComponent;
}

/**
 * Site header. The mobile menu is a native <details> disclosure, so it works
 * without JavaScript; it is keyed by path so it closes after navigation.
 */
export function Nav({ brandName, links, cta, currentPath, LinkComponent: Link = PlainLink }: NavProps) {
  const linkClass =
    'block rounded-full px-3 py-2 font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink aria-[current=page]:bg-surface-muted aria-[current=page]:text-ink';
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-md">
      <Container className="relative flex h-16 items-center justify-between gap-4 lg:h-18">
        <Link href="/" aria-label={`${brandName}, home`} className="rounded-lg">
          <BrandLockup name={brandName} />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-0.5 text-[0.95rem]">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={linkClass}
                  aria-current={isCurrentPath(link.href, currentPath) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden lg:block">
          <Link href={cta.href} className={buttonClasses({ size: 'sm' })}>
            {cta.label}
          </Link>
        </div>

        <details key={currentPath} className="group lg:hidden">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <MenuIcon className="text-lg group-open:hidden" />
            <CloseIcon className="hidden text-lg group-open:block" />
            <span>Menu</span>
          </summary>
          <div className="absolute inset-x-0 top-full border-b border-line bg-bg shadow-lift">
            <Container className="py-4">
              <nav aria-label="Main">
                <ul className="grid gap-1 text-lg">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={cx(linkClass, 'rounded-md px-4 py-3')}
                        aria-current={isCurrentPath(link.href, currentPath) ? 'page' : undefined}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <Link href={cta.href} className={cx(buttonClasses({ fullWidth: true }), 'mt-4')}>
                {cta.label}
              </Link>
            </Container>
          </div>
        </details>
      </Container>
    </header>
  );
}

export interface FooterProps {
  brandName: string;
  tagline: string;
  contactEmail: string;
  groups: readonly { title: string; links: readonly NavLink[] }[];
  emergencyNotice: string;
  demoNotice: string;
  demoHref: string;
  LinkComponent?: LinkComponent;
}

/** Site footer, always carrying the emergency notice and the demo notice. */
export function Footer({
  brandName,
  tagline,
  contactEmail,
  groups,
  emergencyNotice,
  demoNotice,
  demoHref,
  LinkComponent: Link = PlainLink,
}: FooterProps) {
  return (
    <footer className="mt-auto border-t border-line bg-surface-muted">
      <Container className="py-12 sm:py-16">
        <Notice tone="emergency" title="Not for emergencies" className="max-w-3xl">
          {emergencyNotice}
        </Notice>

        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <BrandLockup name={brandName} />
            <p className="mt-4 font-display text-lg text-ink">{tagline}</p>
            <p className="mt-3 text-sm text-ink-muted">
              Write to us at <span className="font-semibold break-all text-ink">{contactEmail}</span> (placeholder
              address).
            </p>
          </div>
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">
                {group.title}
              </h2>
              <ul className="mt-4 grid gap-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-ink">{demoNotice}</span>
            <Link href={demoHref} className="underline underline-offset-4 hover:text-ink">
              Read the demo disclaimer
            </Link>
          </p>
          <p>
            © {new Date().getFullYear()} {brandName} (fictional)
          </p>
        </div>
      </Container>
    </footer>
  );
}

export function SkipLink({ href = '#main', children = 'Skip to content' }: { href?: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      className="sr-only z-50 rounded-full bg-primary px-5 py-3 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      {children}
    </a>
  );
}
