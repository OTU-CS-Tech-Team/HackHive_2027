export type StarPoint = { x: number; y: number };
type SkyShape = { points: StarPoint[]; edges: [number, number][] };

// Distinct silhouettes: a stellar burst, a long diamond, and a faceted comet.
// Subdivide existing sides when a year has more projects than polygon corners.
const SILHOUETTES: StarPoint[][] = [
  [1, .52, .94, .58, 1, .62, .91, .5, .94].map((radius, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / 9;
    return { x: 500 + Math.cos(angle) * 350 * radius, y: 400 + Math.sin(angle) * 315 * radius };
  }),
  [{ x: 520, y: 85 }, { x: 820, y: 355 }, { x: 445, y: 710 }, { x: 215, y: 450 }],
  [{ x: 350, y: 90 }, { x: 810, y: 250 }, { x: 660, y: 635 }, { x: 220, y: 710 }, { x: 345, y: 415 }],
];

export function constellationFor(year: number, count: number): SkyShape {
  const corners = SILHOUETTES[((2026 - year) % SILHOUETTES.length + SILHOUETTES.length) % SILHOUETTES.length];
  const points: StarPoint[] = [];
  for (let side = 0; side < corners.length; side++) {
    const segments = Math.floor(count / corners.length) + (side < count % corners.length ? 1 : 0);
    for (let step = 0; step < segments; step++) {
      const start = corners[side], end = corners[(side + 1) % corners.length];
      points.push({ x: start.x + (end.x - start.x) * step / segments, y: start.y + (end.y - start.y) * step / segments });
    }
  }
  const edges: [number, number][] = points.slice(1).map((_, i) => [i, i + 1]);
  if (count > 2) edges.push([count - 1, 0]);
  return { points, edges };
}

export function clockwiseOrder(points: StarPoint[]) {
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  return points.map((point, index) => ({ index, angle: (Math.atan2(point.y - center.y, point.x - center.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2) }))
    .sort((a, b) => a.angle - b.angle).map(point => point.index);
}
