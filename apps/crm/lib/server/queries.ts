import 'server-only';
import type { Session } from './session';
import { asStaff, type Tx } from './db';
import type postgres from 'postgres';

export interface LeadRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  stage: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  lead_type: 'individual' | 'partner';
  source: string;
  specialty_slug: string | null;
  preferred_language: string;
  assigned_staff_id: string | null;
  assignee_name: string | null;
  created_at: Date;
  updated_at: Date;
  first_response_at: Date | null;
  last_inbound_at: Date | null;
  opted_out_at: Date | null;
  erased_at: Date | null;
  billing_flag: boolean;
  is_demo: boolean;
  answers: Record<string, string>;
  score: number | null;
  band: 'hot' | 'warm' | 'cool' | null;
  open_tasks: number;
}

export interface LeadFilters {
  assignee?: string;
  specialty?: string;
  language?: string;
  urgency?: string;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
  type?: 'individual' | 'partner' | 'all';
}

const LEAD_COLUMNS = (tx: Tx) => tx`
  l.id, l.full_name, l.phone, l.email, l.stage, l.urgency, l.lead_type, l.source, l.specialty_slug,
  l.preferred_language, l.assigned_staff_id, s.full_name as assignee_name, l.created_at, l.updated_at,
  l.first_response_at, l.last_inbound_at, l.opted_out_at, l.erased_at, l.billing_flag, l.is_demo, l.answers,
  sc.score, sc.band,
  (select count(*)::int from public.tasks t where t.lead_id = l.id and t.completed_at is null) as open_tasks`;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Leads the signed-in person may see (RLS), with optional filters. */
export async function listLeads(session: Session, filters: LeadFilters = {}): Promise<LeadRow[]> {
  return asStaff(session, async (tx) => {
    const assignee =
      filters.assignee === 'me'
        ? tx`and l.assigned_staff_id = ${session.staffId}`
        : filters.assignee === 'unassigned'
          ? tx`and l.assigned_staff_id is null`
          : filters.assignee
            ? tx`and l.assigned_staff_id = ${filters.assignee}`
            : tx``;
    const type = filters.type === 'all' ? tx`` : tx`and l.lead_type = ${filters.type ?? 'individual'}`;
    const q = filters.q?.trim();
    const rows = await tx<LeadRow[]>`
      select ${LEAD_COLUMNS(tx)}
      from public.leads l
      left join public.staff s on s.id = l.assigned_staff_id
      left join public.lead_scores sc on sc.lead_id = l.id
      where l.erased_at is null
        ${type}
        ${assignee}
        ${filters.specialty ? tx`and l.specialty_slug = ${filters.specialty}` : tx``}
        ${filters.language ? tx`and l.preferred_language = ${filters.language}` : tx``}
        ${filters.urgency ? tx`and l.urgency = ${filters.urgency}` : tx``}
        ${filters.source ? tx`and l.source = ${filters.source}` : tx``}
        ${filters.from && DAY_PATTERN.test(filters.from) ? tx`and l.created_at >= ${`${filters.from}T00:00:00+05:30`}::timestamptz` : tx``}
        ${filters.to && DAY_PATTERN.test(filters.to) ? tx`and l.created_at < (${`${filters.to}T00:00:00+05:30`}::timestamptz + interval '1 day')` : tx``}
        ${
          q
            ? tx`and (l.full_name ilike ${likePattern(q)} or l.phone like ${likePattern(q.replace(/\s+/g, ''))} or l.email ilike ${likePattern(q)})`
            : tx``
        }
      order by l.created_at desc
      limit 500`;
    return rows;
  });
}

export interface StaffOption {
  id: string;
  full_name: string;
  role: string;
  title: string;
  specialties: string[];
  languages: string[];
}

export async function listStaff(session: Session): Promise<StaffOption[]> {
  return asStaff(
    session,
    (tx) => tx<StaffOption[]>`
      select id, full_name, role, title, specialties, languages from public.staff
      where active order by case role when 'care_coordinator' then 1 when 'specialist_doctor' then 2 when 'billing_desk' then 3 else 4 end, full_name`,
  );
}

