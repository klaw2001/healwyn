import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/'];

/**
 * Sends anyone without a session cookie to sign in. Pages and actions still
 * verify the session themselves; this only saves a round trip.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return NextResponse.next();
  if (!request.cookies.has('hw_crm_session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'],
};
