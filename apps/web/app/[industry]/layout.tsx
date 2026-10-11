import { packThemeCss, SkipLink } from '@healwyn/ui';
import type { Metadata, Viewport } from 'next';
import { DemoBar } from '@/components/demo-bar';
import { SiteFooter } from '@/components/site-footer';
import { SiteNav } from '@/components/site-nav';
import { atkinson, fraunces } from '@/lib/fonts';
import { industryParams, packFor } from '@/lib/pack';
import { mainNav, primaryCta } from '@/lib/site';
import '../globals.css';

const allowIndexing = process.env.ALLOW_INDEXING === 'true';

// One static copy of the site per industry pack; proxy.ts picks which one a request sees.
export const dynamicParams = false;
export function generateStaticParams() {
  return industryParams();
}

export async function generateMetadata({ params }: LayoutProps<'/[industry]'>): Promise<Metadata> {
  const { brand } = packFor((await params).industry);
  return {
    metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
    title: { default: `${brand.name}: ${brand.tagline}`, template: `%s | ${brand.name}` },
    description: `${brand.name} (a fictional demo brand): ${brand.tagline} ${brand.demoNotice}.`,
    applicationName: brand.name,
    // A fictional brand must not be mistaken for a real one in search results.
    robots: allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { siteName: brand.name, type: 'website', locale: 'en_IN' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1918' },
  ],
};

export default async function RootLayout({ children, params }: LayoutProps<'/[industry]'>) {
  const pack = packFor((await params).industry);
  return (
    <html lang="en-IN" data-industry={pack.id} className={`${fraunces.variable} ${atkinson.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <style href={`theme-${pack.id}`} precedence="default">
          {packThemeCss(pack.id, pack.theme)}
        </style>
        <SkipLink />
        {process.env.DEMO_MODE === 'true' ? <DemoBar pack={pack} /> : null}
        <SiteNav brandName={pack.brand.name} links={mainNav(pack)} cta={primaryCta(pack)} />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter pack={pack} />
      </body>
    </html>
  );
}
