import { LANGUAGE_NAMES, STOP_REASON_LABELS, type IndustryPack, type StaffRole, type StopReason } from '@healwyn/core';

export const TIME_ZONE = 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const dateOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const timeOnly = new Intl.DateTimeFormat('en-IN', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' });
const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const formatDateTime = (date: Date | string) => dateTime.format(new Date(date));
export const formatDay = (date: Date | string) => dateOnly.format(new Date(date));
export const formatTime = (date: Date | string) => timeOnly.format(new Date(date));
/** "2026-10-11" in India time. */
export const indiaDay = (date: Date | string) => dayKey.format(new Date(date));

/** End of today in India time. */
export function endOfIndiaDay(now: Date = new Date(), plusDays = 0): Date {
  return new Date(new Date(`${indiaDay(now)}T23:59:59.999+05:30`).getTime() + plusDays * 86_400_000);
}

export function formatRelative(date: Date | string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(date).getTime()) / 60_000);
  const future = minutes < 0;
  const abs = Math.abs(minutes);
  const text =
    abs < 1
      ? 'just now'
      : abs < 60
        ? `${abs} min`
        : abs < 1440
          ? `${Math.round(abs / 60)} h`
          : `${Math.round(abs / 1440)} d`;
  if (text === 'just now') return text;
  return future ? `in ${text}` : `${text} ago`;
}

