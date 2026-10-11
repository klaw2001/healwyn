/**
 * Free-tier allowances the voice assistant runs within, as checked on
 * 2026-10-10 (official pricing pages; see DECISIONS.md). Shown on the manager's
 * assistant screen next to actual usage. Update when providers change them.
 */
export const FREE_TIER = {
  checkedOn: '2026-10-10',
  /** LiveKit Cloud Build plan: agent session minutes per month (agents deployed to LiveKit Cloud). */
  agentMinutesPerMonth: 1000,
  /** LiveKit Inference credit per month on the Build plan, in US dollars (hard cap, no overage). */
  inferenceCreditUsd: 2.5,
  /** Deepgram Nova-3 multilingual through LiveKit Inference, US dollars per minute of audio. */
  sttUsdPerMinute: 0.0058,
  /** Rime Coda through LiveKit Inference: no charge per character at the time of checking. */
  ttsUsdPerCharacter: 0,
} as const;
