import { describe, expect, it } from 'vitest';
import { POOLS, formatApplicantNo, isPool } from '@/lib/review/pools';

describe('helpers', () => {
  it('uses the Decisions page pool keys', () => {
    expect(POOLS).toEqual(['otu', 'lower_years', 'general']);
    expect(['otu', 'early', null].map(isPool)).toEqual([true, false, false]);
  });

  it('formats applicant numbers with four digits', () => {
    expect(formatApplicantNo(427)).toBe('#0427');
    expect(formatApplicantNo(12345)).toBe('#12345');
  });
});
