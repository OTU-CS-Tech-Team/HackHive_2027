import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
} from "three";
import type { Scatter } from "@/components/landing/meadow/layout";
import { TREE_LIMBS, TREE_TRUNK } from "@/components/landing/meadow/tree";

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
    const width = 0.014 * (1 - t * 0.3);
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

const LILY_LEAF = { root: [0.1, 0.3, 0.08] as RGB, mid: [0.2, 0.46, 0.12] as RGB, tip: [0.4, 0.62, 0.22] as RGB };

/** A long strap leaf that arches out from the foot and tapers to a point. */
function addLilyLeaf(mesh: Bag, yaw: number, y0: number) {
  addArchingBlade(mesh, 0, 0.01 + y0 * 0.1, yaw, 0.46, 0.05, 0.35, 1.25, LILY_LEAF, 0.16, 5, true);
}

export type FlowerLod = "full" | "speck";
export type LilyDetail = "near" | "mid";

/** A slim stem that narrows toward the bloom. */
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
    const half = width * (1 - t * 0.55);
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
const SPIKE_LEAVES = [
  { root: [0.12, 0.3, 0.08] as RGB, mid: [0.26, 0.5, 0.15] as RGB, tip: [0.5, 0.7, 0.28] as RGB },
  { root: [0.1, 0.27, 0.1] as RGB, mid: [0.22, 0.44, 0.16] as RGB, tip: [0.42, 0.64, 0.26] as RGB },
];

