import { describe, expect, it } from 'vitest';
import { POOL_TARGETS, SEATS, assignPools, compareAcceptance, isLowerYear, tallyPools, type Accept } from '@/lib/decisions/pools';

let n = 0;
const accept = (overrides: Partial<Accept> = {}): Accept => ({
  id: `id-${String(++n).padStart(4, '0')}`,
  university: 'University of Toronto',
  year_of_study: '3',
  sent: true,
  releasedAt: null,
  submittedAt: '2026-11-01T00:00:00Z',
  stagedAt: null,
  ...overrides,
});
const otu = (year = '3', overrides: Partial<Accept> = {}) => accept({ university: 'Ontario Tech University', year_of_study: year, ...overrides });

describe('targets', () => {
  it('add up to the seat count', () => {
    expect(POOL_TARGETS.otu + POOL_TARGETS.lower_years + POOL_TARGETS.general).toBe(SEATS);
  });
});

describe('classification', () => {
  it('treats 1st and 2nd year as lower years only', () => {
    expect(['1', '2', '3', '4', '5', '6', null].map(isLowerYear)).toEqual([true, true, false, false, false, false, false]);
  });

  it('puts Ontario Tech, lower years and everyone else in their pools', () => {
    const a = otu('3');
    const b = otu('1');
    const c = accept({ year_of_study: '2' });
    const d = accept({ year_of_study: '6' });
    const e = accept({ university: null, year_of_study: null });
    const pools = assignPools([a, b, c, d, e]);
    expect([a, b, c, d, e].map((x) => pools.get(x.id))).toEqual(['otu', 'otu', 'lower_years', 'general', 'general']);
  });

  it('recognises Ontario Tech by its aliases', () => {
    const a = accept({ university: 'UOIT' });
    expect(assignPools([a]).get(a.id)).toBe('otu');
  });
});

describe('Ontario Tech overflow', () => {
  const fillOtu = () => Array.from({ length: POOL_TARGETS.otu }, () => otu('4'));

  it('moves an Ontario Tech lower-year to lower years once Ontario Tech is full', () => {
    const full = fillOtu();
    const lower = otu('2');
    expect(assignPools([...full, lower]).get(lower.id)).toBe('lower_years');
  });

  it('keeps an Ontario Tech upper-year in Ontario Tech past the target', () => {
    const full = fillOtu();
    const upper = otu('3');
    const tally = tallyPools([...full, upper]);
    expect(tally.otu.sent).toBe(POOL_TARGETS.otu + 1);
    expect(tally.lower_years.sent).toBe(0);
  });

  it('follows acceptance order, not list order', () => {
    const full = fillOtu();
    // Listed first, but staged accepts count after every released one.
    const early = otu('1', { sent: false, stagedAt: '2026-11-02T00:00:00Z' });
    const pools = assignPools([early, ...full]);
    expect(pools.get(early.id)).toBe('lower_years');
  });
});

describe('acceptance order', () => {
  it('puts released before staged, pre-wave accepts first, then by wave and staging time', () => {
    const legacy = accept({ submittedAt: '2026-11-05T00:00:00Z' });
    const wave1 = accept({ releasedAt: '2026-11-10T00:00:00Z', submittedAt: '2026-11-01T00:00:00Z' });
    const wave2 = accept({ releasedAt: '2026-11-12T00:00:00Z' });
    const stagedLate = accept({ sent: false, stagedAt: '2026-11-15T00:00:00Z' });
    const stagedEarly = accept({ sent: false, stagedAt: '2026-11-14T00:00:00Z' });
    const order = [stagedLate, wave2, stagedEarly, wave1, legacy].toSorted(compareAcceptance);
    expect(order).toEqual([legacy, wave1, wave2, stagedEarly, stagedLate]);
  });
});

describe('tallyPools', () => {
  it('counts sent and staged accepts separately against each target', () => {
    const tally = tallyPools([otu('3'), otu('3', { sent: false, stagedAt: '2026-11-15T00:00:00Z' }), accept({ year_of_study: '1' }), accept()]);
    expect(tally).toEqual({
      otu: { sent: 1, staged: 1, target: POOL_TARGETS.otu },
      lower_years: { sent: 1, staged: 0, target: POOL_TARGETS.lower_years },
      general: { sent: 1, staged: 0, target: POOL_TARGETS.general },
    });
  });
});
