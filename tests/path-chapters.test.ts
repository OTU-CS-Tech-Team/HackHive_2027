import { describe, expect, it } from "vitest";
import { PATH_CHAPTERS } from "@/components/path/chapters";
import { blurPx, slotRank, zoomScale } from "@/components/path/math";
import { CHAPTER_IDS, LAYER_SLOTS } from "@/components/path/types";

describe("path chapters", () => {
  it("walks seven stops from morning to sunset", () => {
    expect(PATH_CHAPTERS.map((chapter) => chapter.id)).toEqual([...CHAPTER_IDS]);
    expect(PATH_CHAPTERS[0]?.light).toBe("#ffe7a3");
    expect(PATH_CHAPTERS.at(-1)?.light).toBe("#d24a32");
  });

  it("gives every layer a slot, a depth, and art to swap", () => {
    const ids = new Set<string>();
    for (const chapter of PATH_CHAPTERS) {
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.layers.length).toBeGreaterThanOrEqual(4);
      for (const layer of chapter.layers) {
        expect(LAYER_SLOTS).toContain(layer.slot);
        expect(layer.depth).toBeGreaterThanOrEqual(0);
        expect(layer.depth).toBeLessThanOrEqual(1);
        expect(layer.src || layer.placeholder).toBeTruthy();
        expect(ids.has(layer.id)).toBe(false);
        ids.add(layer.id);
      }
      const sky = chapter.layers.find((layer) => layer.slot === "sky");
      const foreground = chapter.layers.find((layer) => layer.slot === "foreground");
      expect(sky && foreground && foreground.depth > sky.depth).toBe(true);
    }
  });

  it("keeps the mobile foreground lighter except at the hive", () => {
    for (const chapter of PATH_CHAPTERS) {
      const foreground = chapter.layers.find((layer) => layer.slot === "foreground");
      expect(foreground?.mobile).toBe(chapter.id === "hive");
    }
  });
});

describe("path depth", () => {
  it("zooms near layers farther than the horizon", () => {
    expect(zoomScale(0.06, false)).toBeLessThan(zoomScale(0.98, false));
    expect(zoomScale(0.98, true)).toBeLessThan(zoomScale(0.98, false));
  });

  it("blurs only the close planes", () => {
    expect(blurPx(0.06, false)).toBe(0);
    expect(blurPx(0.98, false)).toBeGreaterThan(blurPx(0.5, false));
    expect(blurPx(0.5, true)).toBe(0);
    expect(blurPx(0.98, true)).toBeGreaterThan(0);
  });

  it("orders slots from sky to foreground", () => {
    expect(slotRank("sky")).toBeLessThan(slotRank("far"));
    expect(slotRank("far")).toBeLessThan(slotRank("mid"));
    expect(slotRank("mid")).toBeLessThan(slotRank("near"));
    expect(slotRank("near")).toBeLessThan(slotRank("foreground"));
  });
});
