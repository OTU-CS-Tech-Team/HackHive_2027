export type StarPoint = { x: number; y: number };
type SkyShape = { points: StarPoint[]; edges: [number, number][] };

// Orion, Cassiopeia, and Lyra: recognizable star paths, rather than radial charts.
const SHAPES: SkyShape[] = [
  {
    points: [{ x: 475, y: 90 }, { x: 300, y: 210 }, { x: 650, y: 195 },
      { x: 385, y: 425 }, { x: 460, y: 440 }, { x: 535, y: 455 },
      { x: 320, y: 695 }, { x: 650, y: 675 }, { x: 475, y: 565 }],
    edges: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7], [4, 8]],
  },
  {
    points: [{ x: 150, y: 270 }, { x: 315, y: 570 }, { x: 480, y: 335 },
      { x: 640, y: 570 }, { x: 810, y: 205 }, { x: 855, y: 115 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    points: [{ x: 290, y: 125 }, { x: 455, y: 275 }, { x: 370, y: 380 },
      { x: 695, y: 410 }, { x: 610, y: 655 }, { x: 300, y: 610 }],
    edges: [[0, 1], [0, 2], [1, 2], [1, 3], [3, 4], [4, 5], [5, 2]],
  },
];

export function constellationFor(year: number, count: number): SkyShape {
  const shape = SHAPES[((2026 - year) % SHAPES.length + SHAPES.length) % SHAPES.length];
  const points = Array.from({ length: count }, (_, index) => shape.points[index] ?? {
    x: 120 + (index * 137) % 720, y: 100 + (index * 97) % 590,
  });
  const edges = shape.edges.filter(([a, b]) => a < count && b < count);
  for (let i = shape.points.length; i < count; i++) edges.push([i - 1, i]);
  return { points, edges };
}

export function clockwiseOrder(points: StarPoint[]) {
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  return points.map((point, index) => ({ index, angle: (Math.atan2(point.y - center.y, point.x - center.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2) }))
    .sort((a, b) => a.angle - b.angle).map(point => point.index);
}
