import type { UrgencyLevel } from '../crm/types';
import type { StaffRole } from '../permissions';

/**
 * Routing configuration, set per industry pack. Weights are points: a factor
 * scores between 0 and its weight, and the candidate with the most points wins.
 */
export interface RoutingConfig {
  readonly weights: {
    /** Speaks the lead's preferred language. */
    readonly language: number;
    /** Seniority (staff level rank), scaled by how urgent the lead is. */
    readonly seniority: number;
    /** Spare capacity: 1 − open leads ÷ capacity. */
    readonly load: number;
    /** The returning patient's previous clinician. */
    readonly continuity: number;
  };
  /** How strongly urgency asks for seniority, 0..1 (multiplies the seniority weight). */
  readonly urgencySeniority: Readonly<Record<UrgencyLevel, number>>;
  /** Urgent leads go only to staff at or above this level rank when anyone qualifies. */
  readonly urgentMinRank: number;
  /** Roles that take leads for an offering they list. */
  readonly specialistRoles: readonly StaffRole[];
  /** Role that takes leads with no offering, or when no specialist covers it. */
  readonly fallbackRole: StaffRole;
  /** Role copied in when the pack's billing rule flags a lead (e.g. insurance). */
  readonly billingRole: StaffRole | null;
}

export interface RosterMember {
  readonly id: string;
  readonly fullName: string;
  readonly role: StaffRole;
  /** Staff level id from the pack (its rank comes from `pack.staffLevels`). */
  readonly level: string;
  readonly active: boolean;
  readonly specialties: readonly string[];
  readonly languages: readonly string[];
  readonly capacity: number;
  /** Leads currently assigned to this person in open stages. */
  readonly openLeads: number;
  /** When this person was last assigned a lead (for round-robin tie-breaks). */
  readonly lastAssignedAt: Date | null;
}

export interface RoutableLead {
  readonly id: string;
  /** Offering slug, or null when the lead is unsure. */
  readonly specialtySlug: string | null;
  readonly urgency: UrgencyLevel;
  readonly preferredLanguage: string;
  /** Set by the pack's billing rule (clinic: has insurance). */
  readonly billingFlag: boolean;
  /** The clinician who saw this person last time, for returning patients. */
  readonly previousStaffId: string | null;
}

export interface FactorScore {
  readonly id: 'language' | 'seniority' | 'load' | 'continuity';
  readonly label: string;
  readonly points: number;
  readonly max: number;
}

export interface CandidateScore {
  readonly staffId: string;
  readonly name: string;
  readonly total: number;
  readonly factors: readonly FactorScore[];
  /** Why this person was not eligible, when they were filtered out. */
  readonly excludedBecause?: string;
}

export interface CopyIn {
  readonly staffId: string;
  readonly name: string;
  readonly role: StaffRole;
  /** Stable code stored with the assignment (e.g. `insurance_check`). */
  readonly code: 'insurance_check';
  readonly reason: string;
}

export interface RoutingDecision {
  /** The chosen person, or null when nobody at all is available. */
  readonly staffId: string | null;
  readonly staffName: string | null;
  /** Whether the lead went to the specialty team or the fallback team. */
  readonly pool: 'specialty' | 'fallback';
  /** Urgent leads go to the front of the queue. */
  readonly priority: 'front' | 'normal';
  readonly copyIn: readonly CopyIn[];
  /** Every candidate considered, best first, with their scores (excluded ones last). */
  readonly candidates: readonly CandidateScore[];
  /** Plain-language reasons, for the lead's timeline and the manager. */
  readonly explanation: readonly string[];
}

/** What is stored with a `lead.assigned` event: codes, ids, points and the explanation. */
export interface RoutingRecord {
  readonly method: 'manual' | 'override' | 'routing';
  readonly explanation: readonly string[];
  readonly pool?: 'specialty' | 'fallback';
  readonly priority?: 'front' | 'normal';
  readonly copy_in?: readonly { staff_id: string; reason: string }[];
  readonly candidates?: readonly { staff_id: string; total: number; excluded?: string }[];
  readonly override_reason?: string;
}
