import { NextResponse, type NextRequest } from 'next/server';
import { CALL_COOKIE, callCookieValue, startAssistant } from '@/lib/server/assistant';
import { defaultAssistantDeps } from '@/lib/server/assistant-deps';

const MAX_BODY = 4 * 1024;

/** Starts a call with the AI assistant: creates the lead, then a voice room or a typed chat. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ status: 'error', message: 'Too large.' }, { status: 413 });
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
      maxAge: 20 * 60,
    });
    return response;
  }
  return NextResponse.json(result, { status: result.status === 'invalid' ? 422 : 503 });
}
