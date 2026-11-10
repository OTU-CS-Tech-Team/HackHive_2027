import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  PlaneGeometry,
} from "three";
import type { Scatter } from "@/components/landing/meadow/layout";

type RGB = [number, number, number];

type Bag = {
  positions: number[];
  colors: number[];
  bends: number[];
  indices: number[];
};

function bag(): Bag {
  return { positions: [], colors: [], bends: [], indices: [] };
}

function vert(mesh: Bag, x: number, y: number, z: number, color: RGB, bend: number) {
  mesh.positions.push(x, y, z);
  mesh.colors.push(color[0], color[1], color[2]);
  mesh.bends.push(bend);
  return mesh.positions.length / 3 - 1;
}

function finish(mesh: Bag, scatter?: Scatter): BufferGeometry {
  const geometry = new BufferGeometry();
  const count = mesh.positions.length / 3;
  geometry.setAttribute("position", new Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(mesh.colors, 3));
  geometry.setAttribute("aBend", new Float32BufferAttribute(mesh.bends, 1));
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();
  if (scatter) {
    geometry.setAttribute("aPhase", new InstancedBufferAttribute(scatter.phases, 1));
    geometry.setAttribute("aTint", new InstancedBufferAttribute(scatter.colors, 3));
  } else {
    geometry.setAttribute("aPhase", new Float32BufferAttribute(new Float32Array(count), 1));
    const tint = new Float32Array(count * 3);
    tint.fill(1);
    geometry.setAttribute("aTint", new Float32BufferAttribute(tint, 3));
  }
  return geometry;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function addPetal(
  mesh: Bag,
  yaw: number,
  pitch: number,
  length: number,
  width: number,
  curl: number,
  base: RGB,
  tip: RGB,
  bend: number,
  lift = 0,
  across = 3,
  along = 5,
) {
  const ids: number[] = [];
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  for (let yStep = 0; yStep <= along; yStep += 1) {
    const v = yStep / along;
    const profile = Math.sin(Math.PI * v) * (0.42 + 0.58 * Math.min(1, v / 0.22));
    const half = width * profile;
    for (let xStep = 0; xStep <= across; xStep += 1) {
      const u = (xStep / across) * 2 - 1;
      const x = u * half;
      const py = v * length;
      const cup = (1 - u * u) * curl * 0.55 * Math.sin(Math.PI * v);
      const pz = cup - Math.pow(v, 1.45) * curl;
      const y2 = py * cosP - pz * sinP;
      const z2 = py * sinP + pz * cosP;
      const x3 = x * cosY + z2 * sinY;
      const z3 = -x * sinY + z2 * cosY;
      const body = v < 0.22 ? mix([0.62, 0.58, 0.28], base, v / 0.22) : mix(base, tip, (v - 0.22) / 0.78);
      const edge = Math.abs(u);
      const throat = mix(body, tip, edge * edge * 0.55);
      ids.push(vert(mesh, x3, y2 + lift, z3, throat, bend));
    }
  }
  const stride = across + 1;
  for (let yStep = 0; yStep < along; yStep += 1) {
    for (let xStep = 0; xStep < across; xStep += 1) {
      const a = ids[yStep * stride + xStep] ?? 0;
      const b = ids[yStep * stride + xStep + 1] ?? 0;
      const c = ids[(yStep + 1) * stride + xStep] ?? 0;
      const d = ids[(yStep + 1) * stride + xStep + 1] ?? 0;
      mesh.indices.push(a, c, b, b, c, d);
    }
  }
}

function addDisc(mesh: Bag, y: number, radius: number, color: RGB, bend: number) {
  const center = vert(mesh, 0, y, 0, color, bend);
  const steps = 7;
  const ring: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push(vert(mesh, Math.cos(angle) * radius, y + 0.015, Math.sin(angle) * radius, color, bend));
  }
  for (let i = 0; i < steps; i += 1) {
    mesh.indices.push(center, ring[i] ?? center, ring[(i + 1) % steps] ?? center);
  }
}

