import { BRAND } from '@healwyn/core';
import { Footer } from '@healwyn/ui';
import Link from 'next/link';
import { footerGroups } from '@/lib/site';

export function SiteFooter() {
  return (
    <Footer
      brandName={BRAND.name}
      tagline={BRAND.tagline}
      contactEmail={BRAND.contactEmail}
      groups={footerGroups}
      emergencyNotice={BRAND.emergencyNotice}
      demoNotice={BRAND.demoNotice}
      demoHref="/disclaimer"
      LinkComponent={Link}
    />
  );
}
