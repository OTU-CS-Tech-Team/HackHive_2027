import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
} from "three";
import type { Scatter } from "@/components/landing/meadow/layout";

type RGB = [number, number, number];

type Bag = {
  positions: number[];
  colors: number[];
  bends: number[];
  spans: number[];
  indices: number[];
};

function bag(): Bag {
  return { positions: [], colors: [], bends: [], spans: [], indices: [] };
}

function vert(
  mesh: Bag,
  x: number,
  y: number,
  z: number,
  color: RGB,
  bend: number,
  span: [number, number] = [0, 0.4],
) {
  mesh.positions.push(x, y, z);
  mesh.colors.push(color[0], color[1], color[2]);
  mesh.bends.push(bend);
  mesh.spans.push(span[0], span[1]);
  return mesh.positions.length / 3 - 1;
}

function finish(mesh: Bag, scatter?: Scatter): BufferGeometry {
  const geometry = new BufferGeometry();
  const count = mesh.positions.length / 3;
  geometry.setAttribute("position", new Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(mesh.colors, 3));
  geometry.setAttribute("aBend", new Float32BufferAttribute(mesh.bends, 1));
  geometry.setAttribute("aSpan", new Float32BufferAttribute(mesh.spans, 2));
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
function addLilyPetal(mesh: Bag, yaw: number, across = 6, along = 8) {
  const length = 0.38;
  const width = 0.086;
  const lift = 0.62;
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
      const y = lift + length * (0.04 + v * 0.86) - recurve * 0.22;
      const z = 0.02 + open + channel - recurve;
      const edge = Math.abs(u);
      const warm: RGB = [1, 0.9804, 0.9412];
      const white: RGB = [1, 1, 1];
      const color = mix(warm, white, Math.min(1, v * 0.8 + edge * 0.45));
      row.push(vert(mesh, x * cosY + z * sinY, y, -x * sinY + z * cosY, color, 0.04 + v * 0.2, [u, v]));
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

function addLilyStem(mesh: Bag, steps = 6) {
  const root: RGB = [0.1, 0.32, 0.08];
  const top: RGB = [0.24, 0.48, 0.16];
  let previousLeft = -1;
  let previousRight = -1;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const y = t * 0.64;
    const curve = Math.sin(t * Math.PI) * 0.028;
    const width = 0.028 * (1 - t * 0.22);
    const color = mix(root, top, t);
    const left = vert(mesh, curve - width, y, 0, color, 0.12, [-1, -1]);
    const right = vert(mesh, curve + width, y, 0.002, color, 0.12, [1, -1]);
    if (previousLeft >= 0) {
      mesh.indices.push(previousLeft, left, previousRight, previousRight, left, right);
    }
    previousLeft = left;
    previousRight = right;
  }
}

function addLilyLeaf(mesh: Bag, yaw: number, y0: number) {
  const base: RGB = [0.12, 0.38, 0.1];
  const tip: RGB = [0.36, 0.58, 0.18];
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const across = 3;
  const along = 4;
  const ids: number[] = [];
  for (let yStep = 0; yStep <= along; yStep += 1) {
    const v = yStep / along;
    const half = 0.18 * Math.sin(Math.PI * Math.pow(v, 0.8));
    for (let xStep = 0; xStep <= across; xStep += 1) {
      const u = (xStep / across) * 2 - 1;
      const x = u * half;
      const y = y0 + v * 0.34 - v * v * 0.08;
      const z = 0.016 + v * 0.14 + (1 - u * u) * 0.02;
      ids.push(vert(mesh, x * cosY + z * sinY, y, -x * sinY + z * cosY, mix(base, tip, v), 0.16, [u, -1]));
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

export type FlowerLod = "full" | "speck";
export type LilyDetail = "near" | "mid";

/** A ribbon wide enough to read as a stem once the instance is small on screen. */
function addStemRibbon(mesh: Bag, height: number, width: number) {
  const stem: RGB = [0.2, 0.34, 0.12];
  const stemTip: RGB = [0.42, 0.58, 0.22];
  const steps = 4;
  let previousLeft = -1;
  let previousRight = -1;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const y = t * height;
    const curve = Math.sin(t * Math.PI) * 0.035;
    const half = width * (1 - t * 0.4);
    const color = mix(stem, stemTip, t);
    const left = vert(mesh, curve - half, y, 0, color, 0.35);
    const right = vert(mesh, curve + half, y, 0, color, 0.35);
    if (previousLeft >= 0) {
      mesh.indices.push(previousLeft, left, previousRight, previousRight, left, right);
    }
    previousLeft = left;
    previousRight = right;
  }
}

/** A flat blossom, crossed so it reads from the path and from the side. */
function addCrossBloom(mesh: Bag, ox: number, oy: number, oz: number, radius: number, spikeT: number) {
  const color: RGB = [spikeT, 0, 2];
  const planes: [number, number][] = [
    [1, 0],
    [0, 1],
  ];
  for (const [across, depth] of planes) {
    const center = vert(mesh, ox, oy, oz, color, 0.06);
    const petals = 8;
    const ring: number[] = [];
    for (let i = 0; i < petals; i += 1) {
      const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      ring.push(vert(mesh, ox + dx * across, oy + dy, oz + dx * depth, color, 0.06));
    }
    for (let i = 0; i < petals; i += 1) {
      mesh.indices.push(center, ring[i] ?? center, ring[(i + 1) % petals] ?? center);
    }
  }
}

/**
 * A short spike for the mid and far lupins. Crossed blossoms on a
 * ribbon stem, so a phone sees a flower rather than a floating square.
 * Cheaper than the old 8-floret teardrop, which pays for the stem.
 */
function addVisibleSpike(mesh: Bag, florets: number, height: number, floretSize: number) {
  addStemRibbon(mesh, height, 0.046);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let floret = 0; floret < florets; floret += 1) {
    const t = florets === 1 ? 0.55 : floret / (florets - 1);
    const y = 0.18 + Math.pow(t, 0.9) * (height - 0.22);
    const size = floretSize * (0.7 + 0.3 * (1 - t));
    const yaw = floret * golden;
    const curve = Math.sin(t * Math.PI) * 0.04;
    addCrossBloom(mesh, Math.cos(yaw) * size * 0.15 + curve, y, Math.sin(yaw) * size * 0.15, size, t);
  }
}

/** A tiny bloom on a stem. Far flowers should read as flowers, not dots. */
function addSpeckBloom(mesh: Bag, color: RGB) {
  addStemRibbon(mesh, 0.52, 0.04);
  const center = vert(mesh, 0, 0.54, 0, color, 0.04, [0, 0.35]);
  const petals = 5;
  const ring: number[] = [];
  for (let i = 0; i < petals; i += 1) {
    const angle = (i / petals) * Math.PI * 2;
    ring.push(
      vert(
        mesh,
        Math.cos(angle) * 0.2,
        0.54,
        Math.sin(angle) * 0.2,
        color,
        0.04,
        [Math.cos(angle) * 0.98, 0.4 + Math.sin(angle) * 0.18],
      ),
    );
  }
  for (let i = 0; i < petals; i += 1) {
    mesh.indices.push(center, ring[i] ?? center, ring[(i + 1) % petals] ?? center);
  }
}

function addSpeckLily(mesh: Bag) {
  addSpeckBloom(mesh, [1, 0.98, 0.94]);
}

function addSpeckDaisy(mesh: Bag) {
  addSpeckBloom(mesh, [0.99, 0.94, 0.72]);
}

function addSpeckLupin(mesh: Bag) {
  addVisibleSpike(mesh, 4, 0.82, 0.05);
}

function attachTips(geometry: BufferGeometry, scatter?: Scatter) {
  if (scatter?.tips && scatter.count > 0) {
    geometry.setAttribute("aTip", new InstancedBufferAttribute(scatter.tips, 3));
  } else {
    const count = geometry.getAttribute("position").count;
    const tip = new Float32Array(Math.max(count, 1) * 3);
    tip.fill(1);
    geometry.setAttribute("aTip", new Float32BufferAttribute(tip, 3));
  }
  return geometry;
}

export function createLilyGeometry(scatter?: Scatter, lod: FlowerLod = "full", detail: LilyDetail = "near") {
  const mesh = bag();
  switch (lod) {
    case "speck":
      addSpeckLily(mesh);
      break;
    case "full":
      if (detail === "mid") {
        for (let i = 0; i < 6; i += 1) addLilyPetal(mesh, (i / 6) * Math.PI * 2, 3, 4);
        addDisc(mesh, 0.64, 0.028, [0.84, 0.91, 0.48], 0.02);
        addLilyStem(mesh, 3);
        addLilyLeaf(mesh, 0.7, 0.08);
      } else {
        for (let i = 0; i < 6; i += 1) addLilyPetal(mesh, (i / 6) * Math.PI * 2, 6, 8);
        addDisc(mesh, 0.64, 0.032, [0.84, 0.91, 0.48], 0.02);
        addLilyStem(mesh, 6);
        addLilyLeaf(mesh, 0.7, 0.05);
        addLilyLeaf(mesh, 2.5, 0.1);
      }
      break;
    default: {
      const unknown: never = lod;
      return unknown;
    }
  }
  return finish(mesh, scatter);
}

export function createDaisyGeometry(scatter?: Scatter, lod: FlowerLod = "full", detail: LilyDetail = "near") {
  const mesh = bag();
  switch (lod) {
    case "speck":
      addSpeckDaisy(mesh);
      break;
    case "full": {
      const petals = detail === "mid" ? 5 : 8;
      const across = detail === "mid" ? 2 : 3;
      const along = detail === "mid" ? 3 : 5;
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
          0,
          across,
          along,
        );
      }
      addDisc(mesh, 0.04, 0.12, [0.96, 0.74, 0.16], 0.05);
      addDisc(mesh, 0.06, 0.06, [0.84, 0.55, 0.1], 0.05);
      break;
    }
    default: {
      const unknown: never = lod;
      return unknown;
    }
  }
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
  spikeT: number,
  around: number,
  along: number,
) {
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
    const row: number[] = [];
    for (let side = 0; side < around; side += 1) {
      const angle = (side / around) * Math.PI * 2;
      const [x, y, z] = place(Math.cos(angle) * rad, (v - 0.45) * radius * 1.35, Math.sin(angle) * rad);
      row.push(vert(mesh, x, y, z, [spikeT, 0, 2], 0.06));
    }
    grid.push(row);
  }
  const baseAt = place(0, -0.45 * radius * 1.35, 0);
  const tipAt = place(0, 0.55 * radius * 1.35, 0);
  const floret: RGB = [spikeT, 0, 2];
  const base = vert(mesh, baseAt[0], baseAt[1], baseAt[2], floret, 0.06);
  const tip = vert(mesh, tipAt[0], tipAt[1], tipAt[2], floret, 0.06);
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

