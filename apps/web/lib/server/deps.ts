import 'server-only';
import { getActivePack } from '@healwyn/core';
import { after } from 'next/server';
import { getLeadStore } from './lead-store';
import { sendLeadNotification } from './notify';
import type { SubmissionDeps } from './submit';

export function defaultSubmissionDeps(): SubmissionDeps {
  return {
    store: getLeadStore(),
    pack: getActivePack(),
    notify: (notification) => sendLeadNotification(notification),
    schedule: (task) => after(task),
  };
}
