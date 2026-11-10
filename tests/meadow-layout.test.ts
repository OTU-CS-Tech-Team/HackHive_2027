import { describe, expect, it } from "vitest";
import { FLOWER_CLEAR, GRASS_CLEAR, buildLayout } from "@/components/landing/meadow/layout";
import { FOREST, HORIZON, SKY_TOP, handoffVeil } from "@/components/landing/meadow/palette";
import { sceneBudget } from "@/components/landing/meadow/stats";

function column(matrices: Float32Array, count: number, offset: number) {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) values.push(matrices[index * 16 + offset] ?? 0);
  return values;
}

describe("meadow layout", () => {
  it("keeps flowers beside the path and grass off the centre", () => {
    const layout = buildLayout("high");
    let flowers = 0;
    let grass = 0;
    for (const patch of layout.patches) {
      for (const group of [patch.lilies, patch.daisies, patch.lupins]) {
        flowers += group.count;
        for (const x of column(group.matrices, group.count, 12)) {
          expect(Math.abs(x)).toBeGreaterThan(FLOWER_CLEAR - 0.05);
        }
      }
      grass += patch.grass.count;
      for (const x of column(patch.grass.matrices, patch.grass.count, 12)) {
        expect(Math.abs(x)).toBeGreaterThan(GRASS_CLEAR - 0.05);
      }
    }
    expect(grass).toBeGreaterThan(flowers);
    expect(layout.clouds.count).toBeGreaterThan(0);
    expect(layout.sparks.count).toBeGreaterThan(100);
    expect(layout.leaves.count).toBe(0);
  });

  it("thins a shuffled prefix across the depth of every patch", () => {
    const layout = buildLayout("high");
    for (const patch of layout.patches) {
      const scatter = patch.grass;
      expect(scatter.count).toBeGreaterThan(12);
      const full = column(scatter.matrices, scatter.count, 14);
      const keep = Math.floor(scatter.count * 0.45);
      const prefix = column(scatter.matrices, keep, 14);
      const span = Math.max(...full) - Math.min(...full);
      const kept = Math.max(...prefix) - Math.min(...prefix);
      expect(kept).toBeGreaterThan(span * 0.5);
    }
  });

  it("shares one horizon colour and only veils at the hand-off", () => {
    expect(HORIZON).toBe("#f4e4b4");
    expect(SKY_TOP).toBe("#e2f2f8");
    expect(FOREST).toBe("#0b2419");
    expect(handoffVeil(0)).toBe(0);
    expect(handoffVeil(0.5)).toBe(0);
    expect(handoffVeil(0.84)).toBeCloseTo(1);
    expect(handoffVeil(1)).toBe(1);
  });

  it("keeps both quality levels on a small draw budget", () => {
    const high = sceneBudget("high");
    const low = sceneBudget("low");
    expect(high.draws).toBeLessThan(24);
    expect(low.draws).toBeLessThanOrEqual(high.draws);
    expect(low.triangles).toBeLessThan(high.triangles);
    expect(low.instances.lilies).toBeLessThan(high.instances.lilies);
  });
});