/** A cupped trumpet petal. The surface opens outward, then the tip bends back. */
function addLilyPetal(mesh: Bag, yaw: number) {
  const across = 6;
  const along = 8;
  const length = 0.44;
  const width = 0.12;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const grid: number[][] = [];
  for (let yStep = 0; yStep <= along; yStep += 1) {
    const v = yStep / along;
    const half = width * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.5)), 0.4);
    const open = Math.pow(v, 0.6) * 0.38;
    const recurve = Math.pow(Math.max(0, (v - 0.58) / 0.42), 1.15) * 0.46;
    const row: number[] = [];
    for (let xStep = 0; xStep <= across; xStep += 1) {
      const u = (xStep / across) * 2 - 1;
      const channel = (1 - u * u) * 0.07 * Math.sin(Math.PI * v);
      const x = u * half;
      const y = length * (0.04 + v * 0.86) - recurve * 0.22;
      const z = 0.02 + open + channel - recurve;
      const edge = Math.abs(u);
      const color: RGB = [
        0.98 - edge * 0.2 - (1 - v) * 0.06,
        0.99 - edge * 0.12,
        0.95 - edge * 0.06,
      ];
      row.push(vert(mesh, x * cosY + z * sinY, y, -x * sinY + z * cosY, color, 0.06 + v * 0.45));
    }
    grid.push(row);
  }
  for (let yStep = 0; yStep < along; yStep += 1) {
    const lower = grid[yStep] ?? [];
    const upper = grid[yStep + 1] ?? [];
    for (let xStep = 0; xStep < across; xStep += 1) {
      const a = lower[xStep] ?? 0;
      const b = lower[xStep + 1] ?? 0;
      const c = upper[xStep] ?? 0;
      const d = upper[xStep + 1] ?? 0;
      mesh.indices.push(a, b, d, a, d, c);
    }
  }
}

export function createLilyGeometry(scatter?: Scatter) {
  const mesh = bag();
  const petals = 6;
  for (let i = 0; i < petals; i += 1) addLilyPetal(mesh, (i / petals) * Math.PI * 2);
  addDisc(mesh, 0.07, 0.04, [1, 0.97, 0.86], 0.02);
  return finish(mesh, scatter);
}

export function createDaisyGeometry(scatter?: Scatter) {
  const mesh = bag();
  const petals = 8;
  for (let i = 0; i < petals; i += 1) {
    addPetal(
      mesh,
      (i / petals) * Math.PI * 2,
      1.22,
      0.42,
      0.08,
      0.06,
      [0.99, 0.99, 0.97],
      [1, 1, 1],
      0.22,
    );
  }
  addDisc(mesh, 0.04, 0.12, [0.96, 0.74, 0.16], 0.05);
  addDisc(mesh, 0.06, 0.06, [0.84, 0.55, 0.1], 0.05);
  return finish(mesh, scatter);
}

/** A pea-sized teardrop. Local +Y runs from the stem out to the rounded tip. */
function addTeardrop(
  mesh: Bag,
  ox: number,
  oy: number,
  oz: number,
  radius: number,
  yaw: number,
  tilt: number,
  lit: RGB,
  dark: RGB,
) {
  const around = 8;
  const along = 4;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const place = (lx: number, ly: number, lz: number): [number, number, number] => {
    const y1 = ly * ct - lz * st;
    const z1 = ly * st + lz * ct;
    return [ox + lx * cy + z1 * sy, oy + y1, oz - lx * sy + z1 * cy];
  };
  const grid: number[][] = [];
  for (let step = 0; step <= along; step += 1) {
    const v = step / along;
    const belly = Math.sin(Math.PI * v);
    const rad = radius * belly;
    const shade = 0.25 + v * 0.65;
    const row: number[] = [];
    for (let side = 0; side < around; side += 1) {
      const angle = (side / around) * Math.PI * 2;
      const [x, y, z] = place(Math.cos(angle) * rad, (v - 0.45) * radius * 1.35, Math.sin(angle) * rad);
      row.push(vert(mesh, x, y, z, mix(dark, lit, shade), 0.06));
    }
    grid.push(row);
  }
  const baseAt = place(0, -0.45 * radius * 1.35, 0);
  const tipAt = place(0, 0.55 * radius * 1.35, 0);
  const base = vert(mesh, baseAt[0], baseAt[1], baseAt[2], dark, 0.06);
  const tip = vert(mesh, tipAt[0], tipAt[1], tipAt[2], lit, 0.06);
  const first = grid[0] ?? [];
  const last = grid[along] ?? [];
  for (let side = 0; side < around; side += 1) {
    const next = (side + 1) % around;
    mesh.indices.push(base, first[next] ?? base, first[side] ?? base);
    mesh.indices.push(tip, last[side] ?? tip, last[next] ?? tip);
  }
  for (let step = 0; step < along; step += 1) {
    const lower = grid[step] ?? [];
    const upper = grid[step + 1] ?? [];
    for (let side = 0; side < around; side += 1) {
      const next = (side + 1) % around;
      const a = lower[side] ?? 0;
      const b = lower[next] ?? 0;
      const c = upper[side] ?? 0;
      const d = upper[next] ?? 0;
      mesh.indices.push(a, b, d, a, d, c);
    }
  }
}