export interface TimelineEvent {
  id: string;
  type: string;
  actor_type: string;
  actor_name: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

export interface NoteRow {
  id: string;
  body: string;
  template_id: string | null;
  author_name: string | null;
  created_at: Date;
}

export interface TaskRow {
  id: string;
  lead_id: string;
  lead_name: string | null;
  title: string;
  due_at: Date;
  remind_at: Date | null;
  completed_at: Date | null;
  assignee_staff_id: string | null;
  assignee_name: string | null;
}

export interface MessageRow {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  direction: 'outbound' | 'inbound';
  status: string;
  template_id: string | null;
  subject: string | null;
  body: string | null;
  created_at: Date;
}

export interface ConsentRow {
  purpose: string;
  granted: boolean;
  required: boolean;
  text_version: string;
  source: string;
  recorded_at: Date;
}

export interface EnrollmentRow {
  id: string;
  sequence_id: string;
  status: 'active' | 'completed' | 'stopped';
  stop_reason: string | null;
  enrolled_at: Date;
  ended_at: Date | null;
  steps: { step_index: number; channel: string; template_id: string; due_at: string; status: string }[];
}

export interface CallRow {
  id: string;
  channel: string;
  status: 'started' | 'completed';
  started_at: Date;
  duration_seconds: number | null;
  language: string | null;
  outcome: string | null;
  urgency: string | null;
  answers: Record<string, string>;
  safety_flags: { kind: string; code: string; turn: number }[];
  summary: string[];
  transcript: { speaker: 'assistant' | 'caller'; text: string; atSeconds: number }[];
}

export interface LeadProfile {
  lead: LeadRow;
  calls: CallRow[];
  factors: { id: string; label: string; points: number }[];
  events: TimelineEvent[];
  notes: NoteRow[];
  tasks: TaskRow[];
  messages: MessageRow[];
  consents: ConsentRow[];
  enrollments: EnrollmentRow[];
}

export async function getLeadProfile(session: Session, id: string): Promise<LeadProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return asStaff(session, async (tx) => {
    const [lead] = await tx<LeadRow[]>`
      select ${LEAD_COLUMNS(tx)}
      from public.leads l
      left join public.staff s on s.id = l.assigned_staff_id
      left join public.lead_scores sc on sc.lead_id = l.id
      where l.id = ${id}`;
    if (!lead) return null;
    const [score] = await tx<
      { factors: LeadProfile['factors'] }[]
    >`select factors from public.lead_scores where lead_id = ${id}`;
    const events = await tx<TimelineEvent[]>`
      select e.id::text, e.type, e.actor_type, st.full_name as actor_name, e.payload, e.created_at
      from public.lead_events e left join public.staff st on st.id = e.actor_id
      where e.lead_id = ${id} order by e.created_at desc, e.id desc`;
    const notes = await tx<NoteRow[]>`
      select n.id, n.body, n.template_id, st.full_name as author_name, n.created_at
      from public.notes n left join public.staff st on st.id = n.author_staff_id
      where n.lead_id = ${id} order by n.created_at desc`;
    const tasks = await tx<TaskRow[]>`
      select t.id, t.lead_id, null::text as lead_name, t.title, t.due_at, t.remind_at, t.completed_at,
             t.assignee_staff_id, st.full_name as assignee_name
      from public.tasks t left join public.staff st on st.id = t.assignee_staff_id
      where t.lead_id = ${id} order by t.completed_at nulls first, t.due_at`;
    const messages = await tx<MessageRow[]>`
      select id, channel, direction, status, template_id, subject, body, created_at
      from public.messages where lead_id = ${id} order by created_at desc`;
    const consents = await tx<ConsentRow[]>`
      select purpose, granted, required, text_version, source, recorded_at
      from public.consent_records where lead_id = ${id} order by recorded_at, id`;
    const enrollments = await tx<EnrollmentRow[]>`
      select e.id, e.sequence_id, e.status, e.stop_reason, e.enrolled_at, e.ended_at,
             coalesce((select json_agg(json_build_object('step_index', s.step_index, 'channel', s.channel,
                        'template_id', s.template_id, 'due_at', s.due_at, 'status', s.status) order by s.step_index)
                       from public.scheduled_messages s where s.enrollment_id = e.id), '[]') as steps
      from public.sequence_enrollments e where e.lead_id = ${id} order by e.enrolled_at desc`;
    const calls = await tx<CallRow[]>`
      select id, channel, status, started_at, duration_seconds, language, outcome, urgency, answers, safety_flags,
             summary, transcript
      from public.call_sessions where lead_id = ${id} order by started_at desc limit 10`;
    return { lead, calls, factors: score?.factors ?? [], events, notes, tasks, messages, consents, enrollments };
  });
}

export async function listTasks(
  session: Session,
  options: { assignee: 'me' | 'all'; until: Date; includeCompleted?: boolean },
): Promise<TaskRow[]> {
  return asStaff(
    session,
    (tx) => tx<TaskRow[]>`
      select t.id, t.lead_id, l.full_name as lead_name, t.title, t.due_at, t.remind_at, t.completed_at,
             t.assignee_staff_id, st.full_name as assignee_name
      from public.tasks t
      join public.leads l on l.id = t.lead_id
      left join public.staff st on st.id = t.assignee_staff_id
      where t.due_at < ${options.until}
        ${options.assignee === 'me' ? tx`and t.assignee_staff_id = ${session.staffId}` : tx``}
        ${options.includeCompleted ? tx`` : tx`and t.completed_at is null`}
      order by t.due_at`,
  );
}

/** Open tasks assigned to this user whose reminder time (or due time) has passed. */
export async function countDueReminders(session: Session): Promise<number> {
  const [row] = await asStaff(
    session,
    (tx) => tx<{ n: number }[]>`
      select count(*)::int as n from public.tasks
      where assignee_staff_id = ${session.staffId} and completed_at is null
        and coalesce(remind_at, due_at) <= now()`,
  );
  return row?.n ?? 0;
}

export interface SequenceStats {
  sequence_id: string;
  active: number;
  completed: number;
  stopped: number;
  messages: number;
  paused: boolean;
  next_due: Date | null;
}

