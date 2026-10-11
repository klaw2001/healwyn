import { createHmac } from 'node:crypto';

/**
 * Signs a request to the voice agent's text service (apps/voice/healwyn_voice/webhook.py,
 * `verify_request`). The MAC covers the method and path as well as the body, so a captured
 * request cannot be replayed to another endpoint or another call within the 5-minute window.
 */
export function signServiceRequest(
  method: string,
  path: string,
  body: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): Record<string, string> {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${method.toUpperCase()} ${path}.${body}`)
    .digest('hex');
  return { 'x-webhook-timestamp': String(timestamp), 'x-webhook-signature': `sha256=${digest}` };
}
