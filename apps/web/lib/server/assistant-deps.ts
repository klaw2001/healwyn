import 'server-only';
import { getActivePack } from '@healwyn/core';
import type { AssistantDeps } from './assistant';
import { getLeadStore } from './lead-store';
import { textService, voiceTokenMinter } from './voice-service';

export function defaultAssistantDeps(): AssistantDeps {
  return { store: getLeadStore(), pack: getActivePack(), text: textService(), voiceToken: voiceTokenMinter() };
}