function addVisibleSpike(mesh: Bag, florets: number, height: number, floretSize: number, leaves = 0, stem = 0.017) {
  addStemRibbon(mesh, height, stem);
  // A few arching leaves at the foot, so the spike rises out of a clump.
  for (let leaf = 0; leaf < leaves; leaf += 1) {
    const yaw = (leaf / leaves) * Math.PI * 2 + 0.4;
    const shade = SPIKE_LEAVES[leaf % SPIKE_LEAVES.length] ?? SPIKE_LEAVES[0];
    if (!shade) continue;
    addArchingBlade(mesh, 0, 0, yaw, 0.34 + (leaf % 2) * 0.08, 0.034, 0.3, 1.1, shade, 0.2, 4);
  }
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
  addStemRibbon(mesh, 0.52, 0.026);
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
  // Far away a hair-thin stem would flicker, so the speck keeps a little more.
  addVisibleSpike(mesh, 4, 0.82, 0.05, 0, 0.028);
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
      addVisibleSpike(mesh, 7, 1.05, 0.058, 4);
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

/** Greens for a blade, from the soil to the tip. A few shades so a tuft is not one flat colour. */
const BLADE_SHADES: { root: RGB; mid: RGB; tip: RGB }[] = [
  { root: [0.12, 0.3, 0.08], mid: [0.3, 0.54, 0.16], tip: [0.58, 0.76, 0.3] },
  { root: [0.1, 0.27, 0.09], mid: [0.24, 0.48, 0.17], tip: [0.46, 0.68, 0.28] },
  { root: [0.15, 0.33, 0.07], mid: [0.38, 0.6, 0.18], tip: [0.7, 0.82, 0.38] },
  { root: [0.11, 0.29, 0.11], mid: [0.27, 0.52, 0.22], tip: [0.52, 0.74, 0.36] },
];

/**
 * A slim blade that tapers to a point and arches over. It grows from
 * `foot`, leans out along `yaw`, and curls further as it climbs, so the
 * tip droops past the base instead of standing as a strip. aSpan.x runs
 * across (-1..1), aSpan.y along (0..1), so the cutout keeps the point.
 */
function addArchingBlade(
  mesh: Bag,
  footX: number,
  footZ: number,
  yaw: number,
  height: number,
  width: number,
  tilt: number,
  curl: number,
  shade: { root: RGB; mid: RGB; tip: RGB },
  bendBase = 0.3,
  along = 5,
  foliage = false,
) {
  const outX = Math.sin(yaw);
  const outZ = Math.cos(yaw);
  // Width runs across the lean, so the flat of the blade faces its arch.
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const ds = height / along;
  let px = 0;
  let py = 0;
  let previousLeft = -1;
  let previousRight = -1;
  for (let step = 0; step <= along; step += 1) {
    const v = step / along;
    if (step > 0) {
      const angle = tilt + curl * Math.pow((step - 0.5) / along, 1.4);
      px += Math.sin(angle) * ds;
      py += Math.cos(angle) * ds;
    }
    // Full width low on the blade, narrowing to a point at the tip.
    const half = width * Math.pow(1 - v, 0.8) * (0.75 + 0.25 * Math.sin(Math.min(1, v * 3) * Math.PI * 0.5));
    const color = v < 0.45 ? mix(shade.root, shade.mid, v / 0.45) : mix(shade.mid, shade.tip, (v - 0.45) / 0.55);
    const cx = footX + outX * px;
    const cz = footZ + outZ * px;
    const bend = bendBase + v * (1 - bendBase);
    // Lily foliage marks its span below zero, so the petal shading skips it.
    const spanY = foliage ? -1 : v;
    const left = vert(mesh, cx - sideX * half, py, cz - sideZ * half, color, bend, [-1, spanY]);
    const right = vert(mesh, cx + sideX * half, py, cz + sideZ * half, color, bend, [1, spanY]);
    if (previousLeft >= 0) {
      mesh.indices.push(previousLeft, left, previousRight, previousRight, left, right);
    }
    previousLeft = left;
    previousRight = right;
  }
}

/**
 * One clump: nine slim blades from a small footprint, a few tall ones
 * arching over shorter ones, in four greens. Local height is about 1;
 * the instance scale sets the real height.
 */
export function createGrassGeometry(scatter?: Scatter) {
  const mesh = bag();
  const blades = 9;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let blade = 0; blade < blades; blade += 1) {
    const t = blade / blades;
    const yaw = blade * golden * 1.7 + 0.3;
    const ring = 0.03 + (blade % 3) * 0.03;
    const footX = Math.sin(yaw * 1.3) * ring;
    const footZ = Math.cos(yaw * 1.3) * ring;
    const tall = blade % 3 === 0;
    const height = tall ? 1.0 - t * 0.12 : 0.62 + ((blade * 7) % 5) * 0.06;
    const tilt = 0.1 + (blade % 4) * 0.07;
    const curl = tall ? 1.15 + (blade % 2) * 0.35 : 0.55 + (blade % 3) * 0.2;
    const shade = BLADE_SHADES[blade % BLADE_SHADES.length] ?? BLADE_SHADES[0];
    if (!shade) continue;
    addArchingBlade(mesh, footX, footZ, yaw, height, 0.058, tilt, curl, shade, 0.3, tall ? 5 : 4);
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
type RollingHill = {
  zNear: number;
  zFar: number;
  height: number;
  crest: RGB;
  foot: RGB;
  phase: number;
  /** 0 front, 1 middle, 2 back. The shader hazes each step back. */
  depth: number;
};

function hillLift(v: number) {
  return Math.pow(Math.sin(v * Math.PI), 1.05);
}

function hillY(hill: RollingHill, x: number, v: number) {
  return Math.max(0, hill.height * (0.84 + ridge(x, hill.phase)) * hillLift(v));
}

/**
 * A coarse grid with jittered points, so the hill reads low-poly like the
 * ranges and its facets turn toward or away from the sun. aSpan.y is minus
 * the hill's depth, which tells the shader it is a hill and how far back.
 */
function addRollingHill(mesh: Bag, hill: RollingHill, columns: number, rows: number) {
  const ids: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const lift = hillLift(v);
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const edge = row === 0 || row === rows;
      const wobble = edge ? 0 : (hash1(row * 53 + column * 11 + hill.phase * 7) - 0.5) * 0.9;
      const x = (u - 0.5) * 90 + wobble;
      const bump = edge ? 0 : (hash1(row * 17 + column * 29 + hill.phase * 3) - 0.5) * 0.12 * hill.height * lift;
      const y = Math.max(0, hillY(hill, x, v) + bump);
      const z = hill.zNear + (hill.zFar - hill.zNear) * v + Math.sin(x * 0.31 + hill.phase) * 0.85 * lift;
      const up = Math.min(1, y / Math.max(hill.height, 0.001));
      ids.push(vert(mesh, x, y, z, mix(hill.foot, hill.crest, up), 0, [up, -hill.depth]));
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = ids[row * stride + column] ?? 0;
      const b = ids[row * stride + column + 1] ?? 0;
      const c = ids[(row + 1) * stride + column] ?? 0;
      const d = ids[(row + 1) * stride + column + 1] ?? 0;
      if ((row + column) % 2 === 0) mesh.indices.push(a, b, c, b, d, c);
      else mesh.indices.push(a, b, d, a, d, c);
    }
  }
}

