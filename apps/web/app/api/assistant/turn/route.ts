import { NextResponse, type NextRequest } from 'next/server';
import { CALL_COOKIE, readCallCookie } from '@/lib/server/assistant';
import { log, errorFields } from '@/lib/server/log';
import { TextServiceError, textService } from '@/lib/server/voice-service';

/** One typed message to the assistant. Only the browser that started the call can continue it. */
export async function POST(request: NextRequest) {
  const call = readCallCookie(request.cookies.get(CALL_COOKIE)?.value);
  if (!call) return NextResponse.json({ error: 'no_call' }, { status: 401 });
  let text = '';
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === 'string' ? body.text.slice(0, 1000) : '';
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const reply = await textService().turn(call.callId, text);
    const response = NextResponse.json(reply);
    if (reply.ended) response.cookies.delete({ name: CALL_COOKIE, path: '/api/assistant' });
    return response;
  } catch (error) {
    const status = error instanceof TextServiceError && error.status === 404 ? 410 : 503;
    log.warn('assistant.turn_failed', { callId: call.callId, status, ...errorFields(error) });
    return NextResponse.json({ error: status === 410 ? 'call_ended' : 'unavailable' }, { status });
  }
}
