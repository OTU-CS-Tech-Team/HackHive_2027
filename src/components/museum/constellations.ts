export type StarPoint = { x: number; y: number };
type SkyShape = { name: string; points: StarPoint[]; edges: [number, number][] };

// Stylized zodiac line figures, adapted to project counts rather than sky coordinates.
const FIGURES: SkyShape[] = [
  {
    name: "Cancer",
    points: [{ x: 400, y: 340 }, { x: 600, y: 340 }, { x: 500, y: 510 },
      { x: 220, y: 230 }, { x: 300, y: 95 }, { x: 780, y: 230 },
      { x: 700, y: 95 }, { x: 260, y: 650 }, { x: 740, y: 650 }],
    edges: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [1, 5], [5, 6], [0, 7], [1, 8]],
  },
  {
    name: "Taurus",
    points: [{ x: 350, y: 320 }, { x: 500, y: 650 }, { x: 650, y: 320 },
      { x: 210, y: 80 }, { x: 790, y: 80 }, { x: 500, y: 240 }],
    edges: [[0, 1], [1, 2], [0, 3], [2, 4], [0, 5], [5, 2]],
  },
  {
    name: "Capricornus",
    points: [{ x: 265, y: 90 }, { x: 240, y: 260 }, { x: 380, y: 400 },
      { x: 810, y: 300 }, { x: 685, y: 665 }, { x: 420, y: 560 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
];

export function constellationFor(year: number, count: number): SkyShape {
  const figure = FIGURES[((2026 - year) % FIGURES.length + FIGURES.length) % FIGURES.length];
  const points = figure.points.slice(0, count).map(point => ({ ...point }));
  const edges = figure.edges.filter(([a, b]) => a < count && b < count).map(edge => [...edge] as [number, number]);
  // New projects split a long existing line, preserving the animal's silhouette.
  while (points.length < count) {
    let longest = 0;
    for (let i = 1; i < edges.length; i++) {
      const length = ([a, b]: [number, number]) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
      if (length(edges[i]) > length(edges[longest])) longest = i;
    }
    const [a, b] = edges[longest];
    const index = points.length;
    points.push({ x: (points[a].x + points[b].x) / 2, y: (points[a].y + points[b].y) / 2 });
    edges[longest] = [a, index];
    edges.push([index, b]);
  }
  return { name: figure.name, points, edges };
}

export function clockwiseOrder(points: StarPoint[]) {
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  return points.map((point, index) => ({ index, angle: (Math.atan2(point.y - center.y, point.x - center.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2) }))
    .sort((a, b) => a.angle - b.angle).map(point => point.index);
}
