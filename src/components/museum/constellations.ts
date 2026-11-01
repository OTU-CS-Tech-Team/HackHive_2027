export type StarPoint = { x: number; y: number };
type SkyShape = { points: StarPoint[]; edges: [number, number][] };

// A hive cell: every project lies on one continuous, clockwise honeycomb path.
// Extra projects subdivide the sides, keeping the silhouette deliberate at any size.
export function constellationFor(year: number, count: number): SkyShape {
  const rotation = (year % 2) * Math.PI / 6;
  const corners = Array.from({ length: 6 }, (_, i) => {
    const angle = -Math.PI / 2 + rotation + i * Math.PI / 3;
    return { x: 500 + Math.cos(angle) * 335, y: 400 + Math.sin(angle) * 310 };
  });
  const points: StarPoint[] = [];
  for (let side = 0; side < 6; side++) {
    const segments = Math.floor(count / 6) + (side < count % 6 ? 1 : 0);
    for (let step = 0; step < segments; step++) {
      const start = corners[side], end = corners[(side + 1) % 6];
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
