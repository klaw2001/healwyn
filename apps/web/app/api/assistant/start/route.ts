import { NextResponse, type NextRequest } from 'next/server';
import { CALL_COOKIE, CALL_COOKIE_MAX_AGE_SECONDS, callCookieValue, startAssistant } from '@/lib/server/assistant';
import { defaultAssistantDeps } from '@/lib/server/assistant-deps';
import { readBodyLimited } from '@/lib/server/body';

const MAX_BODY = 4 * 1024;

/** Starts a call with the AI assistant: creates the lead, then a voice room or a typed chat. */
export async function POST(request: NextRequest) {
  const raw = await readBodyLimited(request, MAX_BODY);
  if (raw === null) return NextResponse.json({ status: 'error', message: 'Too large.' }, { status: 413 });
  let values: Record<string, unknown>;
  try {
    values = JSON.parse(raw) as Record<string, unknown>;
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('shape');
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid request.' }, { status: 400 });
  }
  const result = await startAssistant(values, request.headers, defaultAssistantDeps());
  if (result.status === 'voice' || result.status === 'text') {
    const { leadId, ...publicResult } = result;
    const response = NextResponse.json(publicResult);
    response.cookies.set(CALL_COOKIE, callCookieValue(result.callId, leadId), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/assistant',
      maxAge: CALL_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  }
  return NextResponse.json(result, { status: result.status === 'invalid' ? 422 : 503 });
}
