import { describe, expect, it } from 'vitest';
import { axis, barPercent, isDay, mondayOf, percentile, resolveRange, share, weekStarts } from '../lib/dashboard-math';

describe('dashboard maths', () => {
  it('accepts only real dates and resolves ranges', () => {
    expect(isDay('2026-02-28')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(resolveRange({}, '2026-10-11')).toEqual({ from: '2026-09-12', to: '2026-10-11', notice: null });
    const swapped = resolveRange({ from: '2026-10-10', to: '2026-10-01' }, '2026-10-11');
    expect([swapped.from, swapped.to]).toEqual(['2026-10-01', '2026-10-10']);
    expect(swapped.notice).toMatch(/swapped/);
    expect(resolveRange({ from: 'nope' }, '2026-10-11').notice).toMatch(/not recognised/);
  });

  it('computes percentiles like percentile_cont and safe shares', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([5], 0.9)).toBe(5);
    expect(share(1, 0)).toBeNull();
    expect(share(1, 4)).toBe(0.25);
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(12, 10)).toBe(100);
  });

  it('builds zero-based axes with round steps', () => {
    expect(axis(0)).toEqual({ max: 1, ticks: [0, 1] });
    expect(axis(37).ticks[0]).toBe(0);
    expect(axis(37).max).toBeGreaterThanOrEqual(37);
  });

  it('buckets by Monday-start weeks', () => {
    expect(mondayOf('2026-10-11')).toBe('2026-10-05'); // a Sunday
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(weekStarts('2026-10-01', '2026-10-14')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
  });
});
