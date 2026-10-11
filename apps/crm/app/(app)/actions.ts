'use server';

import {
  AssignmentError,
  assignLead as decideAssignment,
  assignmentRecord,
  isOverrideReason,
  normalizeIndianMobile,
  getActivePack,
  planStageEntry,
  scheduleSteps,
  type UrgencyLevel,
} from '@healwyn/core';
import { revalidatePath } from 'next/cache';
import { assertCapability } from '@/lib/server/auth';
import { asStaff } from '@/lib/server/db';
import { callRules, placePhoneCall, runSimulatedCall, telephonyConfigured } from '@/lib/server/dialer';
import { friendlyError, type ActionResult } from '@/lib/server/errors';
import { routeForStaff } from '@/lib/server/routing';
import { recomputeScore } from '@/lib/server/scores';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pack = getActivePack();

function refresh(leadId?: string) {
  revalidatePath('/pipeline');
  revalidatePath('/workspace');
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

/** Moves a lead to a stage from the industry pack and applies that stage's nurture plan. */
export async function changeStage(
  leadId: string,
  toStage: string,
  reason: 'manual' | 'undo' = 'manual',
): Promise<ActionResult<{ from: string; to: string }>> {
  try {
    const session = await assertCapability('lead.changeStage');
    if (!UUID.test(leadId) || !pack.stages.some((s) => s.id === toStage)) return { ok: false, error: 'Unknown stage.' };
    const result = await asStaff(session, async (tx) => {
      const active = await tx<{ sequence_id: string }[]>`
        select sequence_id from public.sequence_enrollments where lead_id = ${leadId} and status = 'active'`;
      const plan = planStageEntry(
        pack.sequences,
        toStage,
        active.map((a) => a.sequence_id),
      );
      const [row] = await tx<{ r: { from: string; to: string } }[]>`
        select public.change_lead_stage(${leadId}, ${toStage}, ${tx.json(plan as never)}, ${reason}) as r`;
      await recomputeScore(tx, leadId);
      return row!.r;
    });
    refresh(leadId);
    return { ok: true, from: result.from, to: result.to };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function assignLead(
  leadId: string,
  staffId: string | null,
  options: { suggestedStaffId?: string | null; overrideReason?: string | null } = {},
): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.assign');
    if (!UUID.test(leadId) || (staffId !== null && !UUID.test(staffId)))
      return { ok: false, error: 'Unknown staff member.' };
    const suggested = options.suggestedStaffId && UUID.test(options.suggestedStaffId) ? options.suggestedStaffId : null;
    const overrideReason = isOverrideReason(options.overrideReason) ? options.overrideReason : undefined;
    const changed = await asStaff(session, async (tx) => {
      const [lead] = await tx<
        {
          id: string;
          specialty_slug: string | null;
          urgency: UrgencyLevel;
          preferred_language: string;
          assigned_staff_id: string | null;
        }[]
      >`select id, specialty_slug, urgency, preferred_language, assigned_staff_id from public.leads where id = ${leadId}`;
      if (!lead) throw new AssignmentError('Unknown lead.');
      const staff = await tx<
        { id: string; full_name: string; active: boolean; specialties: string[]; languages: string[] }[]
      >`select id, full_name, active, specialties, languages from public.staff where id = ${staffId}`;
      const decision = decideAssignment(
        {
          id: lead.id,
          specialtySlug: lead.specialty_slug,
          urgency: lead.urgency,
          preferredLanguage: lead.preferred_language,
          assignedStaffId: lead.assigned_staff_id,
        },
        {
          mode: 'manual',
          staffId,
          staff: staff.map((m) => ({ ...m, fullName: m.full_name })),
          suggestedStaffId: suggested,
          overrideReason,
        },
      );
      if (!decision.changed) return false;
      const reason = decision.method === 'override' ? `override:${decision.overrideReason}` : 'manual';
      await tx`select public.assign_lead(${leadId}, ${decision.staffId}, ${reason}, ${tx.json(assignmentRecord(decision) as never)})`;
      return true;
    });
    if (changed) refresh(leadId);
    return { ok: true };
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, error: error.message };
    return { ok: false, error: friendlyError(error) };
  }
}

