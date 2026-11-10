import { describe, expect, it } from "vitest";
import { comb, hexagon } from "@/components/sections/comb";

describe("comb", () => {
  it("draws a closed six-sided hexagon around its centre", () => {
    const points = hexagon(100, 50, 10).slice(1, -1).split("L");
    expect(points).toHaveLength(6);
    expect(points).toContain("100.0 60.0");
    expect(points).toContain("100.0 40.0");
  });

  it("gives the server and client the same art for a seed", () => {
    expect(comb(7)).toEqual(comb(7));
    expect(comb(7).edge).not.toEqual(comb(8).edge);
  });

  it("always leaves loose cells to break off", () => {
    for (const seed of [10, 500, 900]) {
      expect(comb(seed).cells.length).toBeGreaterThan(10);
    }
  });
});
