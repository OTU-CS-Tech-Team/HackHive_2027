import { describe, expect, it } from 'vitest';
import { assignPools, compareAcceptance, isLowerYear, isOtu, tallyPools, targetsFrom, totalSeats, type Accept } from '@/lib/decisions/pools';

const TARGETS = targetsFrom({ otu_seats: 113, lower_years_seats: 56, general_seats: 206 });
const SMALL = targetsFrom({ otu_seats: 2, lower_years_seats: 1, general_seats: 5 });

let n = 0;
const accept = (overrides: Partial<Accept> = {}): Accept => ({
  id: `id-${String(++n).padStart(4, '0')}`,
  university: 'University of Toronto',
  year_of_study: '3',
  state: 'sent',
  reviewPool: null,
  submittedAt: '2026-11-01T00:00:00Z',
  stagedAt: null,
  ...overrides,
});
const otu = (year = '3', overrides: Partial<Accept> = {}) => accept({ university: 'Ontario Tech University', year_of_study: year, ...overrides });

describe('targets', () => {
  it('come from review_settings and add up to the seat count', () => {
    expect(TARGETS).toEqual({ otu: 113, lower_years: 56, general: 206 });
    expect(totalSeats(TARGETS)).toBe(375);
  });
});

describe('classification', () => {
  it('treats 1st and 2nd year as lower years only', () => {
    expect(['1', '2', ' 2 ', '3', '4', '5', '6', null].map(isLowerYear)).toEqual([true, true, true, false, false, false, false, false]);
  });

  it('recognises Ontario Tech by the same spellings as review_is_otu()', () => {
    expect(['Ontario Tech University', 'UOIT', 'ontario-tech', 'University of Ontario Institute of Technology', 'OTU'].every(isOtu)).toBe(true);
    expect([null, 'University of Toronto', 'Ontario Tech University (Oshawa)'].some(isOtu)).toBe(false);
  });

  it('puts Ontario Tech, lower years and everyone else in their pools', () => {
    const a = otu('3');
    const b = otu('1');
    const c = accept({ year_of_study: '2' });
    const d = accept({ year_of_study: '6' });
    const e = accept({ university: null, year_of_study: null });
    const pools = assignPools([a, b, c, d, e], TARGETS);
    expect([a, b, c, d, e].map((x) => pools.get(x.id))).toEqual(['otu', 'otu', 'lower_years', 'general', 'general']);
  });
});

describe('full pools (same rule as blind review)', () => {
  it('moves Ontario Tech to lower years, then everyone else, once their pools are full', () => {
    const [a, b] = [otu('4'), otu('4')];
    const lower = otu('1', { submittedAt: '2026-11-02T00:00:00Z' });
    const upper = otu('3', { submittedAt: '2026-11-03T00:00:00Z' });
    const lower2 = accept({ year_of_study: '2', submittedAt: '2026-11-04T00:00:00Z' });
    const pools = assignPools([a, b, lower, upper, lower2], SMALL);
    expect([a, b, lower, upper, lower2].map((x) => pools.get(x.id))).toEqual(['otu', 'otu', 'lower_years', 'general', 'general']);
  });

  it('keeps blind review placements and counts them first', () => {
    // Staged by hand before review placed anyone, but review's seats come first.
    const hand = otu('3', { state: 'staged', stagedAt: '2026-11-01T00:00:00Z' });
    const reviewed = [otu('3', { state: 'review', reviewPool: 'otu' }), otu('3', { state: 'review', reviewPool: 'otu' })];
    const pools = assignPools([hand, ...reviewed], SMALL);
    expect(pools.get(hand.id)).toBe('general');
    expect(reviewed.map((x) => pools.get(x.id))).toEqual(['otu', 'otu']);
  });

  it('slots hand accepts in acceptance order, not list order', () => {
    const staged = otu('3', { state: 'staged', stagedAt: '2026-11-02T00:00:00Z' });
    const released = [otu('3'), otu('3')];
    const pools = assignPools([staged, ...released], SMALL);
    expect(pools.get(staged.id)).toBe('general');
  });
});

describe('acceptance order', () => {
  it('puts released before staged, released by submission and staged by staging time', () => {
    const early = accept({ submittedAt: '2026-11-01T00:00:00Z' });
    const late = accept({ submittedAt: '2026-11-05T00:00:00Z' });
    const unknown = accept({ submittedAt: null });
    const stagedLate = accept({ state: 'staged', stagedAt: '2026-11-15T00:00:00Z' });
    const stagedEarly = accept({ state: 'staged', stagedAt: '2026-11-14T00:00:00Z' });
    const order = [stagedLate, unknown, late, stagedEarly, early].toSorted(compareAcceptance);
    expect(order).toEqual([early, late, unknown, stagedEarly, stagedLate]);
  });
});

describe('tallyPools', () => {
  it('counts sent, staged and review accepts separately against each target', () => {
    const tally = tallyPools(
      [
        otu('3'),
        otu('3', { state: 'staged', stagedAt: '2026-11-15T00:00:00Z' }),
        accept({ state: 'review', reviewPool: 'general' }),
        accept({ year_of_study: '1' }),
        accept(),
      ],
      TARGETS,
    );
    expect(tally).toEqual({
      otu: { sent: 1, staged: 1, review: 0, target: 113 },
      lower_years: { sent: 1, staged: 0, review: 0, target: 56 },
      general: { sent: 1, staged: 0, review: 1, target: 206 },
    });
  });
});