/** Assigns a lead to the routing engine's choice, recording the explanation and any copy-ins. */
export async function acceptRouting(leadId: string): Promise<ActionResult<{ staffName: string }>> {
  try {
    const session = await assertCapability('lead.assign');
    if (!UUID.test(leadId)) return { ok: false, error: 'Unknown lead.' };
    const staffName = await asStaff(session, async (tx) => {
      const { decision } = await routeForStaff(tx, leadId);
      if (!decision.staffId || !decision.routing) throw new AssignmentError('Nobody is available to take this lead.');
      await tx`select public.assign_lead(${leadId}, ${decision.staffId}, 'routing', ${tx.json(assignmentRecord(decision) as never)})`;
      return decision.routing.staffName ?? 'the suggested person';
    });
    refresh(leadId);
    return { ok: true, staffName };
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, error: error.message };
    return { ok: false, error: friendlyError(error) };
  }
}

export async function addNote(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.note');
    const leadId = String(formData.get('lead_id') ?? '');
    const body = String(formData.get('body') ?? '').trim();
    const templateId = String(formData.get('template_id') ?? '') || null;
    if (!UUID.test(leadId)) return { ok: false, error: 'Unknown lead.' };
    if (body.length < 1 || body.length > 2000) return { ok: false, error: 'Write a note of up to 2,000 characters.' };
    if (templateId && !pack.crm.noteTemplates.some((t) => t.id === templateId))
      return { ok: false, error: 'Unknown template.' };
    await asStaff(session, async (tx) => {
      await tx`select public.add_note(${leadId}, ${body}, ${templateId})`;
      await recomputeScore(tx, leadId);
    });
    refresh(leadId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/** "2026-10-12T15:30" from a datetime-local input, read as India time. */
function parseIndiaDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createTask(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.task');
    const leadId = String(formData.get('lead_id') ?? '');
    const title = String(formData.get('title') ?? '').trim();
    const dueAt = parseIndiaDateTime(String(formData.get('due_at') ?? ''));
    const assignee = String(formData.get('assignee_staff_id') ?? '') || null;
    if (!UUID.test(leadId)) return { ok: false, error: 'Unknown lead.' };
    if (title.length < 1 || title.length > 200) return { ok: false, error: 'Give the task a short title.' };
    if (!dueAt) return { ok: false, error: 'Choose when the task is due.' };
    if (assignee && !UUID.test(assignee)) return { ok: false, error: 'Unknown staff member.' };
    const remindAt = new Date(dueAt.getTime() - 30 * 60_000);
    await asStaff(
      session,
      (tx) => tx`select public.create_task(${leadId}, ${title}, ${dueAt}, ${assignee}, ${remindAt})`,
    );
    refresh(leadId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function completeTask(taskId: string, leadId: string): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.task');
    if (!UUID.test(taskId)) return { ok: false, error: 'Unknown task.' };
    await asStaff(session, (tx) => tx`select public.complete_task(${taskId})`);
    refresh(UUID.test(leadId) ? leadId : undefined);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/** The lead got in touch: stop every running nurture sequence. */
export async function markReplied(leadId: string): Promise<ActionResult<{ stopped: number }>> {
  try {
    const session = await assertCapability('lead.markReplied');
    if (!UUID.test(leadId)) return { ok: false, error: 'Unknown lead.' };
    const stopped = await asStaff(session, async (tx) => {
      const [row] = await tx<{ stopped: number }[]>`select public.mark_replied(${leadId}) as stopped`;
      await recomputeScore(tx, leadId);
      return row?.stopped ?? 0;
    });
    refresh(leadId);
    return { ok: true, stopped };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/** Records a consent withdrawal reported to staff; the pack decides whether data is erased. */
export async function recordWithdrawal(leadId: string, purpose: string): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.recordWithdrawal');
    const definition = [...pack.intake.consents, ...pack.partnerIntake.consents].find((c) => c.id === purpose);
    if (!UUID.test(leadId) || !definition) return { ok: false, error: 'Unknown consent.' };
    await asStaff(
      session,
      (tx) => tx`select public.record_consent_withdrawal(${leadId}, ${purpose}, ${definition.erasesDataOnWithdrawal})`,
    );
    refresh(leadId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

/** Starts a sequence that no stage enrols automatically (e.g. no-show recovery). */
export async function enrollInSequence(leadId: string, sequenceId: string): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.assign');
    const sequence = pack.sequences.find((s) => s.id === sequenceId);
    if (!UUID.test(leadId) || !sequence) return { ok: false, error: 'Unknown sequence.' };
    const plan = { enroll: [{ sequenceId, steps: scheduleSteps(sequence, new Date()) }], cancel: [] };
    await asStaff(session, (tx) => tx`select public.enroll_lead(${leadId}, ${tx.json(plan as never)})`);
    refresh(leadId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function stopEnrollment(enrollmentId: string, leadId: string): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.assign');
    if (!UUID.test(enrollmentId)) return { ok: false, error: 'Unknown enrolment.' };
    await asStaff(session, (tx) => tx`select public.stop_enrollment(${enrollmentId})`);
    refresh(UUID.test(leadId) ? leadId : undefined);
    revalidatePath('/sequences');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function setSequencePaused(sequenceId: string, paused: boolean): Promise<ActionResult> {
  try {
    const session = await assertCapability('sequence.manage');
    if (!pack.sequences.some((s) => s.id === sequenceId)) return { ok: false, error: 'Unknown sequence.' };
    await asStaff(session, (tx) => tx`select public.set_sequence_paused(${pack.id}, ${sequenceId}, ${paused})`);
    revalidatePath('/sequences');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

const CALL_REFUSAL_MESSAGES: Record<string, string> = {
  no_call_consent: 'This lead has not agreed to calls from the assistant (or withdrew that consent).',
  opted_out: 'This lead has unsubscribed, so the assistant will not call.',
  erased: 'This lead’s details were erased.',
  outside_call_window: 'Assistant calls are only placed between 9am and 9pm India time.',
  no_phone: 'This lead has no phone number.',
  number_not_verified:
    'This number is not on the verified demo list (a trial phone line can only call verified numbers).',
  daily_limit: 'The assistant has reached today’s call limit.',
};

/**
 * Places an assistant call from the dialer. Every check (call consent, opt-out,
 * the 9am-9pm window, verified numbers for real calls, the daily cap) runs in
 * the database, which records each refusal with its reason. A simulated call
 * runs the real conversation engine with the lead's form answers as the
 * caller's lines; its result arrives through the same webhook as a real call.
 */
export async function placeAssistantCall(
  leadId: string,
  channel: 'simulated' | 'phone',
): Promise<ActionResult<{ outcome: string }>> {
  try {
    const session = await assertCapability('lead.placeCall');
    if (!UUID.test(leadId) || (channel !== 'simulated' && channel !== 'phone')) {
      return { ok: false, error: 'Unknown lead.' };
    }
    if (channel === 'phone' && !telephonyConfigured()) {
      return { ok: false, error: 'Phone calling is not set up. Use a simulated call (see docs/VOICE.md).' };
    }
    // Committed before the call runs: the result webhook needs the call session to exist.
    const placed = await asStaff(session, async (tx) => {
      const [row] = await tx<{ r: { allowed: boolean; reason?: string; call_id?: string } }[]>`
        select public.place_assistant_call(${leadId}, ${channel}, ${tx.json(callRules(channel) as never)}) as r`;
      const [lead] = await tx<
        { answers: Record<string, string>; message: string | null; preferred_language: string; phone: string | null }[]
      >`select answers, message, preferred_language, phone from public.leads where id = ${leadId}`;
      return { ...row!.r, lead: lead! };
    });
    if (!placed.allowed || !placed.call_id) {
      refresh(leadId);
      return { ok: false, error: CALL_REFUSAL_MESSAGES[placed.reason ?? ''] ?? 'The call was not placed.' };
    }
    const call = {
      callId: placed.call_id,
      leadId,
      language: placed.lead.preferred_language,
      answers: placed.lead.answers,
      message: placed.lead.message,
    };
    if (channel === 'phone') {
      await placePhoneCall({ ...call, phone: placed.lead.phone! });
      refresh(leadId);
      return { ok: true, outcome: 'dialling' };
    }
    const result = await runSimulatedCall(call);
    refresh(leadId);
    return { ok: true, outcome: result.outcome };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function addVerifiedNumber(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const session = await assertCapability('assistant.manage');
    const phone = normalizeIndianMobile(String(formData.get('phone') ?? ''));
    const label = String(formData.get('label') ?? '').trim();
    if (!phone) return { ok: false, error: 'Enter a 10-digit Indian mobile number.' };
    if (!/^[A-Za-z0-9 .,()'-]{1,60}$/.test(label)) {
      return { ok: false, error: 'Give it a short label (letters, numbers and spaces, up to 60).' };
    }
    await asStaff(session, (tx) => tx`select public.add_verified_number(${phone}, ${label})`);
    revalidatePath('/assistant');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function removeVerifiedNumber(phone: string): Promise<ActionResult> {
  try {
    const session = await assertCapability('assistant.manage');
    await asStaff(session, (tx) => tx`select public.remove_verified_number(${phone})`);
    revalidatePath('/assistant');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}
