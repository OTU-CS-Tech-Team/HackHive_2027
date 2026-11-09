export type StarPoint = { x: number; y: number };
type SkyShape = { name: string; points: StarPoint[]; edges: [number, number][] };

// Full constellation figures from J2000 star positions (gnomonic projection, east left), scaled to the map.
// The first `count` points host projects; the rest are drawn as background stars to complete the shape.
const FIGURES: SkyShape[] = [
  {
    name: "Orion",
    points: [
      { x: 385, y: 341 } /* Betelgeuse */, { x: 577, y: 640 } /* Rigel */, { x: 526, y: 362 } /* Bellatrix */,
      { x: 474, y: 504 } /* Alnilam */, { x: 418, y: 670 } /* Saiph */, { x: 480, y: 294 } /* Meissa */,
      { x: 693, y: 348 } /* π3 Ori */, { x: 307, y: 207 } /* ξ Ori */, { x: 392, y: 90 } /* χ1 Ori */,
      { x: 494, y: 487 } /* Mintaka */, { x: 452, y: 518 } /* Alnitak */, { x: 529, y: 527 } /* η Ori */,
      { x: 352, y: 297 } /* μ Ori */, { x: 328, y: 197 } /* ν Ori */, { x: 347, y: 91 } /* χ2 Ori */,
      { x: 688, y: 311 } /* π2 Ori */, { x: 660, y: 223 } /* ο2 Ori */, { x: 686, y: 374 } /* π4 Ori */,
      { x: 673, y: 435 } /* π5 Ori */, { x: 652, y: 449 } /* π6 Ori */, { x: 678, y: 208 } /* ο1 Ori */,
      { x: 668, y: 288 } /* π1 Ori */, { x: 462, y: 531 } /* σ Ori */, { x: 477, y: 595 } /* ι Ori */,
      { x: 494, y: 622 } /* υ Ori */,
    ],
    edges: [[0, 5], [5, 2], [0, 10], [2, 9], [10, 3], [3, 9], [10, 4], [9, 11], [11, 1], [4, 1], // body
      [0, 12], [12, 7], [12, 13], [7, 14], [13, 8], // club
      [2, 6], [6, 15], [15, 16], [6, 17], [17, 18], [18, 19]], // shield
  },
  {
    name: "Ursa Major",
    points: [
      { x: 120, y: 302 } /* Alkaid */, { x: 311, y: 278 } /* Alioth */, { x: 558, y: 248 } /* Dubhe */,
      { x: 435, y: 360 } /* Phecda */, { x: 852, y: 191 } /* Muscida */, { x: 528, y: 522 } /* ψ UMa */,
      { x: 236, y: 258 } /* Mizar */, { x: 401, y: 295 } /* Megrez */, { x: 558, y: 333 } /* Merak */,
      { x: 725, y: 206 } /* 23 UMa */, { x: 704, y: 278 } /* υ UMa */, { x: 718, y: 357 } /* φ UMa */,
      { x: 773, y: 383 } /* θ UMa */, { x: 880, y: 411 } /* ι UMa */, { x: 874, y: 429 } /* κ UMa */,
      { x: 434, y: 457 } /* χ UMa */, { x: 681, y: 544 } /* λ UMa */, { x: 668, y: 569 } /* μ UMa */,
    ],
    edges: [[0, 6], [6, 1], [1, 7], [7, 2], [2, 8], [8, 3], [3, 7], // Big Dipper
      [2, 9], [9, 4], [4, 10], [10, 11], [8, 11], [11, 12], [12, 13], [12, 14], // head and front legs
      [3, 15], [15, 5], [5, 16], [5, 17]], // hind leg
  },
  {
    // Rotated 35° to match the reference view of Virgo rising.
    name: "Virgo",
    points: [
      { x: 604, y: 560 } /* Spica */, { x: 657, y: 339 } /* Porrima */, { x: 479, y: 225 } /* Vindemiatrix */,
      { x: 778, y: 90 } /* ν Vir */, { x: 222, y: 578 } /* 109 Vir */, { x: 304, y: 670 } /* μ Vir */,
      { x: 569, y: 309 } /* δ Vir */, { x: 480, y: 446 } /* ζ Vir */, { x: 723, y: 278 } /* η Vir */,
      { x: 376, y: 479 } /* τ Vir */, { x: 446, y: 656 } /* κ Vir */, { x: 397, y: 608 } /* ι Vir */,
    ],
    edges: [[3, 8], [8, 1], [1, 6], [6, 2], [6, 7], [7, 9], [9, 4], [1, 0], [7, 0], [0, 10], [10, 11], [11, 5]],
  },
];

export function constellationFor(year: number, count: number): SkyShape {
  const figure = FIGURES[((2026 - year) % FIGURES.length + FIGURES.length) % FIGURES.length];
  const points = figure.points.map(point => ({ ...point }));
  const edges = figure.edges.map(edge => [...edge] as [number, number]);
  // More projects than stars: split a long existing line, preserving the silhouette.
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
