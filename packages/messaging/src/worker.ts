import {
  formatLeadReference,
  getIndustryPack,
  isIndustryId,
  renderTemplate,
  stopReasonFor,
  type IndustryPack,
} from '@healwyn/core';
import type postgres from 'postgres';
import { sendEmail, type DeliveryResult, type EmailEnv, type OutgoingEmail } from './email';
import { oneClickUnsubscribeUrl, signUnsubscribeToken, unsubscribeUrl } from './unsubscribe';

export interface WorkerEnv extends EmailEnv {
  SITE_URL?: string;
  UNSUBSCRIBE_SECRET?: string;
}

export interface WorkerOptions {
  sql: postgres.Sql;
  env?: WorkerEnv;
  /** Steps claimed per run. */
  limit?: number;
  /** Injectable for tests. */
  deliverEmail?: (email: OutgoingEmail, env: WorkerEnv) => Promise<DeliveryResult>;
  /** Erase leads idle for this many months (privacy notice). 0 disables. */
  retentionMonths?: number;
}

export interface WorkerResult {
  claimed: number;
  sent: number;
  logged: number;
  simulated: number;
  skipped: number;
  retried: number;
  erased: number;
}

interface ClaimedStep {
  id: string;
  lead_id: string;
  industry: string;
  sequence_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  template_id: string;
  enrollment_status: 'active' | 'completed' | 'stopped';
  lead_stage: string;
  full_name: string | null;
  email: string | null;
  specialty_slug: string | null;
  opted_out: boolean;
  erased: boolean;
  contact_consent: boolean;
  replied: boolean;
}

const defaultDeliver = (email: OutgoingEmail, env: WorkerEnv) =>
  sendEmail(email, env, fetch, { consoleMode: 'redacted', redactedLabel: email.idempotencyKey });

/**
 * One pass of the nurture worker. Safe to run on several machines at once:
 * steps are claimed with FOR UPDATE SKIP LOCKED, each step records at most one
 * message (unique constraint), and emails carry the step id as their Resend
 * idempotency key, so a retry after a crash never sends twice.
 */
export async function runNurtureWorker(options: WorkerOptions): Promise<WorkerResult> {
  const { sql } = options;
  const env = options.env ?? process.env;
  const deliver = options.deliverEmail ?? defaultDeliver;
  if (!env.UNSUBSCRIBE_SECRET || env.UNSUBSCRIBE_SECRET.length < 16) {
    throw new Error('UNSUBSCRIBE_SECRET must be set (16+ characters): every email needs a working unsubscribe link.');
  }
  const siteUrl = env.SITE_URL || 'http://localhost:3000';
  const result: WorkerResult = { claimed: 0, sent: 0, logged: 0, simulated: 0, skipped: 0, retried: 0, erased: 0 };

  const steps = await sql<ClaimedStep[]>`select * from public.claim_due_messages(${options.limit ?? 50})`;
  result.claimed = steps.length;

  const finish = (id: string, outcome: 'sent' | 'skipped' | 'retry', message: object | null, detail: string | null) =>
    sql`select public.finish_scheduled_message(${id}, ${outcome}, ${message ? sql.json(message as postgres.JSONValue) : null}, ${detail})`;

  for (const step of steps) {
    const pack: IndustryPack | null = isIndustryId(step.industry) ? getIndustryPack(step.industry) : null;
    const sequence = pack?.sequences.find((s) => s.id === step.sequence_id);
    const template = pack?.crm.templates.find((t) => t.id === step.template_id);
    if (!pack || !sequence) {
      await finish(step.id, 'skipped', null, 'manual');
      result.skipped += 1;
      continue;
    }

    const reason = stopReasonFor(sequence, {
      enrollmentStatus: step.enrollment_status,
      leadStage: step.lead_stage,
      optedOut: step.opted_out,
      erased: step.erased,
      contactConsent: step.contact_consent,
      replied: step.replied,
    });
    if (reason) {
      await finish(step.id, 'skipped', null, reason);
      result.skipped += 1;
      continue;
    }
    if (!template || !step.full_name) {
      await finish(step.id, 'retry', null, template ? 'missing_name' : 'missing_template');
      result.retried += 1;
      continue;
    }

    const token = await signUnsubscribeToken(step.lead_id, env.UNSUBSCRIBE_SECRET);
    const link = unsubscribeUrl(siteUrl, token, pack.id);
    const rendered = renderTemplate(template, {
      brand: pack.brand,
      fullName: step.full_name,
      specialty: pack.offerings.find((o) => o.slug === step.specialty_slug)?.name ?? null,
      reference: formatLeadReference(step.lead_id),
      unsubscribeUrl: link,
    });

    if (step.channel === 'email') {
      if (!step.email) {
        // No address: this step cannot be delivered, the rest of the sequence can.
        await finish(step.id, 'skipped', null, 'no_email_address');
        result.skipped += 1;
        continue;
      }
      const delivery = await deliver(
        {
          to: step.email,
          subject: rendered.subject ?? '',
          text: rendered.text,
          idempotencyKey: `step-${step.id}`,
          unsubscribeUrl: oneClickUnsubscribeUrl(siteUrl, token),
        },
        env,
      );
      if (delivery.status === 'failed') {
        await finish(step.id, 'retry', null, delivery.error ?? 'send_failed');
        result.retried += 1;
        continue;
      }
      await finish(
        step.id,
        'sent',
        {
          status: delivery.status,
          subject: rendered.subject,
          body: rendered.text,
          providerMessageId: delivery.providerMessageId ?? null,
        },
        null,
      );
      if (delivery.status === 'sent') result.sent += 1;
      else result.logged += 1;
    } else {
      // SMS and WhatsApp are simulated: India requires DLT registration for real
      // SMS, which a demo does not have. The message is recorded, not sent.
      await finish(step.id, 'sent', { status: 'simulated', subject: null, body: rendered.text }, null);
      result.simulated += 1;
    }
  }

  if ((options.retentionMonths ?? 12) > 0) {
    const [row] = await sql<
      { erased: number }[]
    >`select public.purge_stale_leads(${options.retentionMonths ?? 12}) as erased`;
    result.erased = row?.erased ?? 0;
  }
  return result;
}
