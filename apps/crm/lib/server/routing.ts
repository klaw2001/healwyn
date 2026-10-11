import 'server-only';
import {
  assignLead as decideAssignment,
  type AssignableLead,
  type AssignmentDecision,
  type RosterMember,
  type RoutingDecision,
  type StaffRole,
  type UrgencyLevel,
} from '@healwyn/core';
import { asStaff, type Tx } from './db';
import { packOf } from './pack';
import type { Session } from './session';
import { packLabels } from '../format';

interface ContextJson {
  lead: {
    id: string;
    /** The lead's industry: routing uses its pack and its staff only. */
    industry: string;
    specialty_slug: string | null;
    urgency: UrgencyLevel;
    preferred_language: string;
    billing_flag: boolean;
    assigned_staff_id: string | null;
  };
  previous_staff_id: string | null;
  roster: {
    id: string;
    full_name: string;
    role: StaffRole;
    level: string;
    active: boolean;
    specialties: string[];
    languages: string[];
    capacity: number;
    open_leads: number;
    last_assigned_at: string | null;
  }[];
}

export interface RoutingContext {
  industry: string;
  lead: AssignableLead;
  roster: RosterMember[];
}

export function parseRoutingContext(json: ContextJson): RoutingContext {
  return {
    industry: json.lead.industry,
    lead: {
      id: json.lead.id,
      specialtySlug: json.lead.specialty_slug,
      urgency: json.lead.urgency,
      preferredLanguage: json.lead.preferred_language,
      assignedStaffId: json.lead.assigned_staff_id,
      billingFlag: json.lead.billing_flag,
      previousStaffId: json.previous_staff_id,
    },
    roster: json.roster.map((m) => ({
      id: m.id,
      fullName: m.full_name,
      role: m.role,
      level: m.level,
      active: m.active,
      specialties: m.specialties,
      languages: m.languages,
      capacity: m.capacity,
      openLeads: Number(m.open_leads),
      lastAssignedAt: m.last_assigned_at ? new Date(m.last_assigned_at) : null,
    })),
  };
}

/**
 * Serialises routing decisions for the rest of the transaction, so two decisions made at the same
 * time (a staff member accepting a suggestion while a call result arrives) see each other's load.
 */
export async function lockRouting(tx: Tx): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtext('healwyn:routing'))`;
}

/** Runs the routing engine for a lead, as the signed-in staff member (managers and coordinators). */
export async function routeForStaff(
  tx: Tx,
  leadId: string,
): Promise<{ context: RoutingContext; decision: AssignmentDecision }> {
  const [row] = await tx<{ c: ContextJson }[]>`select public.routing_context(${leadId}, null) as c`;
  return route(parseRoutingContext(row!.c));
}

/** Runs the routing engine for a lead with no staff session (the voice webhook). */
export async function routeForSystem(
  tx: Tx,
  leadId: string,
): Promise<{ context: RoutingContext; decision: AssignmentDecision }> {
  const [row] = await tx<{ c: ContextJson }[]>`select public.system_routing_context(${leadId}, null) as c`;
  return route(parseRoutingContext(row!.c));
}

function route(context: RoutingContext) {
  const pack = packOf(context.industry);
  const decision = decideAssignment(context.lead, {
    mode: 'auto',
    roster: context.roster,
    config: pack.routing,
    staffLevels: pack.staffLevels,
    offeringName: packLabels(pack).specialtyLabel,
  });
  return { context, decision };
}

/** The routing engine's suggestion for the profile page (front desk only), or null if it cannot run. */
export async function suggestRouting(session: Session, leadId: string): Promise<RoutingDecision | null> {
  try {
    return await asStaff(session, async (tx) => (await routeForStaff(tx, leadId)).decision.routing ?? null);
  } catch {
    return null;
  }
}
