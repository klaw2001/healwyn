import type { IndustryPack } from '../industries/types';
import type { VoiceChannel } from './contract';

/** One row of `public.call_policies`: who the assistant may call on a channel, and how often. */
export interface CallPolicy {
  readonly industry: string;
  readonly channel: VoiceChannel;
  /** Calls in one group share a daily cap: website (browser and typed), phone, simulated. */
  readonly cap_group: 'website' | 'phone' | 'simulated';
  readonly consent_purpose: string;
  readonly max_per_day: number;
  readonly max_per_phone_per_day: number | null;
  readonly outbound: boolean;
  readonly window_start: number | null;
  readonly window_end: number | null;
  readonly time_zone: string;
  readonly require_verified: boolean;
}

/**
 * The call rules SQL enforces in `start_call`, derived from the pack (the seed
 * writes them). The 9am-9pm window protects people from calls at night, so it
 * applies to real phone calls; a simulated call rings nobody, and a website
 * call is one the visitor starts themselves. A Twilio trial trunk can only call
 * verified numbers.
 */
export function callPolicies(pack: IndustryPack): CallPolicy[] {
  const { limits, callConsentId } = pack.voice;
  const base = {
    industry: pack.id,
    consent_purpose: callConsentId,
    max_per_day: limits.maxCallsPerDay,
    time_zone: limits.callWindow.timeZone,
  };
  const website = {
    ...base,
    cap_group: 'website',
    max_per_phone_per_day: limits.maxCallsPerPhonePerDay,
    outbound: false,
    window_start: null,
    window_end: null,
    require_verified: false,
  } as const;
  return [
    { ...website, channel: 'browser' },
    { ...website, channel: 'text' },
    {
      ...base,
      channel: 'phone',
      cap_group: 'phone',
      max_per_phone_per_day: null,
      outbound: true,
      window_start: limits.callWindow.startHour,
      window_end: limits.callWindow.endHour,
      require_verified: true,
    },
    {
      ...base,
      channel: 'simulated',
      cap_group: 'simulated',
      max_per_phone_per_day: null,
      outbound: true,
      window_start: null,
      window_end: null,
      require_verified: false,
    },
  ];
}
