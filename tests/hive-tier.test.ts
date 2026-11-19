import { describe, expect, it } from 'vitest';
import { experienceScore, suggestTier, totalScore, type ExperienceChecks } from '@/lib/hive/tier';

const checks = (passed: number): ExperienceChecks => {
  const [builtIt, shipped, impact, beyondTutorial] = [0, 1, 2, 3].map((i) => i < passed);
  return { builtIt, shipped, impact, beyondTutorial };
};

describe('experienceScore', () => {
  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ])('%i checks passed scores %i', (passed, score) => {
    expect(experienceScore(checks(passed))).toBe(score);
  });

  it('counts checks, not which ones', () => {
    expect(experienceScore({ builtIt: false, shipped: true, impact: false, beyondTutorial: true })).toBe(3);
  });
});

describe('totalScore', () => {
  it('adds the three ratings, out of 15', () => {
    expect(totalScore({ experience: 1, creativity: 1, quality: 1 })).toBe(3);
    expect(totalScore({ experience: 3, creativity: 4, quality: 3 })).toBe(10);
    expect(totalScore({ experience: 5, creativity: 5, quality: 5 })).toBe(15);
  });
});

describe('suggestTier', () => {
  const tier = (experience: number, creativity: number, quality: number) =>
    suggestTier({ experience, creativity, quality });

  it.each([
    // Larva: 3-7
    [1, 1, 1, 'larva'],
    [3, 2, 2, 'larva'],
    // Worker Bee: 8-11
    [3, 3, 2, 'worker'],
    [3, 4, 4, 'worker'],
    // Queen Bee: 12-15
    [4, 4, 4, 'queen'],
    [5, 5, 5, 'queen'],
  ])('experience %i, creativity %i, quality %i is %s', (experience, creativity, quality, expected) => {
    expect(tier(experience, creativity, quality)).toBe(expected);
  });

  it('puts the cutoffs at exactly 8 and 12', () => {
    expect(tier(2, 3, 2)).toBe('larva'); // 7
    expect(tier(2, 3, 3)).toBe('worker'); // 8
    expect(tier(4, 4, 3)).toBe('worker'); // 11
    expect(tier(4, 4, 4)).toBe('queen'); // 12
  });

  it('ignores the hackathon count: low answers stay Larva', () => {
    // The real case: 1/5 on everything with 5 hackathons used to be Queen Bee.
    expect(tier(1, 1, 1)).toBe('larva');
  });
});