export function initials(name: string | null): string {
  if (!name) return '–';
  return name
    .replace(/^Dr\.?\s+/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export const languageLabel = (code: string) => LANGUAGE_NAMES[code] ?? code;
export const stopReasonLabel = (reason: string | null) =>
  reason ? (STOP_REASON_LABELS[reason as StopReason] ?? reason.replaceAll('_', ' ')) : '';

export const SOURCE_LABELS: Record<string, string> = {
  web_form: 'Website form',
  partner_form: 'Partner form',
  voice: 'Voice assistant',
  phone: 'Phone',
  staff: 'Added by staff',
  seed: 'Demo data',
};
export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source.replaceAll('_', ' ');

export const CHANNEL_LABELS: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };

/**
 * Why a lead went to someone. The words live in `assignment_explanations` (erased with the lead);
 * events written before that table existed carried them in the payload.
 */
export function assignmentExplanation(event: {
  type: string;
  payload: Record<string, unknown>;
  explanation?: string[] | null;
}): string[] {
  if (event.type !== 'lead.assigned') return [];
  if (event.explanation) return event.explanation;
  const routing = event.payload.routing as { explanation?: unknown } | undefined;
  return Array.isArray(routing?.explanation)
    ? routing.explanation.filter((l): l is string => typeof l === 'string')
    : [];
}

const CALL_CHANNELS: Record<string, string> = {
  browser: 'browser voice',
  phone: 'phone',
  simulated: 'simulated dialer',
  text: 'typed chat',
};
const CALL_OUTCOMES: Record<string, string> = {
  completed: 'qualified',
  consent_declined: 'caller declined',
  no_consent: 'no clear consent',
  emergency: 'emergency advice given',
  caller_ended: 'caller ended early',
  limit_reached: 'time limit reached',
  error: 'failed',
};
export const CALL_REFUSALS: Record<string, string> = {
  no_call_consent: 'no consent for assistant calls',
  opted_out: 'the lead unsubscribed',
  erased: 'details erased',
  outside_call_window: 'outside 9am to 9pm India time',
  no_phone: 'no phone number',
  number_not_verified: 'number not on the verified demo list',
  daily_limit: 'daily call limit reached',
  phone_daily_limit: 'this number reached its daily call limit',
  not_configured: 'assistant calls are not set up for this industry',
  telephony_not_configured: 'phone calling is not set up',
};

/**
 * Labels that depend on the industry pack: stages, offerings, roles, sequences,
 * answers and audit events. Server components make one per request from the
 * signed-in staff member's pack.
 */
export function packLabels(pack: IndustryPack) {
  const stageLabel = (id: string) => pack.stages.find((s) => s.id === id)?.label ?? id;
  const specialtyLabel = (slug: string | null) =>
    slug ? (pack.offerings.find((o) => o.slug === slug)?.name ?? slug) : 'Not sure yet';
  const roleLabel = (role: string) => pack.roleLabels[role as StaffRole] ?? role;
  const sequenceName = (id: string) => pack.sequences.find((s) => s.id === id)?.name ?? id;
  const answerLabel = (questionId: string, value: string): string => {
    const question = pack.intake.questions.find((q) => q.id === questionId);
    if (question && (question.kind === 'select' || question.kind === 'radio')) {
      return question.options.find((o) => o.value === value)?.label ?? value;
    }
    return value;
  };
  const describe = (type: string, payload: Record<string, unknown>, staffName: (id: unknown) => string) =>
    describeEvent(type, payload, staffName, { stageLabel, sequenceName });
  return { stageLabel, specialtyLabel, roleLabel, sequenceName, answerLabel, describeEvent: describe };
}

export type PackLabels = ReturnType<typeof packLabels>;

/** One readable line per audit event. Payloads hold ids and codes only. */
function describeEvent(
  type: string,
  payload: Record<string, unknown>,
  staffName: (id: unknown) => string,
  { stageLabel, sequenceName }: { stageLabel: (id: string) => string; sequenceName: (id: string) => string },
): string {
  const p = payload as Record<string, string | number | boolean | null | Record<string, boolean>>;
  switch (type) {
    case 'lead.created':
      return p.source === 'partner_form' ? 'Partner enquiry received' : 'Enquiry received from the website';
    case 'consent.recorded': {
      const purposes = (p.purposes ?? {}) as Record<string, boolean>;
      const granted = Object.entries(purposes)
        .filter(([, v]) => v)
        .map(([k]) => k.replaceAll('_', ' '));
      return `Consent recorded: ${granted.join(', ') || 'none'}`;
    }
    case 'consent.withdrawn':
      return `Consent withdrawn: ${String(p.purpose).replaceAll('_', ' ')}${p.erase ? ' (details erased)' : ''}`;
    case 'consent.withdrawal_recorded':
      return 'Withdrawal recorded by staff';
    case 'lead.erased':
      return 'Personal details erased';
    case 'stage.changed':
      return `Moved from ${stageLabel(String(p.from))} to ${stageLabel(String(p.to))}${p.reason === 'undo' ? ' (undo)' : ''}`;
    case 'lead.assigned':
      if (!p.to_staff_id) return 'Unassigned';
      if (p.method === 'routing') return `Routed to ${staffName(p.to_staff_id)}`;
      return `Assigned to ${staffName(p.to_staff_id)}${p.method === 'override' ? ' (overriding the suggestion)' : ''}`;
    case 'note.added':
      return 'Note added';
    case 'appointment.booked':
      return `Booked with ${staffName(p.staff_id)}${p.via === 'website' ? ' (by the lead, online)' : ''}`;
    case 'appointment.rescheduled':
      return `Moved the booking with ${staffName(p.staff_id)}`;
    case 'appointment.cancelled':
      return 'Booking cancelled';
    case 'appointment.attended':
      return 'Attended';
    case 'appointment.no_show':
      return 'Missed the booking';
    case 'task.created':
      return `Task created for ${staffName(p.assignee_staff_id)}`;
    case 'task.completed':
      return 'Task completed';
    case 'lead.replied':
      return 'Marked as replied';
    case 'message.received':
      return `Reply received by ${CHANNEL_LABELS[String(p.channel)] ?? p.channel}`;
    case 'lead.opted_out':
      return 'Unsubscribed from messages';
    case 'sequence.enrolled':
      return `Started “${sequenceName(String(p.sequence_id))}”`;
    case 'sequence.stopped':
      return `Stopped “${sequenceName(String(p.sequence_id))}”: ${stopReasonLabel(String(p.reason)).toLowerCase()}`;
    case 'sequence.stopped_by_staff':
      return `“${sequenceName(String(p.sequence_id))}” stopped by staff`;
    case 'message.sent':
      return `${CHANNEL_LABELS[String(p.channel)] ?? p.channel} ${p.status === 'simulated' ? 'simulated' : p.status === 'logged' ? 'logged (no provider)' : 'sent'}`;
    case 'call.started':
      return `Assistant call started (${CALL_CHANNELS[String(p.channel)] ?? p.channel})`;
    case 'call.completed':
      return `Assistant call ended: ${CALL_OUTCOMES[String(p.outcome)] ?? p.outcome}`;
    case 'call.refused':
      return `Assistant call not placed: ${CALL_REFUSALS[String(p.reason)] ?? p.reason}`;
    case 'safety.flagged':
      // The category is on the call (AI summary panel), not in the audit trail, which outlives erasure.
      return 'Safety concern on the assistant call: told to seek emergency help, flagged urgent';
    case 'call.fallback':
      return 'Assistant call continued by typing';
    case 'call.failed':
      return 'Assistant call result could not be used';
    case 'message.failed':
      return `${CHANNEL_LABELS[String(p.channel)] ?? p.channel} failed after retries`;
    default:
      return type.replaceAll('.', ' ').replaceAll('_', ' ');
  }
}
