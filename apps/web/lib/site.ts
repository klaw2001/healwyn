import { BRAND } from '@healwyn/core';
import type { NavLink } from '@healwyn/ui';

export const mainNav: readonly NavLink[] = [
  { href: '/specialties', label: 'Specialties' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/health-packages', label: 'Health packages' },
  { href: '/locations', label: 'Locations' },
  { href: '/partners', label: 'For partners' },
];

export const primaryCta: NavLink = { href: '/contact', label: 'Talk to us' };

export const footerGroups = [
  {
    title: 'Care',
    links: [
      { href: '/specialties', label: 'Specialties' },
      { href: '/doctors', label: 'Doctors' },
      { href: '/health-packages', label: 'Health packages' },
      { href: '/locations', label: 'Locations' },
    ],
  },
  {
    title: 'Get in touch',
    links: [
      { href: '/contact', label: 'Contact and book' },
      { href: '/partners', label: 'For partners' },
    ],
  },
  {
    title: 'About this site',
    links: [
      { href: '/privacy', label: 'Privacy notice' },
      { href: '/terms', label: 'Terms of use' },
      { href: '/disclaimer', label: 'Demo disclaimer' },
    ],
  },
] as const;

export function pageTitle(title: string): string {
  return `${title} | ${BRAND.name}`;
}
