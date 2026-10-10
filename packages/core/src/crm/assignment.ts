import type { UrgencyLevel } from './types';

/**
 * Lead assignment sits behind one function so the CRM never depends on how a
 * lead gets its owner. Phase 2 supports manual assignment only; Phase 3 adds
 * the routing engine as a second context mode without changing callers.
 */

export interface AssignableLead {
  readonly id: string;
  readonly specialtySlug: string | null;
  readonly urgency: UrgencyLevel;
  readonly preferredLanguage: string;
  readonly assignedStaffId: string | null;
}

export interface AssignableStaff {
  readonly id: string;
  readonly fullName: string;
  readonly active: boolean;
  readonly specialties: readonly string[];
  readonly languages: readonly string[];
}

export interface ManualAssignmentContext {
  readonly mode: 'manual';
  /** The staff member chosen by hand, or null to unassign. */
  readonly staffId: string | null;
  readonly staff: readonly AssignableStaff[];
}

export type AssignmentContext = ManualAssignmentContext;

export interface AssignmentDecision {
  readonly staffId: string | null;
  readonly method: 'manual';
  /** False when the lead already sits with this person (nothing to record). */
  readonly changed: boolean;
  /** Plain-language facts about the match, stored with the assignment event. */
  readonly explanation: readonly string[];
}

export class AssignmentError extends Error {
  override readonly name = 'AssignmentError';
}

function matchNotes(lead: AssignableLead, member: AssignableStaff): string[] {
  const notes: string[] = [];
  if (lead.specialtySlug) {
    notes.push(
      member.specialties.includes(lead.specialtySlug)
        ? `Covers ${lead.specialtySlug}.`
        : `Does not list ${lead.specialtySlug} as a specialty.`,
    );
  }
  notes.push(
    member.languages.includes(lead.preferredLanguage)
      ? `Speaks the lead's preferred language (${lead.preferredLanguage}).`
      : `Does not list the lead's preferred language (${lead.preferredLanguage}).`,
  );
  return notes;
}

export function assignLead(lead: AssignableLead, context: AssignmentContext): AssignmentDecision {
  const { staffId } = context;
  if (staffId === null) {
    return {
      staffId: null,
      method: 'manual',
      changed: lead.assignedStaffId !== null,
      explanation: ['Returned to the unassigned queue by hand.'],
    };
  }
  const member = context.staff.find((m) => m.id === staffId);
  if (!member || !member.active) throw new AssignmentError('That staff member is not active.');
  return {
    staffId,
    method: 'manual',
    changed: lead.assignedStaffId !== staffId,
    explanation: [`Assigned by hand to ${member.fullName}.`, ...matchNotes(lead, member)],
  };
}
