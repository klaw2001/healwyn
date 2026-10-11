import type { OfferingIcon as IconName } from '@healwyn/core';
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
  apartment: (
    <>
      <path d="M5 20.5V5.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15" />
      <path d="M15 10.5h3a1 1 0 0 1 1 1v9" />
      <path d="M3.5 20.5h17" />
      <path d="M8 8h1.5M11 8h1M8 11.5h1.5M11 11.5h1M8 15h1.5M11 15h1" />
      <path d="M10 20.5v-2.5" />
    </>
  ),
  villa: (
    <>
      <path d="M3.5 11 12 4.5l8.5 6.5" />
      <path d="M5.5 9.5v11h13v-11" />
      <path d="M10 20.5v-5h4v5" />
      <path d="M8 12.5h2M14 12.5h2" />
    </>
  ),
  plot: (
    <>
      <path d="M3.5 17.5 8 7l5 3 7.5-3.5-3 11-6 2Z" />
      <path d="M8 7l3.5 13.5M13 10l4.5 8" />
      <circle cx="12" cy="4.5" r="1.3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4" />
      <path d="M10.8 12.7 19.5 4" />
      <path d="M16.5 7l2.5 2.5M14.5 9l2 2" />
    </>
  ),
  office: (
    <>
      <path d="M4.5 20.5v-12l7.5-4 7.5 4v12" />
      <path d="M3 20.5h18" />
      <path d="M8.5 11h7M8.5 14h7M8.5 17h7" />
    </>
  ),
  loan: (
    <>
      <path d="M4 10.5 12 5l8 5.5" />
      <path d="M6 10.5v7M10 10.5v7M14 10.5v7M18 10.5v7" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16.5h16.5" />
      <path d="m7.5 15 4-4.5 3 3L20 7" />
      <path d="M16.5 7H20v3.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  'piggy-bank': (
    <>
      <path d="M5 11.5a6.5 5.5 0 0 1 11.6-3.4l2.9-.6-.6 3a5.6 5.6 0 0 1 .6 2.5c0 1.8-.9 3.4-2.3 4.4v2.1h-2.4v-1.2a7.8 7.8 0 0 1-3.6 0v1.2H8.8v-2.1A5.3 5.3 0 0 1 5 11.5Z" />
      <path d="M10 7.5h3.5M3 11.5h2" />
      <circle cx="15.5" cy="11" r=".6" />
    </>
  ),
  graduation: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" />
      <path d="M6.5 11.5v4c1.4 1.4 3.3 2 5.5 2s4.1-.6 5.5-2v-4" />
      <path d="M21.5 9.5v5" />
    </>
  ),
  scales: (
    <>
      <path d="M12 4v16.5M8 20.5h8M5 7h14" />
      <path d="m5 7-2.5 6a2.5 2.5 0 0 0 5 0Z" />
      <path d="m19 7-2.5 6a2.5 2.5 0 0 0 5 0Z" />
    </>
  ),
  family: (
    <>
      <circle cx="8" cy="6.5" r="2.2" />
      <circle cx="16" cy="6.5" r="2.2" />
      <circle cx="12" cy="12.5" r="1.8" />
      <path d="M4 18.5c0-3.3 1.8-6 4-6M20 18.5c0-3.3-1.8-6-4-6" />
      <path d="M9.5 20.5c0-2.4 1.1-4 2.5-4s2.5 1.6 2.5 4" />
    </>
  ),
  sofa: (
    <>
      <path d="M5.5 11V8.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V11" />
      <path d="M3.5 13a2 2 0 0 1 4 0v1.5h9V13a2 2 0 0 1 4 0v4.5h-17Z" />
      <path d="M5.5 17.5v2M18.5 17.5v2" />
    </>
  ),
  kitchen: (
    <>
      <path d="M3.5 10.5h17v10h-17Z" />
      <path d="M12 10.5v10M3.5 14.5h17" />
      <path d="M6.5 6.5h4M8.5 4v2.5M15 4.5v3.5M17.5 4.5v3.5" />
    </>
  ),
  bed: (
    <>
      <path d="M3.5 18.5v-11M3.5 14h17v4.5" />
      <path d="M20.5 14v-2a2.5 2.5 0 0 0-2.5-2.5h-7v4.5" />
      <circle cx="7" cy="11.2" r="1.7" />
    </>
  ),
  ruler: (
    <>
      <path d="m3.5 16.5 13-13 4 4-13 13Z" />
      <path d="m7 13 1.8 1.8M9.5 10.5l1.2 1.2M12 8l1.8 1.8M14.5 5.5l1.2 1.2" />
    </>
  ),
  paint: (
    <>
      <path d="M4.5 4.5h12v5h-12Z" />
      <path d="M16.5 7h2.5v5.5h-7.5v2" />
      <path d="M10.5 14.5h2v6h-2Z" />
    </>
  ),
  lamp: (
    <>
      <path d="M8 3.5h8l2.5 7h-13Z" />
      <path d="M12 10.5v8M8.5 20.5h7" />
    </>
  ),
};

export function OfferingIcon({ name, className }: { name: IconName; className?: string }) {
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