/** One spike: florets spiral up the stem, large and deep at the base, small and pale at the tip. */
export function createLupinGeometry(scatter?: Scatter) {
  const mesh = bag();
  const stem: RGB = [0.2, 0.34, 0.12];
  const stemTip: RGB = [0.38, 0.52, 0.2];
  let previous = vert(mesh, 0, 0, 0, stem, 0.2);
  for (let step = 1; step <= 6; step += 1) {
    const t = step / 6;
    const y = t * 1.12;
    const curve = Math.sin(t * Math.PI) * 0.04;
    const next = vert(mesh, curve, y, 0.004, mix(stem, stemTip, t), 0.35);
    const side = vert(mesh, curve + 0.007, y, -0.003, mix(stem, stemTip, t), 0.35);
    mesh.indices.push(previous, next, side);
    previous = next;
  }
  const florets = 44;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let floret = 0; floret < florets; floret += 1) {
    const t = floret / (florets - 1);
    const y = 0.06 + Math.pow(t, 0.82) * 1.02;
    const size = 0.028 * Math.pow(1 - t, 0.4) + 0.012;
    const yaw = floret * golden;
    const tilt = 1.2 - t * 0.55;
    const curve = Math.sin(t * Math.PI) * 0.045;
    const lit = mix([0.72, 0.66, 0.7], [1, 0.99, 0.97], Math.pow(t, 0.7));
    const dark = mix([0.42, 0.36, 0.42], [0.82, 0.78, 0.8], t);
    const stalk = 0.018 + size * 0.28;
    addTeardrop(mesh, Math.cos(yaw) * stalk + curve, y, Math.sin(yaw) * stalk, size, yaw, tilt, lit, dark);
  }
  return finish(mesh, scatter);
}

function addCurvedBlade(mesh: Bag, yaw: number, lean: number) {
  const root: RGB = [0.18, 0.38, 0.1];
  const mid: RGB = [0.38, 0.6, 0.2];
  const tip: RGB = [0.84, 0.95, 0.55];
  const along = 4;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const ids: number[] = [];
  for (let step = 0; step <= along; step += 1) {
    const v = step / along;
    const width = 0.0048 * (1 - v * 0.7);
    const bow = Math.sin(v * Math.PI) * lean + v * v * lean;
    const color = v < 0.4 ? mix(root, mid, v / 0.4) : mix(mid, tip, (v - 0.4) / 0.6);
    const left = vert(mesh, -width * cosY + bow * sinY, v, width * sinY + bow * cosY, color, 0.35 + v * 0.65);
    const right = vert(mesh, width * cosY + bow * sinY, v, -width * sinY + bow * cosY, color, 0.35 + v * 0.65);
    ids.push(left, right);
  }
  for (let step = 0; step < along; step += 1) {
    const a = ids[step * 2] ?? 0;
    const b = ids[step * 2 + 1] ?? 0;
    const c = ids[(step + 1) * 2] ?? 0;
    const d = ids[(step + 1) * 2 + 1] ?? 0;
    mesh.indices.push(a, c, b, b, c, d);
  }
}

/** Six thin blades in one tuft. Dark at the soil, pale at the tip. */
export function createGrassGeometry(scatter?: Scatter) {
  const mesh = bag();
  const blades = 6;
  for (let blade = 0; blade < blades; blade += 1) {
    const yaw = (blade / blades) * Math.PI + (blade % 2) * 0.18;
    const lean = (0.03 + (blade % 3) * 0.018) * (blade % 2 === 0 ? 1 : -1);
    addCurvedBlade(mesh, yaw, lean);
  }
  return finish(mesh, scatter);
}

function ridge(x: number, phase: number) {
  return (
    Math.sin(x * 0.33 + phase) * 0.26 +
    Math.sin(x * 0.71 + phase * 1.5) * 0.12
  );
}

