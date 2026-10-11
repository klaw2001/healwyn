import 'server-only';
import {
  assistantToLeadPayload,
  BRAND,
  buildAssistantSchema,
  formatLeadReference,
  HONEYPOT_FIELD,
  toFieldErrors,
  type FieldErrors,
  type FormValues,
  type IndustryPack,
} from '@healwyn/core';
import type { CallRules, LeadStore } from '@healwyn/db';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { clientIp, rateLimitKey } from './client-key';
import { errorFields, log } from './log';

/**
 * Starting a call with the AI assistant from the website. The visitor gives a
 * name, a mobile number and the consents; that creates the lead (source
 * "voice"). Then either a LiveKit room is prepared for a voice call (the agent
 * is dispatched into it) or a typed chat starts with the agent's text service.
 * Both run the same intake conversation, and both post their result to the CRM.
 */

export const ASSISTANT_RATE_LIMIT = { limit: 5, windowSeconds: 600 } as const;
export const CALL_COOKIE = 'hw_call';

export type StartResult =
  | { status: 'invalid'; fieldErrors: FieldErrors }
  | { status: 'error'; message: string }
  | { status: 'voice'; callId: string; leadId: string; reference: string; serverUrl: string; token: string }
  | { status: 'text'; callId: string; leadId: string; reference: string; reply: string; language: string };

export interface TextService {
  start(body: {
    callId: string;
    leadId: string;
    channel: 'text';
    language: string;
  }): Promise<{ reply: string; language: string }>;
  turn(callId: string, text: string): Promise<{ reply: string; ended: boolean; language: string }>;
  end(callId: string): Promise<void>;
}

export interface AssistantDeps {
  store: LeadStore;
  pack: IndustryPack;
  text: TextService;
  /** Null when LiveKit is not configured: voice falls back to typed chat. */
  voiceToken:
    | ((call: { callId: string; leadId: string; language: string }) => Promise<{ serverUrl: string; token: string }>)
    | null;
}

const MESSAGES = {
  rateLimited: `You have started several calls in a short time. Please wait ten minutes, or use the enquiry form.`,
  failed: `Sorry, the assistant is not available right now. Please use the enquiry form, or email ${BRAND.contactEmail}.`,
  refused: {
    daily_limit: "The assistant has reached today's limit for this demo. Please use the enquiry form instead.",
    default: 'Sorry, the assistant cannot take this call. Please use the enquiry form instead.',
  } as Record<string, string>,
};

export function callRules(pack: IndustryPack): CallRules {
  const { limits, callConsentId } = pack.voice;
  return {
    consent_purpose: callConsentId,
    max_per_day: limits.maxCallsPerDay,
    window_start: limits.callWindow.startHour,
    window_end: limits.callWindow.endHour,
    time_zone: limits.callWindow.timeZone,
  };
}

export async function startAssistant(values: FormValues, headers: Headers, deps: AssistantDeps): Promise<StartResult> {
  if (typeof values[HONEYPOT_FIELD] === 'string' && (values[HONEYPOT_FIELD] as string).trim() !== '') {
    log.info('assistant.honeypot');
    return { status: 'error', message: MESSAGES.failed };
  }
  const parsed = buildAssistantSchema(deps.pack).safeParse(values);
  if (!parsed.success) return { status: 'invalid', fieldErrors: toFieldErrors(parsed.error) };

  const ip = clientIp(headers);
  if (ip) {
    try {
      const allowed = await deps.store.hitRateLimit(
        await rateLimitKey('assistant', ip),
        ASSISTANT_RATE_LIMIT.limit,
        ASSISTANT_RATE_LIMIT.windowSeconds,
      );
      if (!allowed) {
        log.warn('assistant.rate_limited');
        return { status: 'error', message: MESSAGES.rateLimited };
      }
    } catch (error) {
      log.warn('assistant.rate_limit_unavailable', errorFields(error));
    }
  }

  const start = parsed.data;
  const mode = start.mode === 'voice' && deps.voiceToken ? 'voice' : 'text';
  let leadId: string;
  let callId: string;
  try {
    ({ id: leadId } = await deps.store.submitLead(await assistantToLeadPayload(start, deps.pack)));
    const call = await deps.store.startWebCall(leadId, mode === 'voice' ? 'browser' : 'text', callRules(deps.pack));
    if (!call.allowed) {
      log.warn('assistant.call_refused', { reason: call.reason });
      return { status: 'error', message: MESSAGES.refused[call.reason] ?? MESSAGES.refused.default! };
    }
    callId = call.call_id;
  } catch (error) {
    log.error('assistant.start_failed', errorFields(error));
    return { status: 'error', message: MESSAGES.failed };
  }

  const reference = formatLeadReference(leadId);
  try {
    if (mode === 'voice') {
      const { serverUrl, token } = await deps.voiceToken!({ callId, leadId, language: start.preferredLanguage });
      log.info('assistant.started', { callId, mode, reference });
      return { status: 'voice', callId, leadId, reference, serverUrl, token };
    }
    const { reply, language } = await deps.text.start({
      callId,
      leadId,
      channel: 'text',
      language: start.preferredLanguage,
    });
    log.info('assistant.started', { callId, mode, reference });
    return { status: 'text', callId, leadId, reference, reply, language };
  } catch (error) {
    log.error('assistant.connect_failed', { callId, ...errorFields(error) });
    return { status: 'error', message: MESSAGES.failed };
  }
}

// -- The call cookie: only the browser that started a call may continue it. ------------------------

function cookieSecret(): string {
  const secret = process.env.VOICE_AGENT_SECRET;
  if (!secret || secret.length < 32) throw new Error('VOICE_AGENT_SECRET must be set (32+ characters).');
  return secret;
}

export function callCookieValue(callId: string, leadId: string): string {
  const mac = createHmac('sha256', cookieSecret()).update(`call:${callId}:${leadId}`).digest('base64url');
  return `${callId}.${leadId}.${mac}`;
}

export function readCallCookie(value: string | undefined): { callId: string; leadId: string } | null {
  if (!value) return null;
  const [callId, leadId, mac] = value.split('.');
  if (!callId || !leadId || !mac) return null;
  const expected = callCookieValue(callId, leadId).split('.')[2]!;
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? { callId, leadId } : null;
}
