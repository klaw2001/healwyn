'use client';

import {
  BRAND,
  buildAssistantSchema,
  consentFieldName,
  getActivePack,
  toFieldErrors,
  type FieldErrors,
} from '@healwyn/core';
import { Button, Checkbox, Field, Input, RadioGroup } from '@healwyn/ui';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ConsentText, Honeypot } from '../forms/form-kit';
import type { VoiceCall as VoiceCallType } from './voice-call';

const pack = getActivePack();
const schema = buildAssistantSchema(pack);
const languages = pack.languages.map((l) => ({
  value: l.code,
  label: l.nativeLabel,
  lang: l.code,
  description: l.label !== l.nativeLabel ? l.label : undefined,
}));

type Line = { id: string; from: 'assistant' | 'you'; text: string };
type Phase =
  | { name: 'form'; message?: string }
  | { name: 'connecting'; mode: 'voice' | 'text' }
  | { name: 'voice'; serverUrl: string; token: string; reference: string }
  | { name: 'text'; reference: string }
  | { name: 'done'; reference: string | null };

type VoiceCallComponent = typeof VoiceCallType;

/**
 * "Talk to our assistant": a dialog that takes a name, a mobile number and
 * consent, then connects a voice call with the AI assistant (LiveKit), or a
 * typed chat when the microphone is unavailable or the visitor prefers typing.
 */
export function AssistantLauncher({
  className,
  label = 'Talk to our assistant',
}: {
  className?: string;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className={className}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        <MicGlyph /> {label}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="assistant-title"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-ink backdrop:bg-ink/50 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-lg sm:border sm:border-line sm:shadow-lift"
        onClose={() => setOpen(false)}
      >
        {open ? <AssistantPanel onClose={() => dialogRef.current?.close()} /> : null}
      </dialog>
    </>
  );
}

function MicGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [language, setLanguage] = useState('en');
  const [VoiceCall, setVoiceCall] = useState<VoiceCallComponent | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formId = useId();

  useEffect(() => headingRef.current?.focus(), [phase.name]);

  const addLine = useCallback((from: Line['from'], text: string) => {
    if (text) setLines((current) => [...current, { id: `${current.length}-${from}`, from, text }]);
  }, []);

  async function start(form: HTMLFormElement, mode: 'voice' | 'text') {
    const data = new FormData(form);
    const values: Record<string, unknown> = { mode };
    for (const [key, value] of data.entries()) if (typeof value === 'string') values[key] = value;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setErrors({});
    setLanguage(parsed.data.preferredLanguage);
    setPhase({ name: 'connecting', mode });
    if (mode === 'voice') void import('./voice-call').then((m) => setVoiceCall(() => m.VoiceCall));
    try {
      const response = await fetch('/api/assistant/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as
        | { status: 'voice'; serverUrl: string; token: string; reference: string }
        | { status: 'text'; reply: string; reference: string; language: string }
        | { status: 'invalid'; fieldErrors: FieldErrors }
        | { status: 'error'; message: string };
      if (result.status === 'voice') {
        setPhase({ name: 'voice', serverUrl: result.serverUrl, token: result.token, reference: result.reference });
      } else if (result.status === 'text') {
        addLine('assistant', result.reply);
        setPhase({ name: 'text', reference: result.reference });
      } else if (result.status === 'invalid') {
        setErrors(result.fieldErrors);
        setPhase({ name: 'form' });
      } else {
        setPhase({ name: 'form', message: result.message });
      }
    } catch {
      setPhase({ name: 'form', message: 'Sorry, we could not reach the assistant. Please use the enquiry form.' });
    }
  }

  const fallbackToText = useCallback(
    async (reference: string, reason: string) => {
      setPhase({ name: 'connecting', mode: 'text' });
      addLine('assistant', reason);
      try {
        const response = await fetch('/api/assistant/fallback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ language }),
        });
        if (!response.ok) throw new Error(String(response.status));
        const result = (await response.json()) as { reply: string };
        addLine('assistant', result.reply);
        setPhase({ name: 'text', reference });
      } catch {
        setPhase({ name: 'done', reference });
      }
    },
    [addLine, language],
  );

  const title =
    phase.name === 'done'
      ? 'Thank you'
      : phase.name === 'voice'
        ? 'Talking with the AI assistant'
        : phase.name === 'text'
          ? 'Chatting with the AI assistant'
          : 'Talk to our AI assistant';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-ink">
            AI assistant · not a person
          </p>
          <h2 id="assistant-title" ref={headingRef} tabIndex={-1} className="mt-2 text-2xl focus:outline-none">
            {title}
          </h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close the assistant">
          Close
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {phase.name === 'form' ? (
          <form
            id={formId}
            noValidate
            className="relative grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void start(e.currentTarget, 'voice');
            }}
          >
            <p className="text-ink-muted">
              {BRAND.shortName}’s AI assistant asks five short questions so the right doctor’s team can call you back.
              It cannot give medical advice. Your browser will ask to use your microphone; if you would rather not,
              choose “Type instead”.
            </p>
            {phase.message ? (
              <p role="alert" className="rounded-md border-2 border-danger bg-danger-soft p-3 font-semibold">
                {phase.message}
              </p>
            ) : null}
            <Honeypot />
            <Field id="assistant-name" label="Your name" error={errors.full_name} required>
              {(control) => <Input {...control} name="full_name" autoComplete="name" />}
            </Field>
            <Field
              id="assistant-phone"
              label="Mobile number"
              hint="So our care team can call you back. A 10-digit Indian mobile number."
              error={errors.phone}
              required
            >
              {(control) => <Input {...control} name="phone" type="tel" inputMode="tel" autoComplete="tel" />}
            </Field>
            <RadioGroup
              id="assistant-language"
              name="preferred_language"
              legend="Language"
              options={languages}
              defaultValue="en"
              error={errors.preferred_language}
              required
            />
            {pack.intake.consents.map((consent) => (
              <Checkbox
                key={consent.id}
                id={`assistant-${consent.id}`}
                name={consentFieldName(consent.id)}
                error={errors[consentFieldName(consent.id)]}
                label={<ConsentText definition={consent} />}
                className="rounded-md border border-line bg-surface-muted p-4"
              />
            ))}
            <p className="rounded-md bg-danger-soft p-3 text-sm">
              <strong>Not for emergencies.</strong> If you need urgent help, call {pack.voice.safety.emergencyNumber} or
              go to the nearest hospital.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" size="lg">
                <MicGlyph /> Start voice call
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form) void start(form, 'text');
                }}
              >
                Type instead
              </Button>
            </div>
          </form>
        ) : null}

        {phase.name === 'connecting' ? (
          <p role="status" className="text-ink-muted">
            {phase.mode === 'voice' ? 'Connecting your call…' : 'Starting the chat…'}
          </p>
        ) : null}

        {phase.name === 'voice' && VoiceCall ? (
          <VoiceCall
            serverUrl={phase.serverUrl}
            token={phase.token}
            onLine={addLine}
            lines={lines}
            onEnded={() => setPhase({ name: 'done', reference: phase.reference })}
            onFallback={(reason) => fallbackToText(phase.reference, reason)}
          />
        ) : phase.name === 'voice' ? (
          <p role="status">Connecting your call…</p>
        ) : null}

        {phase.name === 'text' ? (
          <TextChat
            lines={lines}
            onLine={addLine}
            onEnded={() => setPhase({ name: 'done', reference: phase.reference })}
          />
        ) : null}

        {phase.name === 'done' ? (
          <div className="grid gap-4" role="status">
            <p className="text-lg">
              Our care team has what you shared and will call you back.
              {phase.reference ? (
                <>
                  {' '}
                  Your reference is <strong className="font-mono">{phase.reference}</strong>.
                </>
              ) : null}
            </p>
            {lines.length ? <Transcript lines={lines} /> : null}
            <p className="text-sm text-ink-muted">
              If anything gets worse or feels urgent, call {pack.voice.safety.emergencyNumber} or go to the nearest
              hospital.
            </p>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Transcript({ lines, live = false }: { lines: Line[]; live?: boolean }) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest' }), [lines.length]);
  return (
    <ol
      className="grid gap-2"
      aria-live={live ? 'polite' : undefined}
      aria-label={live ? 'Conversation' : 'What was said'}
    >
      {lines.map((line, index) => (
        <li
          key={line.id}
          ref={index === lines.length - 1 ? endRef : undefined}
          className={
            line.from === 'assistant'
              ? 'mr-8 rounded-md bg-surface-muted p-3'
              : 'ml-8 rounded-md bg-primary-soft p-3 text-right'
          }
        >
          <span className="block text-xs font-bold text-ink-muted">
            {line.from === 'assistant' ? 'AI assistant' : 'You'}
          </span>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

function TextChat({
  lines,
  onLine,
  onEnded,
}: {
  lines: Line[];
  onLine: (from: Line['from'], text: string) => void;
  onEnded: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    onLine('you', text);
    setDraft('');
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch('/api/assistant/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const reply = (await response.json()) as { reply: string; ended: boolean };
      onLine('assistant', reply.reply);
      if (reply.ended) onEnded();
    } catch {
      setProblem('The assistant did not answer. Please try again, or use the enquiry form.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="grid gap-4">
      <Transcript lines={lines} live />
      {problem ? (
        <p role="alert" className="text-danger">
          {problem}
        </p>
      ) : null}
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor="assistant-message" className="sr-only">
          Your message
        </label>
        <input
          ref={inputRef}
          id="assistant-message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          autoComplete="off"
          autoFocus
          className="min-h-12 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-4 text-ink"
          placeholder="Type your answer"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          {busy ? 'Sending…' : 'Send'}
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start"
        onClick={async () => {
          await fetch('/api/assistant/end', { method: 'POST' }).catch(() => undefined);
          onEnded();
        }}
      >
        End chat
      </Button>
    </div>
  );
}