export type LupinDensity = "near" | "mid" | "far";

function addLupinSpike(mesh: Bag, florets: number, around: number, along: number) {
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
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let floret = 0; floret < florets; floret += 1) {
    const t = floret / (florets - 1);
    const y = 0.06 + Math.pow(t, 0.82) * 1.02;
    const size = 0.034 * Math.pow(1 - t, 0.4) + 0.015;
    const yaw = floret * golden;
    const tilt = 1.2 - t * 0.55;
    const curve = Math.sin(t * Math.PI) * 0.045;
    const stalk = 0.018 + size * 0.28;
    addTeardrop(mesh, Math.cos(yaw) * stalk + curve, y, Math.sin(yaw) * stalk, size, yaw, tilt, t, around, along);
  }
}

/** One spike: florets spiral up the stem, large and deep at the base, small and pale at the tip. */
export function createLupinGeometry(scatter?: Scatter, lod: FlowerLod = "full", density: LupinDensity = "near") {
  const mesh = bag();
  if (lod === "speck") {
    addSpeckLupin(mesh);
    return attachTips(finish(mesh, scatter), scatter);
  }
  if (lod !== "full") {
    const unknown: never = lod;
    return unknown;
  }
  switch (density) {
    case "near":
      // 22 florets on a 6×3 teardrop. 24 of these is about 43k triangles
      // across the near patch, over the 40k budget.
      addLupinSpike(mesh, 22, 6, 3);
      break;
    case "mid":
      addVisibleSpike(mesh, 7, 1.05, 0.058);
      break;
    case "far":
      addVisibleSpike(mesh, 7, 1.05, 0.058);
      break;
    default: {
      const unknown: never = density;
      return unknown;
    }
  }
  return attachTips(finish(mesh, scatter), scatter);
}

