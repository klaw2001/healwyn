import type { SpecialtyIcon as IconName } from '@healwyn/core';
import type { ReactNode } from 'react';

const paths: Record<IconName, ReactNode> = {
  stethoscope: (
    <>
      <path d="M6 3.5H5a1 1 0 0 0-1 1V9a5 5 0 0 0 10 0V4.5a1 1 0 0 0-1-1h-1" />
      <path d="M9 14v1.5a5 5 0 0 0 10 0V13" />
      <circle cx="19" cy="11" r="2" />
    </>
  ),
  skin: (
    <>
      <path d="M12 3.5c3 3.6 5.5 6.8 5.5 10a5.5 5.5 0 0 1-11 0c0-3.2 2.5-6.4 5.5-10Z" />
      <path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.5" />
      <path d="M19 3v3M17.5 4.5h3" />
    </>
  ),
  tooth: (
    <path d="M7.5 3.5c-2.4 0-3.8 1.9-3.8 4.4 0 2 .9 3.5 1.4 5.2.6 2 .7 4.6 1.5 6.4.4.9 1.7.9 2 0l1.2-4c.2-.8 1.4-.8 1.6 0l1.2 4c.3.9 1.6.9 2 0 .8-1.8.9-4.4 1.5-6.4.5-1.7 1.4-3.2 1.4-5.2 0-2.5-1.4-4.4-3.8-4.4-1.7 0-2.6 1-4.5 1s-2.8-1-4.5-1Z" />
  ),
  movement: (
    <>
      <circle cx="13.5" cy="4.5" r="1.8" />
      <path d="M5 9.5 9.5 8l4 1.5 3.5-2.5" />
      <path d="M13.5 9.5 12 14l4 3v4" />
      <path d="M12 14l-3.5 2.5-3 4.5" />
    </>
  ),
  'womens-health': (
    <>
      <path d="M12 20.5c-4.6 0-8-3-8.5-7.5 2.6 0 4.9 1 6.4 2.8" />
      <path d="M12 20.5c4.6 0 8-3 8.5-7.5-2.6 0-4.9 1-6.4 2.8" />
      <path d="M12 20.5c-2.6-2.2-3.9-5-3.9-8.2S9.4 6.3 12 4c2.6 2.3 3.9 5.1 3.9 8.3s-1.3 6-3.9 8.2Z" />
    </>
  ),
  diagnostics: (
    <>
      <path d="M9 3.5h4M11 3.5V6" />
      <path d="m9.6 6.5 3.4 0-.6 7h-2.2Z" />
      <path d="M8 20.5h12" />
      <path d="M14.5 10.5a5 5 0 0 1 1.5 9.9" />
      <path d="M8.5 17h4.5" />
    </>
  ),
};

export function SpecialtyIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
