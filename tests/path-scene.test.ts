import { describe, expect, it } from "vitest";
import { placeRect, sceneMotion } from "@/app/prototype/path/motion";

describe("trailhead prototype motion", () => {
  it("starts on the parted trailhead and parts onto the next chapter", () => {
    expect(sceneMotion(0)).toEqual({ walk: 0, wallOpen: 1, hero: 1, chapter: 0 });
    expect(sceneMotion(1).walk).toBe(1);
    expect(sceneMotion(1).wallOpen).toBe(1);
    expect(sceneMotion(1).hero).toBe(0);
    expect(sceneMotion(1).chapter).toBe(1);
  });

  it("closes the petal wall between the walk and the parting", () => {
    expect(sceneMotion(0.59).wallOpen).toBeCloseTo(0.5, 5);
    expect(sceneMotion(0.59).hero).toBeGreaterThan(0);
    expect(sceneMotion(0.59).hero).toBeLessThan(0.5);
    expect(sceneMotion(0.7).hero).toBe(0);
    expect(sceneMotion(0.72).wallOpen).toBe(0);
    expect(sceneMotion(0.72).hero).toBe(0);
    expect(sceneMotion(0.72).chapter).toBe(0);
    expect(sceneMotion(0.9).chapter).toBeGreaterThan(0.5);
    expect(sceneMotion(0.3).walk).toBeGreaterThan(0);
    expect(sceneMotion(0.3).walk).toBeLessThan(1);
  });

  it("maps viewBox rectangles through a cover crop", () => {
    const full = placeRect({ x: 100, y: 80, w: 40, h: 20 }, 1440, 900, 1440, 900);
    expect(full).toEqual({ left: 100, top: 80, width: 40, height: 20 });

    const phone = placeRect({ x: 710, y: 440, w: 20, h: 20 }, 390, 844, 1440, 900);
    expect(phone.left + phone.width / 2).toBeCloseTo(195, 0);
    expect(phone.top + phone.height / 2).toBeCloseTo(422, 0);
  });
});
