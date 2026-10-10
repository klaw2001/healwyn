import type { StaffLevel } from '../industries/types';
import { routeLead } from '../routing/engine';
import type { RosterMember, RoutingConfig, RoutingDecision, RoutingRecord } from '../routing/types';
import type { UrgencyLevel } from './types';

/**
 * Lead assignment sits behind one function so the CRM never depends on how a
 * lead gets its owner: by hand (`mode: 'manual'`, optionally overriding the
 * routing engine with a logged reason) or by the routing engine
 * (`mode: 'auto'`).
 */

export interface AssignableLead {
  readonly id: string;
  readonly specialtySlug: string | null;
  readonly urgency: UrgencyLevel;
  readonly preferredLanguage: string;
  readonly assignedStaffId: string | null;
  /** Set by the pack's billing rule; used by routing. */
  readonly billingFlag?: boolean;
  /** The clinician a returning patient saw before; used by routing. */
  readonly previousStaffId?: string | null;
}

export interface AssignableStaff {
  readonly id: string;
  readonly fullName: string;
  readonly active: boolean;
  readonly specialties: readonly string[];
  readonly languages: readonly string[];
}

/** Why a person overrode the routing engine's choice. Stored as a code. */
export const OVERRIDE_REASONS = {
  patient_request: 'The patient asked for this person',
  continuity: 'Continuity of care',
  workload: 'Balancing workload',
  language: 'Language or communication needs',
  clinical_judgement: 'Clinical judgement',
  other: 'Other',
} as const;
export type OverrideReason = keyof typeof OVERRIDE_REASONS;
export const isOverrideReason = (value: unknown): value is OverrideReason =>
  typeof value === 'string' && Object.hasOwn(OVERRIDE_REASONS, value);

export interface ManualAssignmentContext {
  readonly mode: 'manual';
  /** The staff member chosen by hand, or null to unassign. */
  readonly staffId: string | null;
  readonly staff: readonly AssignableStaff[];
  /** Set when the choice differs from the routing engine's suggestion. */
  readonly overrideReason?: OverrideReason;
  /** The routing engine's suggestion, when one was shown. */
  readonly suggestedStaffId?: string | null;
}

export interface AutoAssignmentContext {
  readonly mode: 'auto';
  readonly roster: readonly RosterMember[];
  readonly config: RoutingConfig;
  readonly staffLevels: readonly StaffLevel[];
  readonly offeringName?: (slug: string) => string;
}

export type AssignmentContext = ManualAssignmentContext | AutoAssignmentContext;

export interface AssignmentDecision {
  readonly staffId: string | null;
  readonly method: 'manual' | 'override' | 'routing';
  /** False when the lead already sits with this person (nothing to record). */
  readonly changed: boolean;
  /** Plain-language facts about the match, stored with the assignment event. */
  readonly explanation: readonly string[];
  /** The full routing result for `mode: 'auto'`. */
  readonly routing?: RoutingDecision;
  readonly overrideReason?: OverrideReason;
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
  if (context.mode === 'auto') {
    const routing = routeLead(
      {
        id: lead.id,
        specialtySlug: lead.specialtySlug,
        urgency: lead.urgency,
        preferredLanguage: lead.preferredLanguage,
        billingFlag: lead.billingFlag ?? false,
        previousStaffId: lead.previousStaffId ?? null,
      },
      context.roster,
      context.config,
      context.staffLevels,
      context.offeringName,
    );
    return {
      staffId: routing.staffId,
      method: 'routing',
      changed: routing.staffId !== lead.assignedStaffId,
      explanation: routing.explanation,
      routing,
    };
  }

  const { staffId } = context;
  const overriding =
    context.suggestedStaffId !== undefined && context.suggestedStaffId !== null && staffId !== context.suggestedStaffId;
  if (overriding && !context.overrideReason) {
    throw new AssignmentError('Choose a reason for overriding the suggested assignment.');
  }
  const overrideNote =
    overriding && context.overrideReason
      ? [`Overrode the routing suggestion: ${OVERRIDE_REASONS[context.overrideReason]}.`]
      : [];
  const method = overriding ? 'override' : 'manual';

  if (staffId === null) {
    return {
      staffId: null,
      method,
      changed: lead.assignedStaffId !== null,
      explanation: ['Returned to the unassigned queue by hand.', ...overrideNote],
      ...(overriding ? { overrideReason: context.overrideReason } : {}),
    };
  }
  const member = context.staff.find((m) => m.id === staffId);
  if (!member || !member.active) throw new AssignmentError('That staff member is not active.');
  return {
    staffId,
    method,
    changed: lead.assignedStaffId !== staffId,
    explanation: [`Assigned by hand to ${member.fullName}.`, ...overrideNote, ...matchNotes(lead, member)],
    ...(overriding ? { overrideReason: context.overrideReason } : {}),
  };
}

/** The compact record of a decision that is stored with the `lead.assigned` event. */
export function assignmentRecord(decision: AssignmentDecision): RoutingRecord {
  const routing = decision.routing;
  return {
    method: decision.method,
    explanation: decision.explanation,
    ...(decision.overrideReason ? { override_reason: decision.overrideReason } : {}),
    ...(routing
      ? {
          pool: routing.pool,
          priority: routing.priority,
          copy_in: routing.copyIn.map((c) => ({ staff_id: c.staffId, reason: c.code })),
          candidates: routing.candidates.map((c) => ({
            staff_id: c.staffId,
            total: c.total,
            ...(c.excludedBecause ? { excluded: c.excludedBecause } : {}),
          })),
        }
      : {}),
  };
}
