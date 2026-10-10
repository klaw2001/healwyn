'use server';

import {
  AssignmentError,
  assignLead as decideAssignment,
  getActivePack,
  planStageEntry,
  scheduleSteps,
  type UrgencyLevel,
} from '@healwyn/core';
import { revalidatePath } from 'next/cache';
import { assertCapability } from '@/lib/server/auth';
import { asStaff } from '@/lib/server/db';
import { friendlyError, type ActionResult } from '@/lib/server/errors';
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

export async function assignLead(leadId: string, staffId: string | null): Promise<ActionResult> {
  try {
    const session = await assertCapability('lead.assign');
    if (!UUID.test(leadId) || (staffId !== null && !UUID.test(staffId)))
      return { ok: false, error: 'Unknown staff member.' };
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
        },
      );
      if (!decision.changed) return false;
      const routing = { method: decision.method, explanation: decision.explanation };
      await tx`select public.assign_lead(${leadId}, ${decision.staffId}, 'manual', ${tx.json(routing)})`;
      return true;
    });
    if (changed) refresh(leadId);
    return { ok: true };
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
