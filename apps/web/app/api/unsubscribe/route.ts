import { NextResponse, type NextRequest } from 'next/server';
import { unsubscribeWithToken } from '@/lib/server/unsubscribe';

/** RFC 8058 one-click unsubscribe: mail clients POST here from the List-Unsubscribe header. */
export async function POST(request: NextRequest) {
  const outcome = await unsubscribeWithToken(request.nextUrl.searchParams.get('token'), 'one_click');
  if (outcome === 'invalid') return new NextResponse('Invalid unsubscribe link.', { status: 400 });
  if (outcome === 'error') return new NextResponse('Could not unsubscribe. Please try again.', { status: 500 });
  return new NextResponse('Unsubscribed.', { status: 200 });
}

/** A person who opens the one-click URL in a browser gets the confirmation page. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, request.url), 303);
}
