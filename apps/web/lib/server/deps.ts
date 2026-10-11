import 'server-only';
import type { IndustryPack } from '@healwyn/core';
import { after } from 'next/server';
import { getLeadStore } from './lead-store';
import { sendLeadNotification } from './notify';
import type { SubmissionDeps } from './submit';

export function defaultSubmissionDeps(pack: IndustryPack): SubmissionDeps {
  return {
    store: getLeadStore(),
    pack,
    notify: (notification) => sendLeadNotification(notification),
    schedule: (task) => after(task),
  };
}
