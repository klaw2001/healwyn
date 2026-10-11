/**
 * The CRM permissions matrix. The UI hides what a role cannot do, server
 * actions refuse it, and row level security enforces lead visibility in the
 * database (see 20261011000002_crm_security.sql). Tests check that the SQL
 * policies and `canSeeLead` agree on every seeded lead.
 */

export const STAFF_ROLES = ['manager', 'care_coordinator', 'specialist_doctor', 'billing_desk'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  manager: 'Manager',
  care_coordinator: 'Care coordinator',
  specialist_doctor: 'Specialist doctor',
  billing_desk: 'Insurance and billing desk',
};

export const CAPABILITIES = [
  // Screens
  'screen.pipeline',
  'screen.workspace',
  'screen.sequences',
  'screen.dashboard',
  'screen.team',
  'screen.assistant',
  // Leads
  'lead.changeStage',
  'lead.assign',
  'lead.note',
  'lead.task',
  'lead.markReplied',
  'lead.recordWithdrawal',
  'lead.overrideRouting',
  'lead.placeCall',
  // Configuration
  'sequence.manage',
  'staff.manage',
  'booking.manage',
  'assistant.manage',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ALL: readonly StaffRole[] = STAFF_ROLES;
const FRONT_DESK: readonly StaffRole[] = ['manager', 'care_coordinator'];

export const PERMISSIONS: Record<Capability, readonly StaffRole[]> = {
  'screen.pipeline': ALL,
  'screen.workspace': ALL,
  'screen.sequences': ['manager'],
  'screen.dashboard': ['manager'],
  'screen.team': ['manager'],
  'screen.assistant': ['manager'],
  'lead.changeStage': ALL,
  'lead.assign': FRONT_DESK,
  'lead.note': ALL,
  'lead.task': ALL,
  'lead.markReplied': ALL,
  'lead.recordWithdrawal': FRONT_DESK,
  'lead.overrideRouting': FRONT_DESK,
  'lead.placeCall': FRONT_DESK,
  'sequence.manage': ['manager'],
  'staff.manage': ['manager'],
  'booking.manage': ['manager', 'care_coordinator', 'billing_desk'],
  'assistant.manage': ['manager'],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export function can(role: StaffRole, capability: Capability): boolean {
  return PERMISSIONS[capability].includes(role);
}

export type LeadVisibility = 'all' | 'assigned' | 'assigned_or_billing';

/** Which leads a role may read. Mirrored by the `staff_can_see_lead` SQL function. */
export const LEAD_VISIBILITY: Record<StaffRole, LeadVisibility> = {
  manager: 'all',
  care_coordinator: 'all',
  specialist_doctor: 'assigned',
  billing_desk: 'assigned_or_billing',
};

export interface LeadVisibilityFacts {
  /** The lead's industry pack id: staff see only their own industry's leads. */
  industry: string;
  assignedStaffId: string | null;
  /** The pack's billing rule matched (clinic: has insurance). */
  hasInsurance: boolean;
  /** The lead is in its pack's won stage (paid); the billing desk sees those. */
  stageIsWon: boolean;
}

/** TypeScript twin of the RLS rule (`staff_can_see_lead`), for UI decisions and for testing the policies. */
export function canSeeLead(
  role: StaffRole,
  staff: { id: string; industry: string },
  lead: LeadVisibilityFacts,
): boolean {
  if (lead.industry !== staff.industry) return false;
  switch (LEAD_VISIBILITY[role]) {
    case 'all':
      return true;
    case 'assigned':
      return lead.assignedStaffId === staff.id;
    case 'assigned_or_billing':
      return lead.assignedStaffId === staff.id || lead.hasInsurance || lead.stageIsWon;
  }
}

/** The screen a role lands on after signing in. */
export function homePathFor(role: StaffRole): string {
  return role === 'manager' ? '/pipeline' : '/workspace';
}