function addCurvedBlade(mesh: Bag, yaw: number, lean: number) {
  const root: RGB = [0.18, 0.38, 0.1];
  const mid: RGB = [0.38, 0.6, 0.2];
  const tip: RGB = [0.62, 0.76, 0.34];
  const along = 4;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const ids: number[] = [];
  for (let step = 0; step <= along; step += 1) {
    const v = step / along;
    const width = 0.016 * (1 - v * 0.72);
    const bow = Math.sin(v * Math.PI) * lean + v * v * lean;
    const color = v < 0.4 ? mix(root, mid, v / 0.4) : mix(mid, tip, (v - 0.4) / 0.6);
    const left = vert(mesh, -width * cosY + bow * sinY, v, width * sinY + bow * cosY, color, 0.35 + v * 0.65, [-1, v]);
    const right = vert(mesh, width * cosY + bow * sinY, v, -width * sinY + bow * cosY, color, 0.35 + v * 0.65, [1, v]);
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
    Math.sin(x * 0.18 + phase) * 0.34 +
    Math.sin(x * 0.46 + phase * 1.3) * 0.16 +
    Math.sin(x * 0.95 + phase * 1.8) * 0.06
  );
}

/** A hill that rises out of the meadow. The foot stays at y=0; the crest rolls in world x. */
function addRollingHill(
  mesh: Bag,
  zNear: number,
  zFar: number,
  height: number,
  crest: RGB,
  foot: RGB,
  phase: number,
  columns: number,
  rows: number,
  saddle: boolean,
) {
  const ids: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const lift = Math.pow(Math.sin(v * Math.PI), 1.05);
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const x = (u - 0.5) * 90;
      const dip = saddle ? Math.exp(-(x * x) / (24 * 24)) : 0;
      const y = Math.max(0, height * (0.84 + ridge(x, phase)) * lift * (1 - dip * 0.22));
      const z = zNear + (zFar - zNear) * v + Math.sin(x * 0.31 + phase) * 0.85 * lift;
      const up = Math.min(1, y / Math.max(height, 0.001));
      ids.push(vert(mesh, x, y, z, mix(foot, crest, up), 0, [up, 0]));
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

/** Four ridges. The near foot stays in the meadow; farther ones are taller and bluer. */
export function createHillsGeometry() {
  const mesh = bag();
  addRollingHill(mesh, -4, -16, 2.35, [0.48, 0.64, 0.34], [0.7, 0.82, 0.52], 0.2, 72, 14, false);
  addRollingHill(mesh, -14, -32, 6.2, [0.58, 0.54, 0.74], [0.7, 0.68, 0.82], 1.7, 56, 12, true);
  addRollingHill(mesh, -30, -50, 8.6, [0.42, 0.6, 0.84], [0.62, 0.74, 0.9], 3.4, 48, 12, true);
  addRollingHill(mesh, -48, -68, 10.2, [0.66, 0.78, 0.9], [0.78, 0.84, 0.94], 5.1, 44, 10, true);
  return finish(mesh);
}

function tubeFrame(tx: number, ty: number, tz: number) {
  const ax = Math.abs(ty) > 0.85 ? 1 : 0;
  const ay = Math.abs(ty) > 0.85 ? 0 : 1;
  let sx = ty * 0 - tz * ay;
  let sy = tz * ax - tx * 0;
  let sz = tx * ay - ty * ax;
  const sl = Math.hypot(sx, sy, sz) || 1;
  sx /= sl;
  sy /= sl;
  sz /= sl;
  return {
    sx,
    sy,
    sz,
    bx: ty * sz - tz * sy,
    by: tz * sx - tx * sz,
    bz: tx * sy - ty * sx,
  };
}

/** A dark forked trunk that meets the grass. One draw, no ground disc. */
export function createTrunkGeometry() {
  const mesh = bag();
  const dark: RGB = [0.29, 0.173, 0.102];
  const warm: RGB = [0.42, 0.227, 0.133];
  const addCurve = (points: { x: number; y: number; z: number; r: number }[]) => {
    const sides = 12;
    const rings: number[][] = [];
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const next = points[Math.min(points.length - 1, i + 1)];
      const prev = points[Math.max(0, i - 1)];
      if (!point || !next || !prev) continue;
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      let tz = next.z - prev.z;
      const len = Math.hypot(tx, ty, tz) || 1;
      tx /= len;
      ty /= len;
      tz /= len;
      const frame = tubeFrame(tx, ty, tz);
      const shade = i / Math.max(1, points.length - 1);
      const color = mix(dark, warm, shade);
      const ring: number[] = [];
      for (let s = 0; s < sides; s += 1) {
        const angle = (s / sides) * Math.PI * 2;
        const c = Math.cos(angle) * point.r;
        const sn = Math.sin(angle) * point.r;
        ring.push(
          vert(
            mesh,
            point.x + frame.sx * c + frame.bx * sn,
            point.y + frame.sy * c + frame.by * sn,
            point.z + frame.sz * c + frame.bz * sn,
            color,
            0,
          ),
        );
      }
      rings.push(ring);
    }
    for (let i = 0; i < rings.length - 1; i += 1) {
      const a = rings[i];
      const b = rings[i + 1];
      if (!a || !b) continue;
      for (let s = 0; s < sides; s += 1) {
        const n = (s + 1) % sides;
        const a0 = a[s] ?? 0;
        const a1 = a[n] ?? 0;
        const b0 = b[s] ?? 0;
        const b1 = b[n] ?? 0;
        mesh.indices.push(a0, b0, a1, a1, b0, b1);
      }
    }
  };
  const trunk = [
    { x: 0, y: 0.01, z: 0, r: 0.26 },
    { x: 0.01, y: 0.1, z: 0.01, r: 0.18 },
    { x: 0.03, y: 0.32, z: 0.01, r: 0.13 },
    { x: 0.04, y: 0.58, z: 0, r: 0.1 },
    { x: 0.02, y: 0.86, z: -0.01, r: 0.072 },
    { x: 0, y: 1.12, z: 0.01, r: 0.046 },
    { x: -0.02, y: 1.34, z: 0, r: 0.026 },
  ];
  // Tips end inside the blossom mass. The limbs stay thick enough to read
  // from the path, then disappear into the crown.
  const left = [
    { x: 0.02, y: 0.72, z: 0.01, r: 0.048 },
    { x: -0.16, y: 0.98, z: 0.08, r: 0.032 },
    { x: -0.38, y: 1.26, z: 0.1, r: 0.018 },
  ];
  const right = [
    { x: 0.03, y: 0.68, z: 0, r: 0.046 },
    { x: 0.22, y: 0.96, z: -0.06, r: 0.03 },
    { x: 0.42, y: 1.24, z: -0.08, r: 0.016 },
  ];
  const front = [
    { x: 0.01, y: 0.64, z: 0.02, r: 0.04 },
    { x: -0.06, y: 0.92, z: 0.18, r: 0.026 },
    { x: -0.1, y: 1.2, z: 0.32, r: 0.014 },
  ];
  const back = [
    { x: 0.02, y: 0.6, z: 0, r: 0.036 },
    { x: 0.08, y: 0.9, z: -0.18, r: 0.022 },
    { x: 0.1, y: 1.18, z: -0.32, r: 0.012 },
  ];
  const high = [
    { x: 0, y: 0.98, z: 0.01, r: 0.032 },
    { x: -0.2, y: 1.22, z: -0.04, r: 0.018 },
    { x: -0.32, y: 1.42, z: 0.04, r: 0.01 },
  ];
  addCurve(trunk);
  addCurve(left);
  addCurve(right);
  addCurve(front);
  addCurve(back);
  addCurve(high);
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

export type CardKind = "blossom" | "cloud" | "glow";

/**
 * A polygon tight to the painted shape. UVs stay in the old unit-quad space
 * so the shader's blob does not scale up to the cropped edge.
 */
function cardPolygon(kind: CardKind) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const push = (x: number, y: number) => {
    positions.push(x, y, 0);
    uvs.push(x + 0.5, y + 0.5);
  };
  const fan = (steps: number) => {
    for (let i = 0; i < steps; i += 1) indices.push(0, 1 + i, 1 + ((i + 1) % steps));
  };
  switch (kind) {
    case "cloud": {
      const steps = 12;
      push(0, -0.02);
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        push(Math.cos(angle) * 0.48, Math.sin(angle) * 0.34 - 0.02);
      }
      fan(steps);
      break;
    }
    case "glow":
    case "blossom": {
      const radius = kind === "glow" ? 0.46 : 0.4;
      const steps = 8;
      push(0, 0);
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2 + Math.PI / 8;
        push(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      fan(steps);
      break;
    }
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
  return { positions, uvs, indices };
}

/** Cropped card. Empty corners of the old quad are not rasterized. */
export function createCardGeometry(scatter?: Scatter, kind: CardKind = "blossom") {
  const polygon = cardPolygon(kind);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(polygon.positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(polygon.uvs, 2));
  geometry.setIndex(polygon.indices);
  const count = polygon.positions.length / 3;
  if (scatter && scatter.count > 0) {
    geometry.setAttribute("aPhase", new InstancedBufferAttribute(scatter.phases, 1));
    geometry.setAttribute("aTint", new InstancedBufferAttribute(scatter.colors, 3));
  } else {
    geometry.setAttribute("aPhase", new Float32BufferAttribute(new Float32Array(count), 1));
    const tint = new Float32Array(count * 3);
    tint.fill(1);
    geometry.setAttribute("aTint", new Float32BufferAttribute(tint, 3));
  }
  geometry.computeBoundingSphere();
  return geometry;
}
