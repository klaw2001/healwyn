import { isKnownIndustryId } from '@healwyn/core/ids';
import { NextResponse, type NextRequest } from 'next/server';
import { INDUSTRY_COOKIE } from './lib/industry-cookie';

/**
 * Every public page exists once per industry pack, under /<industry>/… (statically
 * generated). This picks the industry for a request and rewrites to it, so the
 * visitor's URL stays clean (/contact):
 * - in a demo (DEMO_MODE=true), the industry chosen in the demo bar (a cookie);
 * - otherwise INDUSTRY, else the clinic;
 * - unsubscribe, booking and payment links name the lead's own industry (`?i=`), so the page shows its brand.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  let industry = isKnownIndustryId(process.env.INDUSTRY) ? process.env.INDUSTRY : 'clinic';
  const chosen = request.cookies.get(INDUSTRY_COOKIE)?.value;
  if (process.env.DEMO_MODE === 'true' && isKnownIndustryId(chosen)) industry = chosen;
  if (url.pathname.startsWith('/unsubscribe') || url.pathname === '/book' || url.pathname === '/pay') {
    const named = url.searchParams.get('i');
    if (isKnownIndustryId(named)) industry = named;
  }
  url.pathname = `/${industry}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages only: not the API, Next's assets, or files with an extension (icon.svg, robots.txt).
  matcher: ['/((?!api/|_next/|.*\\.[a-z0-9]+$).*)'],
};
