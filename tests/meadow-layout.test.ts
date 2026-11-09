import { describe, expect, it } from "vitest";
import { FLOWER_CLEAR, GRASS_CLEAR, buildLayout } from "@/components/landing/meadow/layout";
import { HORIZON, SKY_TOP, handoffVeil } from "@/components/landing/meadow/palette";

describe("meadow layout", () => {
  it("keeps flowers beside a wide path and grass off the centre", () => {
    const layout = buildLayout("high");
    for (const group of [layout.lilies, layout.daisies, layout.lupins]) {
      expect(group.count).toBeGreaterThan(0);
      for (let index = 0; index < group.count; index += 1) {
        const x = group.matrices[index * 16 + 12] ?? 0;
        expect(Math.abs(x)).toBeGreaterThan(FLOWER_CLEAR - 0.05);
      }
    }
    for (let index = 0; index < layout.grass.count; index += 1) {
      const x = layout.grass.matrices[index * 16 + 12] ?? 0;
      expect(Math.abs(x)).toBeGreaterThan(GRASS_CLEAR - 0.05);
    }
    expect(layout.grass.count).toBeGreaterThan(layout.lilies.count);
  });

  it("shares one horizon colour and only veils at the hand-off", () => {
    expect(HORIZON).toBe("#f4e4b4");
    expect(SKY_TOP).toBe("#e2f2f8");
    expect(handoffVeil(0)).toBe(0);
    expect(handoffVeil(0.5)).toBe(0);
    expect(handoffVeil(1)).toBeGreaterThan(0.3);
    expect(handoffVeil(1)).toBeLessThan(0.5);
  });
});
