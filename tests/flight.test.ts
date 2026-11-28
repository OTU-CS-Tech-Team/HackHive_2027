import { describe, expect, it } from 'vitest';
import { FLIGHTS } from '../src/app/dashboard/avatar/Flight';

// The wardrobe's flight paths are tuned by eye; this catches a tweak that
// flies a bee out of its 400x180 box or leaves a loop open.
describe('wardrobe flights', () => {
  it('keeps every bee inside its box, with room for its wings, on a closed loop', () => {
    for (const { d } of FLIGHTS) {
      const n = d.match(/-?[\d.]+/g)!.map(Number);
      // The M point, then each C's end point: all on the curve.
      const points = [[n[0], n[1]], ...Array.from({ length: (n.length - 2) / 6 }, (_, i) => [n[6 + i * 6], n[7 + i * 6]])];
      for (const [x, y] of points) {
        expect(x).toBeGreaterThan(12);
        expect(x).toBeLessThan(388);
        expect(y).toBeGreaterThan(12);
        expect(y).toBeLessThan(168);
      }
      expect(points.at(-1)).toEqual(points[0]);
    }
  });
});
