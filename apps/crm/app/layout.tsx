import { packThemeCss } from '@healwyn/ui';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { DemoBar } from '@/components/demo-bar';
import { atkinson, fraunces } from '@/lib/fonts';
import { packFor } from '@/lib/server/pack';
import { readSession } from '@/lib/server/session';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const session = await readSession();
  const brand = session ? packFor(session).brand : null;
  const name = brand ? `${brand.name} CRM` : 'Staff CRM';
  return {
    title: { default: name, template: `%s | ${name}` },
    description: `Staff CRM for a fictional demo brand. Demo brand, all content fictional.`,
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Theme from a cookie, so the first paint is already right (no flash). The
  // signed-in staff member's industry picks the palette.
  const theme = (await cookies()).get('hw_theme')?.value;
  const session = await readSession();
  const pack = session ? packFor(session) : null;
  return (
    <html
      lang="en-IN"
      data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}
      data-industry={pack?.id}
      className={`${fraunces.variable} ${atkinson.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {pack ? (
          <style href={`theme-${pack.id}`} precedence="default">
            {packThemeCss(pack.id, pack.theme)}
          </style>
        ) : null}
        {process.env.DEMO_MODE === 'true' ? <DemoBar pack={pack} signedIn={Boolean(session)} /> : null}
        {children}
      </body>
    </html>
  );
}
