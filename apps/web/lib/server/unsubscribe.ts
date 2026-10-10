import 'server-only';
import { verifyUnsubscribeToken } from '@healwyn/messaging';
import { getLeadStore } from './lead-store';
import { errorFields, log } from './log';

export type UnsubscribeOutcome = 'done' | 'invalid' | 'error';

/** Verifies a signed unsubscribe token and records the opt-out at once. */
export async function unsubscribeWithToken(
  token: string | null,
  source: 'email_link' | 'one_click',
): Promise<UnsubscribeOutcome> {
  if (!token) return 'invalid';
  let leadId: string | null;
  try {
    leadId = await verifyUnsubscribeToken(token, process.env.UNSUBSCRIBE_SECRET);
  } catch (error) {
    log.error('unsubscribe.misconfigured', errorFields(error));
    return 'error';
  }
  if (!leadId) return 'invalid';
  try {
    await getLeadStore().optOut(leadId, source);
    log.info('unsubscribe.recorded', { source });
    return 'done';
  } catch (error) {
    log.error('unsubscribe.failed', errorFields(error));
    return 'error';
  }
}
