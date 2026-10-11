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

/** Stages the billing desk always sees (payments and packages). */
export const BILLING_STAGES = ['package_active'] as const;

export interface LeadVisibilityFacts {
  assignedStaffId: string | null;
  hasInsurance: boolean;
  stage: string;
}

/** TypeScript twin of the RLS rule, for UI decisions and for testing the policies. */
export function canSeeLead(role: StaffRole, staffId: string, lead: LeadVisibilityFacts): boolean {
  switch (LEAD_VISIBILITY[role]) {
    case 'all':
      return true;
    case 'assigned':
      return lead.assignedStaffId === staffId;
    case 'assigned_or_billing':
      return (
        lead.assignedStaffId === staffId ||
        lead.hasInsurance ||
        (BILLING_STAGES as readonly string[]).includes(lead.stage)
      );
  }
}

/** The screen a role lands on after signing in. */
export function homePathFor(role: StaffRole): string {
  return role === 'manager' ? '/pipeline' : '/workspace';
}
