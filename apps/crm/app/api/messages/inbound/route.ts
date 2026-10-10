import { MESSAGE_CHANNELS } from '@healwyn/core';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { system } from '@/lib/server/db';
import { verifySignedRequest } from '@/lib/server/webhooks';

const inbound = z.object({
  leadId: z.uuid(),
  channel: z.enum(MESSAGE_CHANNELS),
  body: z.string().max(5000),
});

/**
 * Webhook stub for replies from an email or messaging provider. A real
 * provider would post here (after mapping its payload) when a lead replies;
 * every running nurture sequence for that lead stops immediately.
 * Signed with INBOUND_WEBHOOK_SECRET (see lib/server/webhooks.ts).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const check = verifySignedRequest(raw, request.headers, process.env.INBOUND_WEBHOOK_SECRET);
  if (!check.ok)
    return NextResponse.json({ error: check.reason }, { status: check.reason === 'not_configured' ? 503 : 401 });

  let parsed: z.infer<typeof inbound>;
  try {
    parsed = inbound.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  try {
    const [row] = await system()<{ id: string }[]>`
      select public.record_inbound_message(${parsed.leadId}, ${parsed.channel}, ${parsed.body}, 'webhook') as id`;
    return NextResponse.json({ ok: true, messageId: row?.id });
  } catch {
    // Same response for unknown and erased leads.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
