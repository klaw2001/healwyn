import { NextResponse, type NextRequest } from 'next/server';
import { CALL_COOKIE, readCallCookie } from '@/lib/server/assistant';
import { textService } from '@/lib/server/voice-service';

/** The visitor ends a typed chat. What was said so far still reaches the care team. */
export async function POST(request: NextRequest) {
  const call = readCallCookie(request.cookies.get(CALL_COOKIE)?.value);
  const response = NextResponse.json({ ended: true });
  response.cookies.delete({ name: CALL_COOKIE, path: '/api/assistant' });
  if (call) {
    try {
      await textService().end(call.callId);
    } catch {
      // Already ended (or a voice call, which the agent finishes itself).
    }
  }
  return response;
}
