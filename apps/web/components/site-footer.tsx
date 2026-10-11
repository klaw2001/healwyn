import type { IndustryPack } from '@healwyn/core';
import { Footer } from '@healwyn/ui';
import Link from 'next/link';
import { footerGroups } from '@/lib/site';

export function SiteFooter({ pack }: { pack: IndustryPack }) {
  const { brand } = pack;
  return (
    <Footer
      brandName={brand.name}
      tagline={brand.tagline}
      contactEmail={brand.contactEmail}
      groups={footerGroups(pack)}
      emergencyNotice={brand.emergencyNotice}
      regulatoryNotice={brand.regulatoryNotice}
      demoNotice={brand.demoNotice}
      demoHref="/disclaimer"
      LinkComponent={Link}
    />
  );
}
