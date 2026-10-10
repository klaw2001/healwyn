import 'server-only';
import { getIndustryPack, isIndustryId, scoreLead, type UrgencyLevel } from '@healwyn/core';
import type { Tx } from './db';

/** Recomputes a lead's rule-based score inside the caller's transaction (as the staff member). */
export async function recomputeScore(tx: Tx, leadId: string): Promise<void> {
  const [lead] = await tx<
    {
      industry: string;
      stage: string;
      urgency: UrgencyLevel;
      specialty_slug: string | null;
      answers: Record<string, string>;
      email: string | null;
      message: string | null;
      created_at: Date;
      last_inbound_at: Date | null;
      opted_out_at: Date | null;
      erased_at: Date | null;
    }[]
  >`select industry, stage, urgency, specialty_slug, answers, email, message, created_at, last_inbound_at, opted_out_at, erased_at
    from public.leads where id = ${leadId}`;
  if (!lead || lead.erased_at || !isIndustryId(lead.industry)) return;
  const consents = await tx<{ purpose: string }[]>`
    select purpose from public.current_consents where lead_id = ${leadId} and granted`;
  const score = scoreLead(getIndustryPack(lead.industry).crm.scoring, {
    stage: lead.stage,
    urgency: lead.urgency,
    specialtySlug: lead.specialty_slug,
    answers: lead.answers,
    hasEmail: Boolean(lead.email),
    hasMessage: Boolean(lead.message),
    consents: consents.map((c) => c.purpose),
    createdAt: lead.created_at,
    replied: lead.last_inbound_at !== null,
    optedOut: lead.opted_out_at !== null,
  });
  await tx`select public.save_lead_score(${leadId}, ${score.score}, ${score.band}, ${tx.json(score.factors as never)})`;
}
