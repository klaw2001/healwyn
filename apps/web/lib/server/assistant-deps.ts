import 'server-only';
import type { IndustryPack } from '@healwyn/core';
import type { AssistantDeps } from './assistant';
import { getLeadStore } from './lead-store';
import { textService, voiceTokenMinter } from './voice-service';

export function defaultAssistantDeps(pack: IndustryPack): AssistantDeps {
  return { store: getLeadStore(), pack, text: textService(), voiceToken: voiceTokenMinter() };
}
