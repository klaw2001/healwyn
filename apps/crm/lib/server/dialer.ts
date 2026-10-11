import 'server-only';
import { getActivePack, simulatedCallerTurns } from '@healwyn/core';
import { AgentDispatchClient, SipClient } from 'livekit-server-sdk';
import { signRequest } from './webhooks';

const pack = getActivePack();

/** The call rules the start_call SQL function enforces, from the pack. */
export function callRules(channel: 'phone' | 'simulated') {
  const { limits, callConsentId } = pack.voice;
  return {
    consent_purpose: callConsentId,
    max_per_day: limits.maxCallsPerDay,
    // The 9am-9pm window protects people from calls at night; a simulated call rings nobody,
    // so it runs every other check (consent, opt-out, daily cap) at any hour.
    window_start: channel === 'phone' ? limits.callWindow.startHour : 0,
    window_end: channel === 'phone' ? limits.callWindow.endHour : 24,
    time_zone: limits.callWindow.timeZone,
    // A Twilio trial trunk can only call verified numbers.
    require_verified: channel === 'phone',
  };
}

/** Real phone calls need a LiveKit SIP outbound trunk (see docs/VOICE.md); without one, only simulated calls. */
export function telephonyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.LIVEKIT_SIP_TRUNK_ID && env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

/**
 * Runs a simulated call through the agent's text service: the same intake
 * engine and the same webhook as a real call, with the caller's lines taken
 * from what the lead wrote on the form.
 */
export async function runSimulatedCall(call: {
  callId: string;
  leadId: string;
  language: string;
  answers: Record<string, string>;
  message: string | null;
}): Promise<{ outcome: string; posted: number }> {
  const secret = process.env.VOICE_AGENT_SECRET ?? '';
  const base = (process.env.VOICE_TEXT_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
  const body = JSON.stringify({
    callId: call.callId,
    leadId: call.leadId,
    language: call.language,
    turns: simulatedCallerTurns(pack, { answers: call.answers, message: call.message, language: call.language }),
  });
  const response = await fetch(`${base}/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signRequest(body, secret) },
    body,
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`text service responded ${response.status}`);
  return (await response.json()) as { outcome: string; posted: number };
}

/**
 * Places a real outbound call: dispatches the intake agent into a new room,
 * then asks LiveKit SIP to dial the number into that room. Untested without a
 * trunk; see docs/VOICE.md for the setup this expects.
 */
export async function placePhoneCall(call: { callId: string; leadId: string; language: string; phone: string }) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_SIP_TRUNK_ID } = process.env;
  const host = LIVEKIT_URL!.replace(/^wss:/, 'https:');
  const room = `call-${call.callId}`;
  const agentName = process.env.VOICE_AGENT_NAME || 'healwyn-intake';
  await new AgentDispatchClient(host, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).createDispatch(room, agentName, {
    metadata: JSON.stringify({ callId: call.callId, leadId: call.leadId, language: call.language, channel: 'phone' }),
  });
  await new SipClient(host, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).createSipParticipant(
    LIVEKIT_SIP_TRUNK_ID!,
    call.phone,
    room,
    { participantIdentity: `phone-${call.callId.slice(0, 8)}`, participantName: 'Caller' },
  );
}
