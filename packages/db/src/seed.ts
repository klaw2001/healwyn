import {
  callPolicies,
  consentPlainText,
  demoAuthUserId,
  formatLeadReference,
  industryPacks,
  planStageEntry,
  renderTemplate,
  scoreLead,
  sha256Hex,
  type Brand,
  type CallPolicy,
  type DemoLead,
  type IndustryPack,
  type PlannedStep,
  type StopReason,
} from '@healwyn/core';

/** SQL literal helpers. Seed values come from our own typed config, not user input. */
const lit = (value: string | null): string => (value === null ? 'null' : `'${value.replaceAll("'", "''")}'`);
const textArray = (values: readonly string[]): string => `array[${values.map(lit).join(', ')}]::text[]`;
const jsonb = (value: unknown): string => `${lit(JSON.stringify(value))}::jsonb`;
const ts = (date: Date | null): string => (date ? `${lit(date.toISOString())}::timestamptz` : 'null');

/** Deterministic uuid-shaped ids for seeded child rows. */
function uuid(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ seed.charCodeAt(i), 2246822519) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const DEFAULT_DEMO_PASSWORD = 'demo-pass-2026';

/** Upserts one call policy (the rules `start_call` enforces), derived from the pack. */
export function callPolicySql(policy: CallPolicy): string {
  const num = (value: number | null) => (value === null ? 'null' : String(Math.trunc(value)));
  return `insert into public.call_policies (industry, channel, cap_group, consent_purpose, max_per_day,
  max_per_phone_per_day, outbound, window_start, window_end, time_zone, require_verified)
values (${lit(policy.industry)}, ${lit(policy.channel)}, ${lit(policy.cap_group)}, ${lit(policy.consent_purpose)},
  ${num(policy.max_per_day)}, ${num(policy.max_per_phone_per_day)}, ${policy.outbound}, ${num(policy.window_start)},
  ${num(policy.window_end)}, ${lit(policy.time_zone)}, ${policy.require_verified})
on conflict (industry, channel) do update set cap_group = excluded.cap_group, consent_purpose = excluded.consent_purpose,
  max_per_day = excluded.max_per_day, max_per_phone_per_day = excluded.max_per_phone_per_day,
  outbound = excluded.outbound, window_start = excluded.window_start, window_end = excluded.window_end,
  time_zone = excluded.time_zone, require_verified = excluded.require_verified, updated_at = now();`;
}

