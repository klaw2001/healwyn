import 'server-only';
import {
  assignmentRecord,
  leadUpdateFromCall,
  planStageEntry,
  shouldRouteAfterCall,
  stageAfterCall,
  type VoiceCallResult,
} from '@healwyn/core';
import { system } from './db';
import { packOf } from './pack';
import { lockRouting, routeForSystem } from './routing';
import { scoreFromInput, type ScoreInputJson } from './scores';

interface Recorded {
  status: 'recorded' | 'duplicate' | 'superseded';
  lead_id: string;
  stage?: string;
  assigned_staff_id?: string | null;
  active_sequences?: string[];
}

export interface VoiceOutcome {
  status: 'recorded' | 'duplicate' | 'superseded';
  stage?: string;
  assignedStaffId?: string | null;
}

/**
 * Applies a finished call in one transaction: record the call and what the
 * caller said, move a new lead to the triaged stage (with that stage's nurture
 * plan), route it if nobody owns it yet, and create an urgent task after a red
 * flag. Routing decisions are serialised so concurrent calls see each other's
 * load. Replays of the same call change nothing.
 */
export async function applyVoiceResult(result: VoiceCallResult): Promise<VoiceOutcome> {
  // The answers are checked against the lead's own industry pack.
  const [found] = await system()<{ industry: string | null }[]>`
    select public.call_lead_industry(${result.callId}, ${result.leadId}) as industry`;
  if (!found?.industry) throw Object.assign(new Error('unknown call'), { code: 'P0002' });
  const pack = packOf(found.industry);
  const update = leadUpdateFromCall(result, pack);
  return system().begin(async (tx) => {
    await lockRouting(tx);
    const [row] = await tx<{ r: Recorded }[]>`
      select public.record_voice_call(${tx.json(result as never)}, ${tx.json(update as never)}) as r`;
    const recorded = row!.r;
    // A replay, or the voice agent reporting a call that continued as a typed chat: nothing to apply.
    if (recorded.status !== 'recorded') return { status: recorded.status } as VoiceOutcome;

    const toStage = stageAfterCall(result, recorded.stage!, pack);
    const plan = toStage ? planStageEntry(pack.sequences, toStage, recorded.active_sequences ?? []) : null;

    let staffId: string | null = null;
    let routing: object | null = null;
    if (shouldRouteAfterCall(result, recorded.assigned_staff_id ?? null)) {
      const { decision } = await routeForSystem(tx, result.leadId);
      if (decision.staffId) {
        staffId = decision.staffId;
        routing = assignmentRecord(decision);
      }
    }

    const [applied] = await tx<
      { r: { stage: string; assigned_staff_id: string | null; score_input: ScoreInputJson } }[]
    >`
      select public.apply_voice_outcome(${result.leadId}, ${result.callId}, ${toStage},
                                        ${plan ? tx.json(plan as never) : null}, ${staffId},
                                        ${routing ? tx.json(routing as never) : null}) as r`;
    const score = scoreFromInput(applied!.r.score_input);
    if (score) {
      await tx`select public.save_call_lead_score(${result.leadId}, ${result.callId}, ${score.score}, ${score.band},
                                                  ${tx.json(score.factors as never)})`;
    }
    return { status: 'recorded', stage: applied!.r.stage, assignedStaffId: applied!.r.assigned_staff_id };
  }) as Promise<VoiceOutcome>;
}

/** Closes a call whose result the CRM cannot accept, so it does not stay "started". */
export async function failVoiceCall(callId: string, leadId: string, code: string): Promise<boolean> {
  const [row] = await system()<{ ok: boolean }[]>`select public.fail_voice_call(${callId}, ${leadId}, ${code}) as ok`;
  return row?.ok === true;
}