/** A five-sided low-poly cone (a fir) or a squat one (a bush). aSpan.y = 5 marks it. */
function addShrub(mesh: Bag, x: number, y: number, z: number, height: number, radius: number, color: RGB, seed: number) {
  const sides = 5;
  const turn = hash1(seed) * Math.PI * 2;
  const base: number[] = [];
  const dark = mix(color, [0.12, 0.2, 0.16], 0.25);
  for (let i = 0; i < sides; i += 1) {
    const angle = turn + (i / sides) * Math.PI * 2;
    const r = radius * (0.85 + hash1(seed + i * 3.1) * 0.3);
    base.push(vert(mesh, x + Math.cos(angle) * r, y - 0.08, z + Math.sin(angle) * r, dark, 0, [0, 5]));
  }
  const tip = vert(mesh, x + (hash1(seed + 9) - 0.5) * radius * 0.3, y + height, z, color, 0, [1, 5]);
  for (let i = 0; i < sides; i += 1) {
    mesh.indices.push(base[i] ?? 0, base[(i + 1) % sides] ?? 0, tip);
  }
}

/**
 * Small firs and bushes in loose clumps along the crests, so the hills
 * read as land and tie back to the planted meadow. None stand behind the
 * copy on a wide frame (left of x -3 on the near hills).
 */
function plantHills(mesh: Bag, hills: RollingHill[]) {
  const clumps: [hillIndex: number, x: number, v: number, count: number][] = [
    [2, -14.5, 0.46, 3],
    [2, 3.5, 0.5, 4],
    [2, 7.5, 0.44, 3],
    [2, 15, 0.5, 4],
    [1, 2.5, 0.42, 3],
    [1, 10.5, 0.48, 4],
    [1, 18, 0.4, 3],
    [1, -16, 0.44, 3],
    [0, 13.5, 0.36, 3],
    [0, -12.5, 0.4, 2],
  ];
  const firs: RGB[] = [[0.2, 0.38, 0.24], [0.24, 0.42, 0.26], [0.18, 0.34, 0.24]];
  const bushes: RGB[] = [[0.34, 0.5, 0.26], [0.4, 0.54, 0.28]];
  clumps.forEach(([index, cx, cv, count], clump) => {
    const hill = hills[index];
    if (!hill) return;
    const scale = 1 - hill.depth * 0.14;
    for (let i = 0; i < count; i += 1) {
      const seed = clump * 31 + i * 7.3;
      const x = cx + (i - (count - 1) / 2) * 0.55 + (hash1(seed) - 0.5) * 0.4;
      const v = Math.min(0.9, Math.max(0.1, cv + (hash1(seed + 1) - 0.5) * 0.14));
      const lift = hillLift(v);
      const y = hillY(hill, x, v);
      const z = hill.zNear + (hill.zFar - hill.zNear) * v + Math.sin(x * 0.31 + hill.phase) * 0.85 * lift;
      const fir = hash1(seed + 2) > 0.3;
      if (fir) {
        const h = (0.55 + hash1(seed + 3) * 0.35) * scale;
        addShrub(mesh, x, y, z, h, h * 0.3, firs[i % firs.length] ?? [0.2, 0.38, 0.24], seed);
      } else {
        const h = (0.24 + hash1(seed + 4) * 0.1) * scale;
        addShrub(mesh, x, y, z, h, h * 0.95, bushes[i % bushes.length] ?? [0.34, 0.5, 0.26], seed);
      }
    }
  });
}

function hash1(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** [x, height 0..1, half width] of one peak along a range. */
type Peak = readonly [number, number, number];

/**
 * Crest height (0..1) at x: the tallest peak over x, with slightly concave
 * flanks so tops come to a point, and a shoulder line so a range never
 * drops to the meadow between peaks. A per-column notch keeps the ridge jagged.
 */
function crestAt(x: number, column: number, peaks: readonly Peak[], seed: number, sharp: number) {
  let crest = 0.26 + Math.abs(Math.sin(x * 0.21 + seed)) * 0.1;
  for (const [px, ph, pw] of peaks) {
    const t = 1 - Math.abs(x - px) / pw;
    if (t > 0) crest = Math.max(crest, ph * Math.pow(t, sharp));
  }
  const notch = (hash1(column * 1.7 + seed * 13) - 0.5) * 0.085;
  const knuckle = Math.abs(Math.sin(x * 0.83 + seed * 2.1)) * 0.045;
  return Math.max(0.12, crest + notch * crest + knuckle - 0.02);
}

/**
 * A low-poly mountain range. A coarse grid with jittered vertices, so the
 * shader's flat normals catch the sun on one face and shade the next.
 * aSpan.x is height over the range's peak (snow reads it); aSpan.y is the
 * layer (1 near, 2 mid, 3 far), which sets snow and haze.
 */
function addRange(
  mesh: Bag,
  zNear: number,
  zFar: number,
  height: number,
  width: number,
  crest: RGB,
  foot: RGB,
  peaks: readonly Peak[],
  seed: number,
  layer: number,
  columns: number,
  rows: number,
) {
  const ids: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    // Steeper front face than the dome the hills use, so the crest reads as a ridge.
    const lift = Math.pow(Math.sin(v * Math.PI), 0.85);
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const edge = row === 0 || row === rows;
      const wobble = edge ? 0 : (hash1(row * 97 + column * 13 + seed) - 0.5) * 0.7;
      const x = (u - 0.5) * width + wobble;
      const top = crestAt(x, column, peaks, seed, layer === 1 ? 1.55 : 1.3);
      const jitter = edge ? 0 : (hash1(row * 31 + column * 7 + seed * 5) - 0.5) * 0.14 * lift;
      const y = Math.max(0, height * (top * lift + jitter * top));
      const z = zNear + (zFar - zNear) * v + Math.sin(x * 0.27 + seed) * 0.9 * lift;
      const up = Math.min(1, y / Math.max(height, 0.001));
      ids.push(vert(mesh, x, y, z, mix(foot, crest, Math.min(1, up / Math.max(top, 0.3))), 0, [up, layer]));
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = ids[row * stride + column] ?? 0;
      const b = ids[row * stride + column + 1] ?? 0;
      const c = ids[(row + 1) * stride + column] ?? 0;
      const d = ids[(row + 1) * stride + column + 1] ?? 0;
      // Alternate the diagonal so facets don't all lean one way.
      if ((row + column) % 2 === 0) mesh.indices.push(a, b, c, b, d, c);
      else mesh.indices.push(a, b, d, a, d, c);
    }
  }
}

