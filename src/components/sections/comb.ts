export const COMB_WIDTH = 1440;
export const COMB_HEIGHT = 240;

const RADIUS = 28;
const COLUMN = RADIUS * Math.sqrt(3);
const ROW = RADIUS * 1.5;
const ROWS = 6;
const COLUMNS = Math.ceil(COMB_WIDTH / COLUMN) + 2;

// Deterministic noise so the server markup never changes between renders.
export const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// A point-up hexagon as SVG path data.
export function hexagon(cx: number, cy: number, r: number) {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`;
  });
  return `M${points.join("L")}Z`;
}

// Row 0 sits on the bottom edge of the art.
const cell = (column: number, row: number, r: number) =>
  hexagon(
    (column - 1 + (row % 2) / 2) * COLUMN,
    COMB_HEIGHT - row * ROW,
    r,
  );

// A solid edge, and loose cells above it that break off. Cells are listed
// outermost first, so a stagger peels the comb from its tip.
export function comb(seed: number) {
  const tops: number[] = [];
  let edge = "";
  for (let column = 0; column < COLUMNS; column++) {
    const top = 1 + Math.floor(rand(seed + 200 + column) * 2);
    tops.push(top);
    for (let row = 0; row <= top; row++) edge += cell(column, row, RADIUS + 0.7);
  }

  const cells: string[] = [];
  for (let row = ROWS - 2; row > 1; row--) {
    for (let column = 0; column < COLUMNS; column++) {
      const gap = row - tops[column] - 1;
      if (gap < 0) continue;
      if (rand(seed + 300 + column * 7 + row * 31) < 0.7 * 0.6 ** gap) {
        cells.push(cell(column, row, RADIUS - 1.5));
      }
    }
  }

  return { edge, cells };
}
