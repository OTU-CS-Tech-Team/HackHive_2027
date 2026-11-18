import { describe, expect, it } from 'vitest';
import { PROMPT_VERSION } from '@/lib/hive/prompt';
import { compareForReview, displayTier, needsScoring, type HiveScore } from '@/lib/hive/view';

const score = (extra: Partial<HiveScore> = {}) =>
  ({ status: 'scored', suggested_tier: 'worker', tier_override: null, prompt_version: PROMPT_VERSION, quality: 3, creativity: 3, ...extra }) as HiveScore;

describe('displayTier', () => {
  it('shows the suggestion once scored', () => {
    expect(displayTier(score())).toBe('worker');
  });

  it('shows nothing while pending or after a failure, so nobody lands in a tier by default', () => {
    expect(displayTier(undefined)).toBeNull();
    expect(displayTier(score({ status: 'pending' }))).toBeNull();
    expect(displayTier(score({ status: 'failed' }))).toBeNull();
  });

  it("always shows an admin's override", () => {
    expect(displayTier(score({ tier_override: 'queen' }))).toBe('queen');
    expect(displayTier(score({ status: 'failed', tier_override: 'larva' }))).toBe('larva');
  });
});

describe('needsScoring', () => {
  it('is true for missing, failed, pending or outdated scores', () => {
    expect(needsScoring(undefined)).toBe(true);
    expect(needsScoring(score({ status: 'failed' }))).toBe(true);
    expect(needsScoring(score({ prompt_version: PROMPT_VERSION - 1 }))).toBe(true);
    expect(needsScoring(score())).toBe(false);
  });
});

describe('compareForReview', () => {
  it('orders by tier, then quality, creativity and submission time', () => {
    const rows = [
      { id: 'unscored', tier: null, submitted_at: '2026-11-01' },
      { id: 'larva', tier: 'larva' as const, submitted_at: '2026-11-01', score: score({ quality: 5 }) },
      { id: 'worker-late', tier: 'worker' as const, submitted_at: '2026-11-05', score: score({ quality: 4, creativity: 2 }) },
      { id: 'worker-early', tier: 'worker' as const, submitted_at: '2026-11-02', score: score({ quality: 4, creativity: 2 }) },
      { id: 'worker-creative', tier: 'worker' as const, submitted_at: '2026-11-09', score: score({ quality: 4, creativity: 5 }) },
      { id: 'worker-best', tier: 'worker' as const, submitted_at: '2026-11-09', score: score({ quality: 5, creativity: 1 }) },
      { id: 'queen', tier: 'queen' as const, submitted_at: '2026-11-09', score: score({ quality: 1 }) },
    ];
    expect([...rows].sort(compareForReview).map((row) => row.id)).toEqual([
      'queen', 'worker-best', 'worker-creative', 'worker-early', 'worker-late', 'larva', 'unscored',
    ]);
  });
});
