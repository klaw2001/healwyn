import { getActivePack } from '@healwyn/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageTitle } from '@/components/shell';
import { FREE_TIER } from '@/lib/free-tier';
import { formatDateTime } from '@/lib/format';
import { requireCapability } from '@/lib/server/auth';
import { telephonyConfigured } from '@/lib/server/dialer';
import { assistantOverview, type UsageTotals } from '@/lib/server/queries';
import { VerifiedNumbers } from './verified-numbers';

export const metadata: Metadata = { title: 'AI assistant' };

const pack = getActivePack();

const OUTCOMES: Record<string, string> = {
  completed: 'Qualified',
  consent_declined: 'Declined',
  emergency: 'Emergency advice',
  caller_ended: 'Ended early',
  limit_reached: 'Time limit',
  error: 'Failed',
};

function Meter({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const ratio = Math.min(1, limit ? used / limit : 0);
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-ink-muted">
          {used.toLocaleString('en-IN', { maximumFractionDigits: 1 })} of {limit.toLocaleString('en-IN')} {unit}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(used * 10) / 10}
        className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={`h-full rounded-full ${ratio >= 0.9 ? 'bg-danger' : ratio >= 0.7 ? 'bg-accent' : 'bg-primary'}`}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-line bg-surface p-5">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Totals({ totals }: { totals: UsageTotals }) {
  const minutes = totals.seconds / 60;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        ['Calls', totals.calls],
        ['Qualified', totals.completed],
        ['Emergencies', totals.emergencies],
        ['Minutes', Math.round(minutes * 10) / 10],
      ].map(([label, value]) => (
        <div key={label} className="rounded-md bg-surface-muted p-3">
          <dt className="text-xs text-ink-muted">{label}</dt>
          <dd className="font-display text-2xl">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The manager's view of the AI assistant: usage against the daily cap and the free tiers, recent calls, verified numbers. */
export default async function AssistantPage() {
  const session = await requireCapability('screen.assistant');
  const { limits } = pack.voice;
  const overview = await assistantOverview(session, limits.callWindow.timeZone);
  const sttMinutes = overview.month.stt_seconds / 60;
  const inferenceUsd =
    sttMinutes * FREE_TIER.sttUsdPerMinute + overview.month.tts_characters * FREE_TIER.ttsUsdPerCharacter;
  const agentMinutes = overview.month.seconds / 60;

  return (
    <>
      <PageTitle
        title="AI assistant"
        description="Calls the assistant has taken, against its daily cap and the free tiers it runs on. Synthetic data only."
      />
      <div className="grid gap-6 px-4 py-6 sm:px-8 xl:grid-cols-2">
        <Panel id="today" title="Today">
          <Totals totals={overview.today} />
          <div className="mt-5">
            <Meter label="Daily call cap" used={overview.today.calls} limit={limits.maxCallsPerDay} unit="calls" />
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            When the cap is reached, the website and the dialer refuse new calls with a clear message. Each call is
            limited to {Math.round(limits.maxCallSeconds / 60)} minutes and {limits.maxTurns} turns.
          </p>
        </Panel>

        <Panel id="month" title="This month and the free tiers">
          <Totals totals={overview.month} />
          <div className="mt-5 grid gap-4">
            <Meter
              label="LiveKit agent minutes"
              used={agentMinutes}
              limit={FREE_TIER.agentMinutesPerMonth}
              unit="min"
            />
            <Meter
              label="LiveKit Inference credit (speech)"
              used={inferenceUsd}
              limit={FREE_TIER.inferenceCreditUsd}
              unit="USD"
            />
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Gemini requests this month: {overview.month.llm_requests} (free tier; Google publishes its limits only in AI
            Studio). Speech-to-text: {Math.round(sttMinutes * 10) / 10} min; text-to-speech:{' '}
            {overview.month.tts_characters.toLocaleString('en-IN')} characters. Allowances checked {FREE_TIER.checkedOn}
            .
          </p>
        </Panel>

        <Panel id="recent" title="Recent calls">
          {overview.recent.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs text-ink-muted">
                  <tr>
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      When
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      Lead
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      Channel
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      Outcome
                    </th>
                    <th scope="col" className="py-1.5 font-semibold">
                      Flags
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent.map((call) => (
                    <tr key={call.id} className="border-t border-line">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{formatDateTime(call.started_at)}</td>
                      <td className="py-1.5 pr-2">
                        <Link
                          href={`/leads/${call.lead_id}`}
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          {call.lead_name ?? 'Erased lead'}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-2">{call.channel}</td>
                      <td className="py-1.5 pr-2">
                        {call.status === 'started' ? 'In progress' : (OUTCOMES[call.outcome ?? ''] ?? call.outcome)}
                      </td>
                      <td className="py-1.5">{call.flags || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No calls yet.</p>
          )}
        </Panel>

        <Panel id="verified" title="Verified demo numbers">
          <p className="mb-4 text-sm text-ink-muted">
            A trial telephony account can only call numbers it has verified, so real phone calls go only to these. Phone
            calling is {telephonyConfigured() ? 'set up' : 'not set up (simulated calls only)'}.
          </p>
          <VerifiedNumbers numbers={overview.verified} />
        </Panel>
      </div>
    </>
  );
}
