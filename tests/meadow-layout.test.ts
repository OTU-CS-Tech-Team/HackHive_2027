import { describe, expect, it } from "vitest";
import { GRASS_CLEAR, buildLayout, pathCenterAt, pathCenterMid } from "@/components/landing/meadow/layout";
import { FOREST, HORIZON, SKY_TOP, handoffVeil } from "@/components/landing/meadow/palette";
import { sceneBudget } from "@/components/landing/meadow/stats";
import { readForcedTrim, trimmedInstances, trimmedSparks } from "@/components/landing/meadow/trim";

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
        for (let index = 0; index < group.count; index += 1) {
          const x = group.matrices[index * 16 + 12] ?? 0;
          const z = group.matrices[index * 16 + 14] ?? 0;
          const wide = Math.abs(x - pathCenterAt(z));
          const mid = Math.abs(x - pathCenterMid(z));
          expect(wide > 0.48 || mid > 0.22).toBe(true);
        }
      }
      grass += patch.grass.count;
      for (const x of column(patch.grass.matrices, patch.grass.count, 12)) {
        expect(Math.abs(x)).toBeGreaterThan(GRASS_CLEAR - 0.05);
      }
    }
    expect(grass).toBeGreaterThan(800);
    expect(layout.patches.reduce((sum, patch) => sum + patch.lupins.count, 0)).toBeGreaterThanOrEqual(110);
    expect(flowers).toBeGreaterThan(250);
    expect(layout.clouds.count).toBeGreaterThan(0);
    expect(layout.sparks.count).toBeGreaterThan(100);
    expect(layout.leaves.count).toBe(0);
  });

  it("fills the middle of the garden on both sides", () => {
    const layout = buildLayout("high");
    let left = 0;
    let right = 0;
    for (const patch of layout.patches) {
      for (const group of [patch.lilies, patch.daisies, patch.lupins]) {
        for (let index = 0; index < group.count; index += 1) {
          const x = group.matrices[index * 16 + 12] ?? 0;
          const z = group.matrices[index * 16 + 14] ?? 0;
          if (z < -1.2 || z > 3.2) continue;
          if (x < pathCenterAt(z)) left += 1;
          else right += 1;
        }
      }
    }
    expect(left).toBeGreaterThan(40);
    expect(right).toBeGreaterThan(40);
    expect(Math.abs(left - right) / Math.max(left, right)).toBeLessThan(0.25);
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

  it("trims grass and sparks before it touches a flower", () => {
    expect(trimmedInstances(1800, "grass", 1)).toBe(900);
    expect(trimmedInstances(1800, "grass", 2)).toBe(450);
    expect(trimmedSparks(280, 1)).toBe(140);
    expect(trimmedSparks(280, 2)).toBe(70);
    expect(trimmedInstances(104, "flower", 1)).toBe(104);
    expect(trimmedInstances(104, "flower", 2)).toBe(104);
    expect(trimmedInstances(104, "flower", 3)).toBe(104);
    expect(trimmedInstances(104, "mid", 1)).toBe(104);
    expect(trimmedInstances(104, "mid", 2)).toBe(104);
    expect(trimmedInstances(104, "mid", 3)).toBe(104);
    expect(trimmedInstances(80, "far", 1)).toBe(80);
    expect(trimmedInstances(80, "far", 2)).toBe(80);
    expect(trimmedInstances(80, "far", 3)).toBe(80);
    expect(trimmedInstances(1800, "grass", 3)).toBe(450);
    expect(trimmedSparks(280, 3)).toBe(70);
    expect(trimmedInstances(7, "other", 2)).toBe(7);
    expect(readForcedTrim("?meadowTrim=1")).toBe(1);
    expect(readForcedTrim("?meadowTrim=2")).toBe(2);
    expect(readForcedTrim("?meadowTrim=3", "development")).toBe(3);
    expect(readForcedTrim("")).toBe(0);
    expect(readForcedTrim("?meadowTrim=1", "production")).toBe(0);
    expect(readForcedTrim("?meadowTrim=2", "production")).toBe(0);
    expect(readForcedTrim("?meadowTrim=3", "production")).toBe(0);
  });

  it("keeps both quality levels on a small draw budget", () => {
    const high = sceneBudget("high");
    const low = sceneBudget("low");
    expect(high.draws).toBe(20);
    expect(low.draws).toBe(20);
    expect(high.triangles).toBeLessThan(350_000);
    expect(low.triangles).toBeLessThan(high.triangles);
    expect(low.instances.lilies).toBe(high.instances.lilies);
    expect(low.instances.lupins).toBe(high.instances.lupins);
  });
});
