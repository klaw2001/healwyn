'use client';

import { BRAND } from '@healwyn/core';
import { Nav } from '@healwyn/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mainNav, primaryCta } from '@/lib/site';

export function SiteNav() {
  const pathname = usePathname();
  return <Nav brandName={BRAND.name} links={mainNav} cta={primaryCta} currentPath={pathname} LinkComponent={Link} />;
}
