export type StarPoint = { x: number; y: number };
type SkyShape = { points: StarPoint[]; edges: [number, number][] };

// Clear space-inspired silhouettes, without extra mesh lines or filled faces.
// Extra projects subdivide the sides rather than changing the silhouette.
const SILHOUETTES: StarPoint[][] = [
  // A four-point nova.
  Array.from({ length: 8 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 4;
    const radius = index % 2 === 0 ? 1 : .32;
    return { x: 500 + Math.cos(angle) * 355 * radius, y: 400 + Math.sin(angle) * 330 * radius };
  }),
  // An angular crescent, open toward the project preview.
  [{ x: 660, y: 80 }, { x: 405, y: 310 }, { x: 420, y: 485 },
    { x: 690, y: 720 }, { x: 245, y: 590 }, { x: 180, y: 250 }],
  // A sharp lightning silhouette.
  [{ x: 570, y: 70 }, { x: 240, y: 420 }, { x: 475, y: 420 },
    { x: 385, y: 730 }, { x: 790, y: 315 }, { x: 555, y: 315 }],
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
