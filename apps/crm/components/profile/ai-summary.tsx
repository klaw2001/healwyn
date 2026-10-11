import type { IndustryPack } from '@healwyn/core';
import { Badge } from '@healwyn/ui';
import { formatDateTime, languageLabel, packLabels } from '@/lib/format';
import type { CallRow } from '@/lib/server/queries';
import { SparkIcon } from '../icons';

const OUTCOMES: Record<string, string> = {
  completed: 'Qualified',
  consent_declined: 'Caller declined',
  no_consent: 'No clear consent',
  emergency: 'Emergency advice given',
  caller_ended: 'Caller ended early',
  limit_reached: 'Time limit reached',
  error: 'Call failed',
};
const CHANNELS: Record<string, string> = {
  browser: 'Browser voice',
  phone: 'Phone',
  simulated: 'Simulated dialer',
  text: 'Typed chat',
};

function flagLabel(pack: IndustryPack, flag: CallRow['safety_flags'][number]): string {
  if (flag.kind === 'red_flag') return pack.voice.safety.redFlags.find((f) => f.id === flag.code)?.label ?? flag.code;
  if (flag.kind === 'advice_request') return `Asked for ${flag.code.replaceAll('_', ' ')} (declined)`;
  return 'Tried to change the assistant’s instructions (refused)';
}

function duration(seconds: number | null): string {
  if (seconds === null) return '–';
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/**
 * The voice assistant's summary of the latest call: outcome, a three-to-five
 * line summary, safety flags, what the caller answered, how the lead was
 * routed, and the transcript (folded away).
 */
export function AiSummary({
  pack,
  calls,
  routingExplanation,
}: {
  pack: IndustryPack;
  calls: CallRow[];
  routingExplanation: string[];
}) {
  const { answerLabel } = packLabels(pack);
  const latest = calls.find((c) => c.status === 'completed');
  const inProgress = calls.find((c) => c.status === 'started');
  const redFlags = latest?.safety_flags.filter((f) => f.kind === 'red_flag') ?? [];

  return (
    <section
      aria-labelledby="ai-summary"
      className={`rounded-lg border p-4 ${redFlags.length ? 'border-danger bg-danger-soft' : 'border-line bg-surface-teal'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-summary" className="flex items-center gap-2 font-sans text-sm font-bold">
          <SparkIcon className="text-primary" /> AI summary
        </h2>
        {latest ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge
              tone={latest.outcome === 'emergency' ? 'accent' : latest.outcome === 'completed' ? 'teal' : 'neutral'}
            >
              {OUTCOMES[latest.outcome ?? ''] ?? latest.outcome}
            </Badge>
            <Badge>{CHANNELS[latest.channel] ?? latest.channel}</Badge>
            <Badge>{latest.language ? languageLabel(latest.language) : '–'}</Badge>
            <Badge>{duration(latest.duration_seconds)}</Badge>
          </div>
        ) : null}
      </div>

      {!latest ? (
        <p className="mt-2 text-sm text-ink-muted">
          {inProgress
            ? `An assistant call started ${formatDateTime(inProgress.started_at)} and has not finished yet.`
            : 'No assistant call yet. When the voice assistant qualifies this lead, its summary, answers and any safety flags appear here, with the routing explanation.'}
        </p>
      ) : (
        <div className="mt-3 grid gap-3 text-sm">
          {redFlags.length ? (
            <p className="rounded-md bg-surface p-2 font-semibold text-danger" role="note">
              Safety: {redFlags.map((flag) => flagLabel(pack, flag)).join(', ')}. The caller was given the emergency
              advice (call {pack.voice.safety.emergencyNumber}). Call back now.
            </p>
          ) : null}
          {latest.summary.length ? (
            <ul className="grid gap-1">
              {latest.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {latest.safety_flags.some((f) => f.kind !== 'red_flag') ? (
            <p className="text-ink-muted">
              Also noted:{' '}
              {[
                ...new Set(
                  latest.safety_flags.filter((f) => f.kind !== 'red_flag').map((flag) => flagLabel(pack, flag)),
                ),
              ].join('; ')}
              .
            </p>
          ) : null}
          {Object.keys(latest.answers).length ? (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {Object.entries(latest.answers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="text-ink-muted">
                    {pack.intake.questions.find((q) => q.id === key)?.label.replace(/\?$/, '') ?? key}:
                  </dt>
                  <dd className="font-semibold">{answerLabel(key, value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {routingExplanation.length ? (
            <div>
              <p className="font-semibold">How it was routed</p>
              <ul className="mt-1 list-disc pl-5 text-ink-muted">
                {routingExplanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {latest.transcript.length ? (
            <details>
              <summary className="cursor-pointer font-semibold text-primary">
                Transcript ({latest.transcript.length} turns)
              </summary>
              <ol className="mt-2 grid gap-1.5">
                {latest.transcript.map((turn, index) => (
                  <li key={index} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                    <span className="text-xs font-semibold text-ink-muted uppercase">
                      {turn.speaker === 'assistant' ? 'Assistant' : 'Caller'}
                    </span>
                    <span className="break-words">{turn.text}</span>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          <p className="text-xs text-ink-muted">
            Written by the AI assistant from the call, {formatDateTime(latest.started_at)}. It does not diagnose; check
            details with the patient.
          </p>
        </div>
      )}
    </section>
  );
}