export async function sequenceStats(session: Session): Promise<SequenceStats[]> {
  return asStaff(
    session,
    (tx) => tx<SequenceStats[]>`
      with ids as (
        select distinct sequence_id from public.sequence_enrollments
        union select sequence_id from public.sequence_settings
      )
      select ids.sequence_id,
             (select count(*)::int from public.sequence_enrollments e where e.sequence_id = ids.sequence_id and e.status = 'active') as active,
             (select count(*)::int from public.sequence_enrollments e where e.sequence_id = ids.sequence_id and e.status = 'completed') as completed,
             (select count(*)::int from public.sequence_enrollments e where e.sequence_id = ids.sequence_id and e.status = 'stopped') as stopped,
             (select count(*)::int from public.messages m join public.sequence_enrollments e on e.id = m.enrollment_id
               where e.sequence_id = ids.sequence_id) as messages,
             coalesce((select ss.paused from public.sequence_settings ss where ss.sequence_id = ids.sequence_id), false) as paused,
             (select min(s.due_at) from public.scheduled_messages s where s.sequence_id = ids.sequence_id and s.status = 'pending') as next_due
      from ids`,
  );
}

export interface EnrollmentListRow {
  id: string;
  lead_id: string;
  lead_name: string | null;
  sequence_id: string;
  status: string;
  stop_reason: string | null;
  enrolled_at: Date;
  next_due: Date | null;
  sent: number;
  total: number;
}

export async function listEnrollments(session: Session, sequenceId?: string): Promise<EnrollmentListRow[]> {
  return asStaff(
    session,
    (tx) => tx<EnrollmentListRow[]>`
      select e.id, e.lead_id, l.full_name as lead_name, e.sequence_id, e.status, e.stop_reason, e.enrolled_at,
             (select min(s.due_at) from public.scheduled_messages s where s.enrollment_id = e.id and s.status = 'pending') as next_due,
             (select count(*)::int from public.scheduled_messages s where s.enrollment_id = e.id and s.status = 'done') as sent,
             (select count(*)::int from public.scheduled_messages s where s.enrollment_id = e.id) as total
      from public.sequence_enrollments e join public.leads l on l.id = e.lead_id
      where l.erased_at is null ${sequenceId ? tx`and e.sequence_id = ${sequenceId}` : tx``}
      order by (e.status = 'active') desc, e.enrolled_at desc
      limit 100`,
  );
}

export interface UsageTotals {
  calls: number;
  completed: number;
  emergencies: number;
  seconds: number;
  /** Seconds of browser and phone calls: the ones that run on LiveKit. */
  voice_seconds: number;
  llm_requests: number;
  stt_seconds: number;
  tts_characters: number;
}

export interface RecentCall {
  id: string;
  lead_id: string;
  lead_name: string | null;
  channel: string;
  status: string;
  outcome: string | null;
  started_at: Date;
  duration_seconds: number | null;
  flags: number;
  /** Started over 15 minutes ago and never finished (e.g. the voice line never connected). */
  stale: boolean;
}

export interface AssistantOverview {
  today: UsageTotals;
  month: UsageTotals;
  recent: RecentCall[];
  verified: { phone: string; label: string; created_at: Date }[];
}

/** Assistant usage for the manager screen (India time days and months). */
export async function assistantOverview(session: Session, timeZone: string): Promise<AssistantOverview> {
  return asStaff(session, async (tx) => {
    const totals = (since: postgres.PendingQuery<postgres.Row[]>) => tx<UsageTotals[]>`
      select count(*)::int as calls,
             count(*) filter (where outcome = 'completed')::int as completed,
             count(*) filter (where outcome = 'emergency')::int as emergencies,
             coalesce(sum(duration_seconds), 0)::int as seconds,
             coalesce(sum(duration_seconds) filter (where channel in ('browser', 'phone')), 0)::int as voice_seconds,
             coalesce(sum((usage ->> 'llmRequests')::int), 0)::int as llm_requests,
             coalesce(sum((usage ->> 'sttSeconds')::numeric), 0)::float as stt_seconds,
             coalesce(sum((usage ->> 'ttsCharacters')::int), 0)::int as tts_characters
      from public.call_sessions where started_at >= ${since}`;
    const [today] = await totals(tx`(date_trunc('day', now() at time zone ${timeZone}) at time zone ${timeZone})`);
    const [month] = await totals(tx`(date_trunc('month', now() at time zone ${timeZone}) at time zone ${timeZone})`);
    const recent = await tx<RecentCall[]>`
      select c.id, c.lead_id, l.full_name as lead_name, c.channel, c.status, c.outcome, c.started_at,
             c.duration_seconds, jsonb_array_length(c.safety_flags)::int as flags,
             (c.status = 'started' and c.started_at < now() - interval '15 minutes') as stale
      from public.call_sessions c join public.leads l on l.id = c.lead_id
      order by c.started_at desc limit 20`;
    const verified = await tx<AssistantOverview['verified']>`
      select phone, label, created_at from public.verified_demo_numbers order by created_at`;
    return { today: today!, month: month!, recent, verified };
  });
}
