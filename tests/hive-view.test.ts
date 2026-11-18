import { describe, expect, it } from 'vitest';
import { PROMPT_VERSION } from '@/lib/hive/prompt';
import { QUOTA_ERROR } from '@/lib/hive/errors';
import { compareForReview, creditsRunOut, displayTier, gaveUp, inBacklog, isScoring, needsScoring, type HiveScore } from '@/lib/hive/view';

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

const NOW = Date.parse('2026-11-18T10:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe('isScoring / gaveUp / inBacklog', () => {
  it('counts a claim as scoring for 2 minutes only', () => {
    expect(isScoring(score({ claimed_at: ago(1) }), NOW)).toBe(true);
    expect(isScoring(score({ claimed_at: ago(3) }), NOW)).toBe(false);
    expect(isScoring(score({ claimed_at: null }), NOW)).toBe(false);
  });

  it('gives up after 5 failures in a row', () => {
    expect(gaveUp(score({ status: 'failed', attempts: 4 }))).toBe(false);
    expect(gaveUp(score({ status: 'failed', attempts: 5 }))).toBe(true);
  });

  it('leaves out current, running and given-up scores, like hive_backlog()', () => {
    expect(inBacklog(undefined, NOW)).toBe(true);
    expect(inBacklog(score({ status: 'failed', attempts: 1 }), NOW)).toBe(true);
    expect(inBacklog(score(), NOW)).toBe(false);
    expect(inBacklog(score({ status: 'pending', claimed_at: ago(1) }), NOW)).toBe(false);
    expect(inBacklog(score({ status: 'pending', claimed_at: ago(5) }), NOW)).toBe(true);
    expect(inBacklog(score({ status: 'failed', attempts: 5 }), NOW)).toBe(false);
  });
});

describe('creditsRunOut', () => {
  const scoredAt = (minutes: number) => score({ error: null, scored_at: ago(minutes), updated_at: ago(minutes) });
  const outOfCredits = (minutes: number) => score({ status: 'failed', error: QUOTA_ERROR, updated_at: ago(minutes) });

  it('is true when the latest event is running out of credits', () => {
    expect(creditsRunOut([scoredAt(10), outOfCredits(5)])).toBe(true);
  });

  it('clears once something scores again, e.g. after a top-up', () => {
    expect(creditsRunOut([outOfCredits(10), scoredAt(5)])).toBe(false);
    expect(creditsRunOut([scoredAt(5), score({ status: 'failed', error: '500 server error', updated_at: ago(1) })])).toBe(false);
    expect(creditsRunOut([])).toBe(false);
  });
});

describe('compareForReview', () => {
  it('orders by tier, then total, quality, hackathons and submission time', () => {
    const w = (quality: number, creativity: number) => score({ experience: 3, quality, creativity });
    const rows = [
      { id: 'unscored', tier: null, submitted_at: '2026-11-01' },
      { id: 'larva', tier: 'larva' as const, submitted_at: '2026-11-01', score: w(5, 5) },
      { id: 'worker-late', tier: 'worker' as const, submitted_at: '2026-11-05', hackathons_count: 0, score: w(3, 2) },
      { id: 'worker-early', tier: 'worker' as const, submitted_at: '2026-11-02', hackathons_count: 0, score: w(3, 2) },
      { id: 'worker-hacker', tier: 'worker' as const, submitted_at: '2026-11-09', hackathons_count: 4, score: w(3, 2) },
      { id: 'worker-quality', tier: 'worker' as const, submitted_at: '2026-11-09', score: w(4, 1) },
      { id: 'worker-best', tier: 'worker' as const, submitted_at: '2026-11-09', score: w(4, 4) },
      { id: 'queen', tier: 'queen' as const, submitted_at: '2026-11-09', score: w(1, 1) },
    ];
    expect([...rows].sort(compareForReview).map((row) => row.id)).toEqual([
      'queen', 'worker-best', 'worker-quality', 'worker-hacker', 'worker-early', 'worker-late', 'larva', 'unscored',
    ]);
  });
});
