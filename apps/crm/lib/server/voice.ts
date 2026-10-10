import 'server-only';
import {
  assignmentRecord,
  getActivePack,
  leadUpdateFromCall,
  planStageEntry,
  shouldRouteAfterCall,
  stageAfterCall,
  type VoiceCallResult,
} from '@healwyn/core';
import { system } from './db';
import { routeForSystem } from './routing';
import { scoreFromInput, type ScoreInputJson } from './scores';

const pack = getActivePack();

interface Recorded {
  status: 'recorded' | 'duplicate';
  lead_id: string;
  stage?: string;
  assigned_staff_id?: string | null;
  active_sequences?: string[];
}

export interface VoiceOutcome {
  status: 'recorded' | 'duplicate';
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
  const update = leadUpdateFromCall(result, pack);
  return system().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('healwyn:routing'))`;
    const [row] = await tx<{ r: Recorded }[]>`
      select public.record_voice_call(${tx.json(result as never)}, ${tx.json(update as never)}) as r`;
    const recorded = row!.r;
    if (recorded.status === 'duplicate') return { status: 'duplicate' } as VoiceOutcome;

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
