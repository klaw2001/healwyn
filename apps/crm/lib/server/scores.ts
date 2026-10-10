import 'server-only';
import { getIndustryPack, isIndustryId, scoreLead, type LeadScore, type UrgencyLevel } from '@healwyn/core';
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

/** The inputs apply_voice_outcome returns, in its JSON shape. */
export interface ScoreInputJson {
  industry: string;
  stage: string;
  urgency: UrgencyLevel;
  specialty_slug: string | null;
  answers: Record<string, string>;
  has_email: boolean;
  has_message: boolean;
  created_at: string;
  replied: boolean;
  opted_out: boolean;
  consents: string[];
}

/** Scores a lead from the inputs a system function returned (no staff session needed). */
export function scoreFromInput(input: ScoreInputJson): LeadScore | null {
  if (!isIndustryId(input.industry)) return null;
  return scoreLead(getIndustryPack(input.industry).crm.scoring, {
    stage: input.stage,
    urgency: input.urgency,
    specialtySlug: input.specialty_slug,
    answers: input.answers,
    hasEmail: input.has_email,
    hasMessage: input.has_message,
    consents: input.consents,
    createdAt: new Date(input.created_at),
    replied: input.replied,
    optedOut: input.opted_out,
  });
}
