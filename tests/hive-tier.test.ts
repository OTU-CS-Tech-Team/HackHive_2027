import { describe, expect, it } from 'vitest';
import { experienceScore, suggestTier, type ExperienceChecks, type Rating } from '@/lib/hive/tier';

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

describe('suggestTier', () => {
  it.each<[Rating, number | null, string]>([
    // Larva: 0-1 hackathons and experience 1-2
    [1, 0, 'larva'],
    [2, 1, 'larva'],
    [2, null, 'larva'],
    // Worker Bee: experience 3, or 2-4 hackathons
    [3, 0, 'worker'],
    [1, 2, 'worker'],
    [2, 4, 'worker'],
    [3, 4, 'worker'],
    // Queen Bee: experience 4-5, or 5+ hackathons
    [4, 0, 'queen'],
    [5, null, 'queen'],
    [1, 5, 'queen'],
    [2, 30, 'queen'],
  ])('experience %i with %s hackathons is %s', (experience, hackathons, tier) => {
    expect(suggestTier(experience, hackathons)).toBe(tier);
  });

  it('puts someone matching two rules in the higher tier', () => {
    // Worker by experience, Queen by hackathons.
    expect(suggestTier(3, 6)).toBe('queen');
    // Worker by hackathons, Queen by experience.
    expect(suggestTier(5, 3)).toBe('queen');
  });
});
