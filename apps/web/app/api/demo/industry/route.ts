import { isKnownIndustryId } from '@healwyn/core/ids';
import { NextResponse, type NextRequest } from 'next/server';
import { INDUSTRY_COOKIE } from '@/lib/industry-cookie';

/**
 * The demo bar's industry switch (DEMO_MODE=true only): remembers the choice in
 * a cookie, which proxy.ts reads, and goes back to the page the visitor was on.
 */
export function GET(request: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') return new NextResponse('Not found.', { status: 404 });
  const industry = request.nextUrl.searchParams.get('i');
  if (!isKnownIndustryId(industry)) return new NextResponse('Unknown industry.', { status: 400 });

  // Back to the same page on this site; anything else goes home.
  let next = '/';
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const from = new URL(referer);
      if (from.host === request.nextUrl.host && !from.pathname.startsWith('/api/')) next = from.pathname;
    } catch {
      // Ignore a malformed referer.
    }
  }
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(INDUSTRY_COOKIE, industry, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600,
  });
  return response;
}
