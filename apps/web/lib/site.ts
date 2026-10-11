import type { IndustryPack } from '@healwyn/core';
import type { NavLink } from '@healwyn/ui';

/** Routes shared by every industry; the labels come from the pack. */
export function mainNav(pack: IndustryPack): NavLink[] {
  const { nav } = pack.site;
  return [
    { href: '/services', label: nav.services },
    { href: '/team', label: nav.team },
    { href: '/plans', label: nav.plans },
    { href: '/locations', label: nav.locations },
    { href: '/partners', label: nav.partners },
  ];
}

export function primaryCta(pack: IndustryPack): NavLink {
  return { href: '/contact', label: pack.site.ctaLabel };
}

export function footerGroups(pack: IndustryPack) {
  const { nav } = pack.site;
  return [
    {
      title: 'Explore',
      links: [
        { href: '/services', label: nav.services },
        { href: '/team', label: nav.team },
        { href: '/plans', label: nav.plans },
        { href: '/locations', label: nav.locations },
      ],
    },
    {
      title: 'Get in touch',
      links: [
        { href: '/contact', label: pack.site.contact.eyebrow },
        { href: '/book', label: `Book a ${pack.booking.noun}` },
        { href: '/partners', label: nav.partners },
      ],
    },
    {
      title: 'About this site',
      links: [
        { href: '/case-study', label: 'How this demo was built' },
        { href: '/privacy', label: 'Privacy notice' },
        { href: '/terms', label: 'Terms of use' },
        { href: '/disclaimer', label: 'Demo disclaimer' },
      ],
    },
  ];
}
