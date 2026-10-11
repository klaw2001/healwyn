import 'server-only';
import { signServiceRequest } from '@healwyn/messaging';
import { AccessToken, RoomAgentDispatch, RoomConfiguration, TrackSource } from 'livekit-server-sdk';
import type { AssistantDeps, TextService } from './assistant';

export class TextServiceError extends Error {
  constructor(readonly status: number) {
    super(`text service responded ${status}`);
    this.name = 'TextServiceError';
  }
}

export function textService(env: NodeJS.ProcessEnv = process.env): TextService {
  const base = (env.VOICE_TEXT_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
  const secret = env.VOICE_AGENT_SECRET ?? '';
  async function post<T>(path: string, body: object): Promise<T> {
    const raw = JSON.stringify(body);
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signServiceRequest('POST', path, raw, secret) },
      body: raw,
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new TextServiceError(response.status);
    return (await response.json()) as T;
  }
  return {
    start: (body) => post('/sessions', body),
    turn: (callId, text) => post(`/sessions/${callId}/turns`, { text }),
    end: async (callId) => {
      await post(`/sessions/${callId}/end`, {});
    },
  };
}

/**
 * A LiveKit access token for one caller in one room, with the intake agent
 * dispatched into the room (explicit dispatch by agent name, carrying the call
 * ids as metadata). Null when LiveKit is not configured.
 */
export function voiceTokenMinter(env: NodeJS.ProcessEnv = process.env): AssistantDeps['voiceToken'] {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || env.VOICE_BROWSER_CALLS === 'false') return null;
  const agentName = env.VOICE_AGENT_NAME || 'healwyn-intake';
  return async ({ callId, leadId, language }) => {
    // Short-lived: the token is only needed to join (LiveKit refreshes it for a connected caller),
    // so it cannot be reused later to rejoin and start another agent session.
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `caller-${callId.slice(0, 8)}`,
      ttl: '60s',
    });
    token.addGrant({
      roomJoin: true,
      room: `call-${callId}`,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: true,
      canPublishData: false,
    });
    token.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName,
          metadata: JSON.stringify({ callId, leadId, language, channel: 'browser' }),
        }),
      ],
    });
    return { serverUrl: LIVEKIT_URL, token: await token.toJwt() };
  };
}
