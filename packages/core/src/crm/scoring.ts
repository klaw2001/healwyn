import type { ScoreCondition, ScoreRule, UrgencyLevel } from './types';

/** Everything the rule-based score looks at. */
export interface ScoreInput {
  stage: string;
  urgency: UrgencyLevel;
  specialtySlug: string | null;
  answers: Readonly<Record<string, string>>;
  hasEmail: boolean;
  hasMessage: boolean;
  /** Consent purposes currently granted. */
  consents: readonly string[];
  createdAt: Date;
  replied: boolean;
  optedOut: boolean;
}

export interface ScoreFactor {
  id: string;
  label: string;
  points: number;
}

export type ScoreBand = 'hot' | 'warm' | 'cool';

export interface LeadScore {
  score: number;
  band: ScoreBand;
  /** Only the rules that matched, in rule order. */
  factors: ScoreFactor[];
}

function matches(condition: ScoreCondition, input: ScoreInput, now: Date): boolean {
  switch (condition.kind) {
    case 'answer':
      return input.answers[condition.questionId] === condition.equals;
    case 'offeringChosen':
      return input.specialtySlug !== null;
    case 'hasEmail':
      return input.hasEmail;
    case 'hasMessage':
      return input.hasMessage;
    case 'consent':
      return input.consents.includes(condition.purpose);
    case 'urgency':
      return condition.in.includes(input.urgency);
    case 'stage':
      return condition.in.includes(input.stage);
    case 'createdWithinHours':
      return now.getTime() - input.createdAt.getTime() <= condition.hours * 3_600_000;
    case 'replied':
      return input.replied;
    case 'optedOut':
      return input.optedOut;
  }
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cool';
}

/** Adds up every matching rule, clamped to 0..100, with the breakdown kept for display. */
export function scoreLead(rules: readonly ScoreRule[], input: ScoreInput, now: Date = new Date()): LeadScore {
  const factors = rules
    .filter((rule) => matches(rule.when, input, now))
    .map((rule) => ({ id: rule.id, label: rule.label, points: rule.points }));
  const total = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.max(0, Math.min(100, total));
  return { score, band: scoreBand(score), factors };
}
