import { BRAND } from '@healwyn/core';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { atkinson, fraunces } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `CRM | ${BRAND.name}`, template: `%s | ${BRAND.name} CRM` },
  description: `${BRAND.name} staff CRM. ${BRAND.demoNotice}.`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Theme from a cookie, so the first paint is already right (no flash).
  const theme = (await cookies()).get('hw_theme')?.value;
  return (
    <html
      lang="en-IN"
      data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}
      className={`${fraunces.variable} ${atkinson.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