export function staffEmail(fullName: string, brand: Brand): string {
  const local = fullName
    .replace(/^Dr\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${local}@${brand.slug}.example`;
}

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

/** Moves a time into working hours (9:00 to 18:30 India time), on the half hour. */
function inClinicHours(date: Date): Date {
  const ist = new Date(date.getTime() + 330 * 60_000); // shift so UTC getters read India time
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const clamped = Math.min(Math.max(minutes, 9 * 60), 18 * 60 + 30);
  const rounded = Math.round(clamped / 30) * 30;
  ist.setUTCHours(Math.floor(rounded / 60), rounded % 60, 0, 0);
  return new Date(ist.getTime() - 330 * 60_000);
}

interface SeedEvent {
  at: Date;
  type: string;
  actor: 'system' | 'staff' | 'lead';
  actorId?: string | null;
  payload: Record<string, unknown>;
}

interface SeedEnrollment {
  id: string;
  sequenceId: string;
  enrolledAt: Date;
  steps: PlannedStep[];
  stoppedAt: Date | null;
  stopReason: StopReason | null;
}

/**
 * Replays one demo lead's history through the real nurture planner, so seeded
 * enrolments, schedules and messages are what the live system would produce.
 */
function simulate(lead: DemoLead, pack: IndustryPack, now: Date) {
  const createdAt = addMinutes(now, -lead.createdMinutesAgo);
  const span = lead.createdMinutesAgo;
  const stageTimes = lead.stageHistory.map((stage, index) => ({
    stage,
    at: addMinutes(createdAt, Math.round(((index + 1) * span) / (lead.stageHistory.length + 1))),
  }));
  const events: SeedEvent[] = [];
  const enrollments: SeedEnrollment[] = [];
  const repliedAt = lead.repliedAfterMinutes === null ? null : addMinutes(createdAt, lead.repliedAfterMinutes);
  const optedOutAt = lead.optedOut ? addMinutes(createdAt, Math.round(span * 0.9)) : null;

  const isRunning = (enrollment: SeedEnrollment, at: Date) =>
    !enrollment.stoppedAt && enrollment.steps.some((step) => new Date(step.dueAt) >= at);

  const stop = (at: Date, reason: StopReason, onlySequenceIds?: readonly string[]) => {
    for (const enrollment of enrollments) {
      if (!isRunning(enrollment, at)) continue;
      if (onlySequenceIds && !onlySequenceIds.includes(enrollment.sequenceId)) continue;
      enrollment.stoppedAt = at;
      enrollment.stopReason = reason;
      events.push({
        at,
        type: 'sequence.stopped',
        actor: 'system',
        payload: { sequence_id: enrollment.sequenceId, reason },
      });
    }
  };

  const enter = (stage: string, at: Date) => {
    const active = enrollments.filter((e) => isRunning(e, at)).map((e) => e.sequenceId);
    const plan = planStageEntry(pack.sequences, stage, active, at);
    stop(
      at,
      'stage_changed',
      plan.cancel.map((c) => c.sequenceId),
    );
    if (optedOutAt && at >= optedOutAt) return;
    for (const item of plan.enroll) {
      enrollments.push({
        id: uuid(`${lead.id}:${item.sequenceId}:${at.toISOString()}`),
        sequenceId: item.sequenceId,
        enrolledAt: at,
        steps: item.steps,
        stoppedAt: null,
        stopReason: null,
      });
      events.push({
        at,
        type: 'sequence.enrolled',
        actor: 'system',
        payload: { sequence_id: item.sequenceId, steps: item.steps.length },
      });
    }
  };

  events.push({
    at: createdAt,
    type: 'lead.created',
    actor: 'lead',
    payload: { source: 'web_form', lead_type: 'individual', stage: 'new' },
  });
  events.push({
    at: createdAt,
    type: 'consent.recorded',
    actor: 'lead',
    payload: {
      purposes: Object.fromEntries(
        pack.intake.consents.map((c) => [c.id, c.id === pack.voice.callConsentId ? lead.assistantCallConsent : true]),
      ),
    },
  });
  enter(pack.initialStageId, createdAt);

  if (lead.assignedStaffId) {
    events.push({
      at: addMinutes(createdAt, Math.min(10, Math.max(1, Math.round(span / 20)))),
      type: 'lead.assigned',
      actor: 'staff',
      actorId: pack.demo.staff.find((m) => m.role === 'care_coordinator')?.id ?? null,
      payload: { from_staff_id: null, to_staff_id: lead.assignedStaffId, reason: 'manual', method: 'manual' },
    });
  }

  // Stage changes, the reply and the opt-out, in time order.
  const milestones = [
    ...stageTimes.map((s) => ({ kind: 'stage' as const, at: s.at, stage: s.stage })),
    ...(repliedAt && repliedAt < now ? [{ kind: 'reply' as const, at: repliedAt, stage: '' }] : []),
    ...(optedOutAt ? [{ kind: 'optout' as const, at: optedOutAt, stage: '' }] : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  let previous = pack.initialStageId;
  for (const milestone of milestones) {
    if (milestone.kind === 'stage') {
      events.push({
        at: milestone.at,
        type: 'stage.changed',
        actor: 'staff',
        actorId: lead.assignedStaffId,
        payload: { from: previous, to: milestone.stage, reason: 'manual' },
      });
      enter(milestone.stage, milestone.at);
      previous = milestone.stage;
    } else if (milestone.kind === 'reply') {
      events.push({
        at: milestone.at,
        type: 'lead.replied',
        actor: 'staff',
        actorId: lead.assignedStaffId,
        payload: { source: 'staff' },
      });
      stop(milestone.at, 'replied');
    } else {
      events.push({ at: milestone.at, type: 'lead.opted_out', actor: 'lead', payload: { source: 'email_link' } });
      stop(milestone.at, 'opted_out');
    }
  }

  return { createdAt, events, enrollments, repliedAt, optedOutAt };
}

/**
 * Builds an idempotent seed script for every industry pack (or the ones given):
 * - specialties, the assistant's call policies, staff (with roles) and one Supabase Auth user per staff member;
 * - 40 demo leads per pack (is_demo) with consent records, events, notes, tasks,
 *   nurture enrolments, schedules, messages and scores.
 * Demo leads are replaced on every run; real leads are never touched.
 */
export async function buildSeedSql(
  options: { packs?: readonly IndustryPack[]; now?: Date; demoPassword?: string; siteUrl?: string } = {},
): Promise<string> {
  const packs = options.packs ?? (Object.values(industryPacks) as IndustryPack[]);
  const now = options.now ?? new Date();
  const parts: string[] = [];
  for (const pack of packs) parts.push(await packSeedSql(pack, now, options));
  return parts.join('\n');
}

async function packSeedSql(
  pack: IndustryPack,
  now: Date,
  options: { demoPassword?: string; siteUrl?: string },
): Promise<string> {
  const password = options.demoPassword ?? DEFAULT_DEMO_PASSWORD;
  const siteUrl = options.siteUrl ?? 'http://localhost:3000';
  const statements: string[] = [];
  const offeringName = (slug: string | null) => pack.offerings.find((o) => o.slug === slug)?.name ?? null;

  pack.offerings.forEach((offering, index) => {
    statements.push(
      `insert into public.specialties (slug, industry, name, summary, sort_order)
values (${lit(offering.slug)}, ${lit(pack.id)}, ${lit(offering.name)}, ${lit(offering.summary)}, ${index})
on conflict (slug) do update set name = excluded.name, summary = excluded.summary, sort_order = excluded.sort_order, active = true;`,
    );
  });

  for (const policy of callPolicies(pack)) statements.push(callPolicySql(policy));
  pack.stages.forEach((stage, index) => {
    statements.push(
      `insert into public.industry_stages (industry, stage_id, kind, sort_order)
values (${lit(pack.id)}, ${lit(stage.id)}, ${lit(stage.kind)}, ${index})
on conflict (industry, stage_id) do update set kind = excluded.kind, sort_order = excluded.sort_order;`,
    );
  });
  statements.push(
    `delete from public.industry_stages where industry = ${lit(pack.id)} and stage_id not in (${pack.stages
      .map((stage) => lit(stage.id))
      .join(', ')});`,
  );

  for (const member of pack.demo.staff) {
    const authId = demoAuthUserId(member.id);
    const email = staffEmail(member.fullName, pack.brand);
    statements.push(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', ${lit(authId)}, 'authenticated', 'authenticated', ${lit(email)},
  extensions.crypt(${lit(password)}, extensions.gen_salt('bf', 8)), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, ${jsonb({ demo: true, full_name: member.fullName })}, now(), now(), '', '', '', '')
on conflict (id) do update set email = excluded.email, encrypted_password = excluded.encrypted_password, updated_at = now();`,
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (${lit(authId)}, ${lit(authId)}, ${jsonb({ sub: authId, email, email_verified: true })}, 'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;`,
      `insert into public.staff (id, industry, full_name, title, level, role, specialties, languages, locations, email, capacity, is_demo, auth_user_id)
values (${lit(member.id)}, ${lit(pack.id)}, ${lit(member.fullName)}, ${lit(member.title)}, ${lit(member.level)}, ${lit(member.role)}, ${textArray(
        member.specialties,
      )}, ${textArray(member.languages)}, ${textArray(member.locations)}, ${lit(email)}, ${member.capacity}, true, ${lit(authId)})
on conflict (id) do update set full_name = excluded.full_name, title = excluded.title, level = excluded.level, role = excluded.role,
  specialties = excluded.specialties, languages = excluded.languages, locations = excluded.locations,
  email = excluded.email, capacity = excluded.capacity, active = true, is_demo = true, auth_user_id = excluded.auth_user_id;`,
    );
  }

  // Replace demo leads. Their consent records, events, notes, tasks, messages,
  // enrolments and scores go with them (cascade).
  statements.push(`delete from public.leads where is_demo and industry = ${lit(pack.id)};`);

  const consentHashes = new Map<string, string>();
  for (const def of pack.intake.consents) {
    consentHashes.set(def.id, await sha256Hex(consentPlainText(def, pack.brand)));
  }
  const requiredConsent = pack.intake.consents.find((c) => c.required)!.id;

  for (const lead of pack.demo.leads) {
    const { [pack.intake.messageQuestionId]: _message, ...answers } = lead.answers;
    const offering = answers[pack.intake.offeringQuestionId] ?? null;
    const specialty = offering && pack.offerings.some((o) => o.slug === offering) ? offering : null;
    const billingFlag = pack.billingRule ? answers[pack.billingRule.questionId] === pack.billingRule.equals : false;
    const { createdAt, events, enrollments, repliedAt, optedOutAt } = simulate(lead, pack, now);
    const firstResponseAt =
      lead.firstResponseAfterMinutes === null ? null : addMinutes(createdAt, lead.firstResponseAfterMinutes);
    const replied = repliedAt !== null && repliedAt < now;
    const reference = formatLeadReference(lead.id);

    statements.push(
      `insert into public.leads (id, industry, lead_type, source, stage, urgency, full_name, phone, email, message, answers,
  preferred_language, specialty_slug, assigned_staff_id, billing_flag, is_demo, created_at, updated_at,
  first_response_at, last_inbound_at, opted_out_at)
values (${lit(lead.id)}, ${lit(pack.id)}, 'individual', 'seed', ${lit(lead.stage)}, ${lit(lead.urgency)}, ${lit(lead.fullName)},
  ${lit(lead.phone)}, ${lit(lead.email)}, ${lit(lead.message)}, ${jsonb(answers)}, ${lit(lead.preferredLanguage)}, ${lit(specialty)},
  ${lit(lead.assignedStaffId)}, ${billingFlag}, true, ${ts(createdAt)}, ${ts(createdAt)}, ${ts(firstResponseAt)},
  ${ts(replied ? repliedAt : null)}, ${ts(optedOutAt)});`,
    );

    for (const def of pack.intake.consents) {
      const granted = def.id === pack.voice.callConsentId ? lead.assistantCallConsent : true;
      statements.push(
        `insert into public.consent_records (lead_id, purpose, granted, required, text_version, text_hash, source, recorded_at)
values (${lit(lead.id)}, ${lit(def.id)}, ${granted}, ${def.required}, ${lit(def.version)}, ${lit(consentHashes.get(def.id) ?? null)}, 'seed', ${ts(createdAt)});`,
      );
    }

    for (const note of lead.notes) {
      const at = addMinutes(createdAt, note.afterMinutes);
      if (at > now) continue;
      const noteId = uuid(`${lead.id}:note:${note.afterMinutes}:${note.templateId}`);
      const body = pack.crm.noteTemplates.find((t) => t.id === note.templateId)?.body ?? note.templateId;
      statements.push(
        `insert into public.notes (id, lead_id, author_staff_id, template_id, body, created_at)
values (${lit(noteId)}, ${lit(lead.id)}, ${lit(note.authorStaffId)}, ${lit(note.templateId)}, ${lit(body)}, ${ts(at)});`,
      );
      events.push({
        at,
        type: 'note.added',
        actor: 'staff',
        actorId: note.authorStaffId,
        payload: { note_id: noteId, template_id: note.templateId },
      });
    }

    lead.tasks.forEach((task, index) => {
      const taskId = uuid(`${lead.id}:task:${index}`);
      const dueAt = inClinicHours(addMinutes(now, task.dueInMinutes));
      const taskCreatedAt = addMinutes(createdAt, Math.min(60, Math.round(lead.createdMinutesAgo / 3)));
      statements.push(
        `insert into public.tasks (id, lead_id, assignee_staff_id, created_by_staff_id, title, due_at, completed_at, completed_by_staff_id, created_at)
values (${lit(taskId)}, ${lit(lead.id)}, ${lit(task.assigneeStaffId)}, ${lit(task.assigneeStaffId)}, ${lit(task.title)}, ${ts(dueAt)},
  ${task.completed ? ts(addMinutes(dueAt, -30)) : 'null'}, ${task.completed ? lit(task.assigneeStaffId) : 'null'}, ${ts(taskCreatedAt)});`,
      );
      events.push({
        at: taskCreatedAt,
        type: 'task.created',
        actor: 'staff',
        actorId: task.assigneeStaffId,
        payload: { task_id: taskId, due_at: dueAt.toISOString(), assignee_staff_id: task.assigneeStaffId },
      });
    });

    for (const enrollment of enrollments) {
      let done = 0;
      const stepRows: string[] = [];
      for (const step of enrollment.steps) {
        const dueAt = new Date(step.dueAt);
        const stepId = uuid(`${enrollment.id}:${step.stepIndex}`);
        const status: 'done' | 'pending' | 'cancelled' =
          enrollment.stoppedAt && dueAt >= enrollment.stoppedAt ? 'cancelled' : dueAt <= now ? 'done' : 'pending';
        const processedAt = status === 'done' ? dueAt : status === 'cancelled' ? enrollment.stoppedAt : null;
        stepRows.push(
          `insert into public.scheduled_messages (id, enrollment_id, lead_id, sequence_id, step_index, channel, template_id, due_at, status, attempts, processed_at, skip_reason)
values (${lit(stepId)}, ${lit(enrollment.id)}, ${lit(lead.id)}, ${lit(enrollment.sequenceId)}, ${step.stepIndex}, ${lit(step.channel)},
  ${lit(step.templateId)}, ${ts(dueAt)}, ${lit(status)}, ${status === 'done' ? 1 : 0}, ${ts(processedAt)},
  ${status === 'cancelled' ? lit(enrollment.stopReason) : 'null'});`,
        );
        if (status !== 'done') continue;
        done += 1;
        const template = pack.crm.templates.find((t) => t.id === step.templateId);
        const rendered = template
          ? renderTemplate(template, {
              brand: pack.brand,
              fullName: lead.fullName,
              specialty: offeringName(specialty),
              reference,
              unsubscribeUrl: `${siteUrl}/unsubscribe`,
            })
          : { subject: null, text: '' };
        stepRows.push(
          `insert into public.messages (lead_id, channel, direction, status, template_id, subject, body, scheduled_message_id, enrollment_id, created_at)
values (${lit(lead.id)}, ${lit(step.channel)}, 'outbound', 'simulated', ${lit(step.templateId)}, ${lit(rendered.subject)}, ${lit(rendered.text)},
  ${lit(stepId)}, ${lit(enrollment.id)}, ${ts(dueAt)});`,
        );
        events.push({
          at: dueAt,
          type: 'message.sent',
          actor: 'system',
          payload: {
            channel: step.channel,
            status: 'simulated',
            template_id: step.templateId,
            sequence_id: enrollment.sequenceId,
          },
        });
      }
      const completed = !enrollment.stoppedAt && done === enrollment.steps.length;
      const status = enrollment.stoppedAt ? 'stopped' : completed ? 'completed' : 'active';
      const endedAt = enrollment.stoppedAt ?? (completed ? new Date(enrollment.steps.at(-1)!.dueAt) : null);
      statements.push(
        `insert into public.sequence_enrollments (id, lead_id, industry, sequence_id, status, stop_reason, enrolled_at, ended_at)
values (${lit(enrollment.id)}, ${lit(lead.id)}, ${lit(pack.id)}, ${lit(enrollment.sequenceId)}, ${lit(status)}, ${lit(
          enrollment.stopReason,
        )}, ${ts(enrollment.enrolledAt)}, ${ts(endedAt)});`,
        ...stepRows,
      );
    }

    // Events in time order, so the timeline (ordered by created_at, id) reads naturally.
    const past = events.filter((e) => e.at <= now).sort((a, b) => a.at.getTime() - b.at.getTime());
    for (const event of past) {
      statements.push(
        `insert into public.lead_events (lead_id, type, actor_type, actor_id, payload, created_at)
values (${lit(lead.id)}, ${lit(event.type)}, ${lit(event.actor)}, ${lit(event.actorId ?? null)}, ${jsonb(event.payload)}, ${ts(event.at)});`,
      );
    }
    statements.push(
      `update public.leads set updated_at = ${ts(past.at(-1)?.at ?? createdAt)} where id = ${lit(lead.id)};`,
    );

    const score = scoreLead(
      pack.crm.scoring,
      {
        stage: lead.stage,
        urgency: lead.urgency,
        specialtySlug: specialty,
        answers,
        hasEmail: Boolean(lead.email),
        hasMessage: Boolean(lead.message),
        consents: [requiredConsent, ...(lead.assistantCallConsent ? [pack.voice.callConsentId] : [])],
        createdAt,
        replied,
        optedOut: lead.optedOut,
      },
      now,
    );
    statements.push(
      `insert into public.lead_scores (lead_id, score, band, factors, computed_at)
values (${lit(lead.id)}, ${score.score}, ${lit(score.band)}, ${jsonb(score.factors)}, ${ts(now)});`,
    );
  }

  return statements.join('\n');
}
