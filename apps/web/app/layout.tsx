import { BRAND } from '@healwyn/core';
import { SkipLink } from '@healwyn/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteNav } from '@/components/site-nav';
import { atkinson, fraunces } from '@/lib/fonts';
import './globals.css';

const allowIndexing = process.env.ALLOW_INDEXING === 'true';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: { default: `${BRAND.name}: ${BRAND.tagline}`, template: `%s | ${BRAND.name}` },
  description: `${BRAND.name} (a fictional demo brand) matches you with the right doctor's team from your first call. ${BRAND.demoNotice}.`,
  applicationName: BRAND.name,
  // A fictional clinic must not be mistaken for a real one in search results.
  robots: allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { siteName: BRAND.name, type: 'website', locale: 'en_IN' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1918' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${atkinson.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <SkipLink />
        <SiteNav />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
