import { voiceCallResultSchema, VoiceResultError, type VoiceCallResult } from '@healwyn/core';
import { NextResponse, type NextRequest } from 'next/server';
import { readBodyLimited } from '@/lib/server/body';
import { applyVoiceResult, failVoiceCall } from '@/lib/server/voice';
import { verifySignedRequest } from '@/lib/server/webhooks';

/** Generous for a five-minute call (200 transcript lines at most); anything bigger is refused unread. */
const MAX_BODY_BYTES = 256 * 1024;

function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}) {
  // Ids, codes and counts only: never transcripts, summaries, answers or names.
  const line = JSON.stringify({ level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

/**
 * The voice agent posts each finished call here. Signed with HMAC-SHA256 over
 * `${timestamp}.${body}` (VOICE_WEBHOOK_SECRET); requests older than five
 * minutes are refused, and a replayed call changes nothing (idempotent on
 * callId). The call must have been started through the website or the dialer.
 */
export async function POST(request: NextRequest) {
  const raw = await readBodyLimited(request, MAX_BODY_BYTES);
  if (raw === null) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const check = verifySignedRequest(raw, request.headers, process.env.VOICE_WEBHOOK_SECRET);
  if (!check.ok) {
    log('warn', 'voice.webhook_rejected', { reason: check.reason });
    return NextResponse.json({ error: check.reason }, { status: check.reason === 'not_configured' ? 503 : 401 });
  }

  let result: VoiceCallResult;
  try {
    result = voiceCallResultSchema.parse(JSON.parse(raw));
  } catch {
    log('warn', 'voice.webhook_invalid');
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const outcome = await applyVoiceResult(result);
    log('info', 'voice.call_recorded', {
      callId: result.callId,
      status: outcome.status,
      outcome: result.outcome,
      channel: result.channel,
      durationSeconds: result.durationSeconds,
      flags: result.safetyFlags.length,
      routed: Boolean(outcome.assignedStaffId),
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    if (error instanceof VoiceResultError) {
      // Signed by our agent but not acceptable for the pack (e.g. the voice script and the pack drifted):
      // close the call as failed so it does not stay "started", and say so on the lead's timeline.
      log('warn', 'voice.webhook_invalid', { callId: result.callId });
      await failVoiceCall(result.callId, result.leadId, 'invalid_result').catch(() => undefined);
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const code = (error as { code?: string }).code;
    if (code === 'P0002' || code === '55000') {
      // Unknown call, unknown or erased lead: one answer for all, revealing nothing.
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    log('error', 'voice.webhook_failed', { callId: result.callId, error: (error as Error).name, code });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
