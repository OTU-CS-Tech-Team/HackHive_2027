import { describe, expect, it } from 'vitest';
import { constellationFor, revealPlan } from '@/components/museum/constellations';

describe('constellation reveal', () => {
  it.each([[2026, 9], [2025, 6], [2024, 6], [2026, 30]])('grows every star out of a placed neighbour (%i, %i projects)', (year, hosts) => {
    const shape = constellationFor(year, hosts);
    const plan = revealPlan(shape, hosts);
    plan.stars.forEach((star, index) => {
      expect(Number.isFinite(star.delay)).toBe(true);
      if (index < hosts) expect(star.from).toEqual(plan.center);
    });
    plan.lines.forEach(line => {
      expect(Number.isFinite(line.delay)).toBe(true);
      // A line never starts drawing before the star it grows from has started moving.
      expect(line.delay).toBeGreaterThanOrEqual(plan.stars[line.from].delay);
    });
    // A star that rides a line leaves from that line's start, in step with it.
    plan.lines.filter(line => plan.stars[line.to].from === shape.points[line.from]).forEach(line => {
      expect(line.delay).toBe(plan.stars[line.to].delay);
    });
  });
});
