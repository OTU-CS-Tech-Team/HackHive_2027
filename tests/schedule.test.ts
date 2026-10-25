import { describe, expect, it } from "vitest";
import { layoutLanes } from "@/lib/schedule";

const ev = (id: string, start: string, end: string) => ({
  id,
  starts_at: `2027-02-20T${start}:00Z`,
  ends_at: `2027-02-20T${end}:00Z`,
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
