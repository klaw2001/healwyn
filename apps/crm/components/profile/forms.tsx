'use client';

import { Button } from '@healwyn/ui';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { addNote, completeTask, createTask } from '@/app/(app)/actions';
import type { ActionResult } from '@/lib/server/errors';
import { useUndo } from '../undo';

const control = 'w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink';

export function NoteForm({
  leadId,
  templates,
}: {
  leadId: string;
  templates: { id: string; label: string; body: string }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addNote, null);
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the composer after a successful save
      setBody('');
      setTemplateId('');
    }
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid gap-2 rounded-lg border border-line bg-surface p-4">
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="template_id" value={templateId} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor="note-body" className="font-semibold">
          Add a note
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Template
          <select
            value={templateId}
            onChange={(event) => {
              const template = templates.find((t) => t.id === event.target.value);
              setTemplateId(event.target.value);
              if (template) setBody(template.body);
            }}
            className={`${control} min-h-9 w-auto`}
          >
            <option value="">None</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        id="note-body"
        name="body"
        required
        maxLength={2000}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={`${control} py-2`}
        placeholder="What happened, and what is next? No diagnoses or clinical detail here."
      />
      <div className="flex items-center justify-between gap-2">
        <p role={state && !state.ok ? 'alert' : undefined} className="text-sm text-danger">
          {state && !state.ok ? state.error : ''}
        </p>
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? 'Saving…' : 'Save note'}
        </Button>
      </div>
    </form>
  );
}

export function TaskForm({
  leadId,
  staff,
  defaultDue,
  currentStaffId,
}: {
  leadId: string;
  staff: { id: string; label: string }[];
  defaultDue: string;
  currentStaffId: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createTask, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid gap-2 text-sm">
      <input type="hidden" name="lead_id" value={leadId} />
      <label className="grid gap-1 font-semibold">
        New task
        <input
          name="title"
          required
          maxLength={200}
          className={`${control} min-h-10`}
          placeholder="e.g. Call back to book"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 font-semibold">
          Due (India time)
          <input
            name="due_at"
            type="datetime-local"
            required
            defaultValue={defaultDue}
            className={`${control} min-h-10`}
          />
        </label>
        <label className="grid gap-1 font-semibold">
          For
          <select name="assignee_staff_id" defaultValue={currentStaffId} className={`${control} min-h-10`}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? 'Adding…' : 'Add task'}
      </Button>
    </form>
  );
}

export function CompleteTaskButton({ taskId, leadId, title }: { taskId: string; leadId: string; title: string }) {
  const [pending, start] = useTransition();
  const { notify } = useUndo();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await completeTask(taskId, leadId);
          if (!result.ok) notify(result.error, 'error');
        })
      }
      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-line-strong hover:border-primary"
    >
      <span className="sr-only">Mark “{title}” done</span>
      {pending ? <span aria-hidden="true" className="size-2 rounded-full bg-primary" /> : null}
    </button>
  );
}
