import { describe, expect, it } from "vitest";
import {
  SPONSORS_GOLD,
  WALK_END,
  WALK_SCROLL,
  bandAmount,
  copyFade,
  sceneProgress,
  veilBackground,
} from "@/components/landing/heroHandoff";
import { handoffVeil } from "@/components/landing/meadow/palette";

describe("hero hand-off", () => {
  it("walks only while the garden still fills the frame", () => {
    expect(sceneProgress(0)).toBe(0);
    expect(sceneProgress(WALK_SCROLL)).toBe(WALK_END);
    expect(sceneProgress(5)).toBe(WALK_END);
    expect(WALK_END).toBeLessThanOrEqual(0.25);
    // The scene's own cream never starts.
    expect(handoffVeil(sceneProgress(5))).toBe(0);
  });

  it("eases the walk to rest after the stage releases, not at it", () => {
    // Still moving at release (scroll 1), so it settles while the stage leaves.
    expect(WALK_SCROLL).toBeGreaterThan(1);
    expect(sceneProgress(1)).toBeLessThan(WALK_END);
    expect(sceneProgress(1)).toBeGreaterThan(WALK_END * 0.8);
    // Always forward, and slowing: each step covers less than the one before.
    const step = 0.05;
    let lastGain = Infinity;
    for (let s = 0; s < WALK_SCROLL - step / 2; s += step) {
      const gain = sceneProgress(s + step) - sceneProgress(s);
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThanOrEqual(lastGain + 1e-12);
      lastGain = gain;
    }
    // The last step is a crawl next to the first, so there is no dead stop.
    const first = sceneProgress(step) - sceneProgress(0);
    expect(lastGain).toBeLessThan(first * 0.1);
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

  it("fades the title group out gently, gone as the camera comes to rest", () => {
    expect(copyFade(0.6)).toBe(0);
    // Half there as the stage releases, so it leaves with the slide.
    expect(copyFade(1)).toBeGreaterThan(0.3);
    expect(copyFade(1)).toBeLessThan(0.7);
    expect(copyFade(WALK_SCROLL)).toBe(1);
    expect(copyFade(3)).toBe(1);
    // Spread over a long stretch of scroll, not one wheel notch.
    expect(copyFade(0.8)).toBeLessThan(0.25);
    expect(copyFade(1.2)).toBeLessThan(1);
  });
});
