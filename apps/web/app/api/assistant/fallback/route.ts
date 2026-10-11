import { NextResponse, type NextRequest } from 'next/server';
import { CALL_COOKIE, readCallCookie } from '@/lib/server/assistant';
import { errorFields, log } from '@/lib/server/log';
import { textService } from '@/lib/server/voice-service';

/** The microphone was refused or the voice call could not connect: continue the same call by typing. */
export async function POST(request: NextRequest) {
  const call = readCallCookie(request.cookies.get(CALL_COOKIE)?.value);
  if (!call) return NextResponse.json({ error: 'no_call' }, { status: 401 });
  let language = 'en';
  try {
    const body = (await request.json()) as { language?: unknown };
    if (typeof body.language === 'string' && /^[a-z]{2}$/.test(body.language)) language = body.language;
  } catch {
    /* default language */
  }
  try {
    const started = await textService().start({ callId: call.callId, leadId: call.leadId, channel: 'text', language });
    log.info('assistant.fallback_to_text', { callId: call.callId });
    return NextResponse.json({ status: 'text', ...started });
  } catch (error) {
    log.warn('assistant.fallback_failed', { callId: call.callId, ...errorFields(error) });
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