const NEAR_PEAKS: readonly Peak[] = [
  [-34, 0.64, 8],
  [-21, 0.92, 9],
  [-9, 0.62, 7],
  [4, 0.68, 5.5],
  [14, 0.56, 6],
  [24.5, 0.72, 7.5],
  [37, 0.68, 8],
];

const MID_PEAKS: readonly Peak[] = [
  [-46, 0.82, 11],
  [-31, 0.64, 8],
  [-15, 1.0, 11],
  [-1, 0.74, 8],
  [12, 0.94, 10],
  [29, 0.7, 9],
  [44, 0.9, 10],
];

const FAR_PEAKS: readonly Peak[] = [
  [-60, 0.8, 13],
  [-34, 0.88, 12],
  [-22, 0.72, 10],
  [-5, 0.96, 12],
  [15, 0.78, 10],
  [34, 1.0, 14],
  [56, 0.84, 13],
];

/**
 * The near green hill, then three ranges. Near ranges are deep and
 * saturated; each one back is paler and bluer, and the two far ones carry snow.
 */
export function createHillsGeometry() {
  const mesh = bag();
  // Three rolling hills, each a step back lighter and hazier, set low
  // enough that the ranges show over them.
  const hills: RollingHill[] = [
    { zNear: -11, zFar: -21, height: 2.2, crest: [0.56, 0.7, 0.44], foot: [0.68, 0.8, 0.56], phase: 2.6, depth: 2 },
    { zNear: -7, zFar: -15, height: 1.7, crest: [0.47, 0.64, 0.33], foot: [0.62, 0.77, 0.47], phase: 4.1, depth: 1 },
    { zNear: -4, zFar: -10.5, height: 1.15, crest: [0.4, 0.6, 0.28], foot: [0.6, 0.76, 0.44], phase: 0.2, depth: 0 },
  ];
  hills.forEach((hill) => addRollingHill(mesh, hill, 46, 7));
  plantHills(mesh, hills);
  addRange(mesh, -14, -32, 8.2, 96, [0.42, 0.4, 0.64], [0.6, 0.6, 0.77], NEAR_PEAKS, 1.7, 1, 60, 8);
  addRange(mesh, -30, -50, 12.4, 112, [0.36, 0.5, 0.78], [0.62, 0.72, 0.9], MID_PEAKS, 3.4, 2, 64, 8);
  addRange(mesh, -48, -68, 15.4, 140, [0.62, 0.72, 0.9], [0.8, 0.86, 0.95], FAR_PEAKS, 5.1, 3, 70, 7);
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

/** A dark trunk whose limbs reach into the crown. One draw, no ground disc. */
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
  // Limbs run up into the crown. The blossom layout hangs clusters on
  // the same points, so the bark and the cloud read as one tree.
  addCurve(TREE_TRUNK);
  for (const limb of TREE_LIMBS) addCurve(limb);
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
      // A band from just under the flat base to over the tallest lump.
      push(-0.5, -0.15);
      push(0.5, -0.15);
      push(0.5, 0.42);
      push(-0.5, 0.42);
      indices.push(0, 1, 2, 0, 2, 3);
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
