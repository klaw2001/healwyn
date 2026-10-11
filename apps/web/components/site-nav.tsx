'use client';

import { Nav, type NavLink } from '@healwyn/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SiteNav({ brandName, links, cta }: { brandName: string; links: NavLink[]; cta: NavLink }) {
  const pathname = usePathname();
  return <Nav brandName={brandName} links={links} cta={cta} currentPath={pathname} LinkComponent={Link} />;
}
