import { describe, expect, it } from "vitest";
import {
  SCENE_HOLD,
  VEIL_START,
  copyFade,
  dawnCoverage,
  sceneProgress,
  veilAmount,
  veilBackground,
} from "@/components/landing/heroHandoff";

describe("hero hand-off", () => {
  it("holds the meadow just before its own cream", () => {
    expect(sceneProgress(0)).toBe(0);
    expect(sceneProgress(0.4)).toBeCloseTo(0.4);
    expect(sceneProgress(1)).toBe(SCENE_HOLD);
    expect(SCENE_HOLD).toBeLessThan(0.7);
  });

  it("starts the veil at 0.75, and only once .dawn is on screen", () => {
    expect(veilAmount(0.5)).toBe(0);
    expect(veilAmount(VEIL_START - 0.01)).toBe(0);
    expect(dawnCoverage(VEIL_START)).toBeGreaterThan(0);
    expect(veilAmount(VEIL_START)).toBe(0);
    expect(veilAmount(1)).toBeGreaterThan(0.5);
    expect(veilBackground(0.6)).toBe("rgba(255, 246, 234, 0)");
    const late = veilBackground(1);
    expect(late.startsWith("linear-gradient")).toBe(true);
    expect(late).toContain("rgba(255,246,234,0) 0%");
    expect(late).not.toContain("rgba(255,255,255,1)");
  });

  it("lifts the title group out before the veil is strong", () => {
    expect(copyFade(0.72)).toBe(0);
    expect(copyFade(0.81)).toBeGreaterThan(0.4);
    expect(copyFade(0.9)).toBe(1);
    expect(copyFade(1)).toBe(1);
    expect(veilAmount(0.9)).toBeLessThan(0.55);
  });
});
