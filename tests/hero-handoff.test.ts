import { describe, expect, it } from "vitest";
import {
  SPONSORS_GOLD,
  WALK_END,
  bandAmount,
  copyFade,
  sceneProgress,
  veilBackground,
} from "@/components/landing/heroHandoff";
import { handoffVeil } from "@/components/landing/meadow/palette";

describe("hero hand-off", () => {
  it("walks only while the garden still fills the frame", () => {
    expect(sceneProgress(0)).toBe(0);
    expect(sceneProgress(0.5)).toBeCloseTo(WALK_END / 2);
    expect(sceneProgress(1)).toBe(WALK_END);
    expect(sceneProgress(2)).toBe(WALK_END);
    expect(WALK_END).toBeLessThanOrEqual(0.25);
    // The scene's own cream never starts.
    expect(handoffVeil(sceneProgress(1))).toBe(0);
  });

  it("ends on Sponsors' gold, with no white or cream stop", () => {
    expect(SPONSORS_GOLD).toBe("#f5cc7c");
    expect(bandAmount(0.5)).toBe(0);
    expect(veilBackground(0.5)).toBe("transparent");
    expect(bandAmount(1)).toBe(1);
    const late = veilBackground(1);
    expect(late.startsWith("linear-gradient")).toBe(true);
    expect(late).toContain("rgba(245,204,124,1.000) 100%");
    expect(late).not.toMatch(/255,\s*2[45]\d,\s*2\d\d/);
    for (const scroll of [0.6, 0.7, 0.8, 0.9, 0.99]) {
      expect(veilBackground(scroll)).not.toMatch(/255,\s*2[45]\d,\s*2\d\d/);
      expect(bandAmount(scroll)).toBeLessThan(1);
    }
  });

  it("lifts the title group out before the band is strong", () => {
    expect(copyFade(0.72)).toBe(0);
    expect(copyFade(0.81)).toBeGreaterThan(0.4);
    expect(copyFade(0.9)).toBe(1);
    expect(copyFade(1)).toBe(1);
  });
});
