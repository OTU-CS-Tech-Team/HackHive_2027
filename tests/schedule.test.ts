import { describe, expect, it } from "vitest";
import { layoutLanes, scheduleDays } from "@/lib/schedule";

const ev = (id: string, start: string, end: string) => ({
  id,
  starts_at: `2027-02-20T${start}:00Z`,
  ends_at: `2027-02-20T${end}:00Z`,
});

describe('Toronto schedule days', () => {
  it('includes an overnight event on both days without changing its original timestamps', () => {
    const event = { id: 'overnight', starts_at: '2027-02-21T04:00:00Z', ends_at: '2027-02-21T07:00:00Z' };
    const days = scheduleDays([event]);
    expect([...days.keys()]).toEqual(['2027-02-20', '2027-02-21']);
    expect(days.get('2027-02-20')!.events).toEqual([event]);
    expect(days.get('2027-02-21')!.events).toEqual([event]);
    expect(days.get('2027-02-21')!.start).toBe(Date.parse('2027-02-21T05:00:00Z'));
    expect(days.get('2027-02-20')!.end).toBe(days.get('2027-02-21')!.start);
  });

  it('does not add the next day when an event ends exactly at local midnight', () => {
    expect([...scheduleDays([{ starts_at: '2027-02-21T04:00:00Z', ends_at: '2027-02-21T05:00:00Z' }]).keys()]).toEqual(['2027-02-20']);
  });

  it.each([
    ['2027-03-14', '2027-03-14T05:00:00Z', '2027-03-15T04:00:00Z', 23],
    ['2027-11-07', '2027-11-07T04:00:00Z', '2027-11-08T05:00:00Z', 25],
  ])('uses actual midnight boundaries for the DST day %s', (date, start, end, hours) => {
    const days = scheduleDays([{ starts_at: start, ends_at: end }]);
    expect([...days.keys()]).toEqual([date]);
    expect((days.get(date)!.end - days.get(date)!.start) / 3_600_000).toBe(hours);
  });

  it('creates intermediate days and sorts unsorted events across year boundaries', () => {
    const days = scheduleDays([
      { starts_at: '2028-01-03T15:00:00Z', ends_at: '2028-01-03T16:00:00Z' },
      { starts_at: '2028-01-01T04:00:00Z', ends_at: '2028-01-02T07:00:00Z' },
    ]);
    expect([...days.keys()]).toEqual(['2027-12-31', '2028-01-01', '2028-01-02', '2028-01-03']);
  });
});

describe("layoutLanes", () => {
  it("splits overlapping events and gives the rest full width", () => {
    const placed = layoutLanes([ev("c", "11:00", "12:00"), ev("b", "09:30", "10:30"), ev("a", "09:00", "10:00")]);
    const byId = Object.fromEntries(placed.map((p) => [p.event.id, [p.lane, p.lanes]]));
    expect(byId).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it("reuses a lane once it frees up", () => {
    const placed = layoutLanes([ev("a", "09:00", "11:00"), ev("b", "09:00", "10:00"), ev("c", "10:00", "11:00")]);
    const byId = Object.fromEntries(placed.map((p) => [p.event.id, [p.lane, p.lanes]]));
    expect(byId).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2] });
  });
});