/** A hill that rises out of the meadow. The foot stays at y=0; the crest rolls in world x. */
function addRollingHill(mesh: Bag, zNear: number, zFar: number, height: number, crest: RGB, phase: number) {
  const columns = 48;
  const rows = 10;
  const ids: number[] = [];
  const foot: RGB = [0.74, 0.86, 0.58];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const lift = Math.pow(Math.sin(v * Math.PI), 0.7);
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const x = (u - 0.5) * 90;
      const y = Math.max(0, height * (0.84 + ridge(x, phase)) * lift);
      const z = zNear + (zFar - zNear) * v + Math.sin(x * 0.31 + phase) * 0.85 * lift;
      const up = Math.min(1, y / Math.max(height, 0.001));
      ids.push(vert(mesh, x, y, z, mix(foot, crest, up), 0));
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = ids[row * stride + column] ?? 0;
      const b = ids[row * stride + column + 1] ?? 0;
      const c = ids[(row + 1) * stride + column] ?? 0;
      const d = ids[(row + 1) * stride + column + 1] ?? 0;
      mesh.indices.push(a, b, c, b, d, c);
    }
  }
}

/** Three ridges. Near one starts in the meadow; far ones fade toward the sky. */
export function createHillsGeometry() {
  const mesh = bag();
  addRollingHill(mesh, -4, -16, 1.8, [0.7, 0.82, 0.5], 0.2);
  addRollingHill(mesh, -16, -30, 2.05, [0.78, 0.86, 0.58], 2.5);
  addRollingHill(mesh, -28, -46, 1.55, [0.86, 0.9, 0.7], 4.4);
  return finish(mesh);
}

/** Dark silhouette. Lighting stays flat so the sides do not read as facets. */
export function createTrunkGeometry() {
  const mesh = bag();
  const bark: RGB = [0.07, 0.11, 0.07];
  const addTube = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number) => {
    const sides = 7;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const uz = dz / length;
    const hx = Math.abs(uy) > 0.9 ? 1 : 0;
    const hy = Math.abs(uy) > 0.9 ? 0 : 1;
    let sx = uy * 0 - uz * hy;
    let sy = uz * hx - ux * 0;
    let sz = ux * hy - uy * hx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl;
    sy /= sl;
    sz /= sl;
    const tx = uy * sz - uz * sy;
    const ty = uz * sx - ux * sz;
    const tz = ux * sy - uy * sx;
    const start = mesh.positions.length / 3;
    for (let level = 0; level < 2; level += 1) {
      const radius = level === 0 ? r0 : r1;
      const px = level === 0 ? x0 : x1;
      const py = level === 0 ? y0 : y1;
      const pz = level === 0 ? z0 : z1;
      for (let i = 0; i < sides; i += 1) {
        const angle = (i / sides) * Math.PI * 2;
        const c = Math.cos(angle) * radius;
        const s = Math.sin(angle) * radius;
        vert(mesh, px + sx * c + tx * s, py + sy * c + ty * s, pz + sz * c + tz * s, bark, 0);
      }
    }
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      const a = start + i;
      const b = start + next;
      const c = start + sides + i;
      const d = start + sides + next;
      mesh.indices.push(a, c, b, b, c, d);
    }
  };
  addTube(0, 0, 0, 0.05, 2.35, 0, 0.11, 0.05);
  addTube(0.02, 1.35, 0, -0.85, 2.55, 0.15, 0.045, 0.02);
  addTube(0.02, 1.7, 0, 0.7, 2.85, -0.1, 0.04, 0.018);
  addTube(-0.4, 2.15, 0.08, -1.15, 3.05, 0.25, 0.028, 0.012);
  return finish(mesh);
}

/** One vertex per glow. The fragment shader paints the flower on the point. */
export function createSparkPoints(scatter: Scatter): BufferGeometry {
  const count = scatter.count;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = scatter.matrices[index * 16 + 12] ?? 0;
    positions[index * 3 + 1] = scatter.matrices[index * 16 + 13] ?? 0;
    positions[index * 3 + 2] = scatter.matrices[index * 16 + 14] ?? 0;
    sizes[index] = scatter.matrices[index * 16] ?? 0.16;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aTint", new Float32BufferAttribute(scatter.colors, 3));
  geometry.setAttribute("aPhase", new Float32BufferAttribute(scatter.phases, 1));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Soft card. The shader draws the blob; the quad itself is never a hard edge. */
export function createCardGeometry(scatter?: Scatter) {
  const geometry = new PlaneGeometry(1, 1);
  const count = geometry.getAttribute("position").count;
  if (scatter && scatter.count > 0) {
    geometry.setAttribute("aPhase", new InstancedBufferAttribute(scatter.phases, 1));
    geometry.setAttribute("aTint", new InstancedBufferAttribute(scatter.colors, 3));
  } else {
    geometry.setAttribute("aPhase", new Float32BufferAttribute(new Float32Array(count), 1));
    const tint = new Float32Array(count * 3);
    tint.fill(1);
    geometry.setAttribute("aTint", new Float32BufferAttribute(tint, 3));
  }
  return geometry;
}
