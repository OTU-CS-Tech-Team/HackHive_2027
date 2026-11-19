import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, formatApplicantNo, isEarlyYear, poolTargets } from '@/lib/review/pools';

describe('poolTargets', () => {
  it('splits 375 seats 30/15/55 into 113/56/206', () => {
    expect(poolTargets(DEFAULT_SETTINGS)).toEqual({ otu: 113, early: 56, general: 206 });
  });

  it('gives General the remainder so no seat is lost to rounding', () => {
    const targets = poolTargets({ seats: 10, otu_pct: 30, early_pct: 15, general_pct: 55 });
    expect(targets).toEqual({ otu: 3, early: 2, general: 5 });
  });
});

describe('helpers', () => {
  it('treats years 1 and 2 as early', () => {
    expect(['1', '2', '3', '6', null].map(isEarlyYear)).toEqual([true, true, false, false, false]);
  });

  it('formats applicant numbers with four digits', () => {
    expect(formatApplicantNo(427)).toBe('#0427');
    expect(formatApplicantNo(12345)).toBe('#12345');
  });
});
