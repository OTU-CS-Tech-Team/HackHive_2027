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

function addStamen(mesh: Bag, yaw: number, color: RGB) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const steps = 3;
  let previousLeft = -1;
  let previousRight = -1;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const py = 0.05 + t * 0.42;
    const pz = 0.02 + Math.sin(t * Math.PI) * 0.08;
    const width = t > 0.72 ? 0.028 : 0.008;
    const filament: RGB = t > 0.72 ? color : [0.86, 0.78, 0.32];
    const left = vert(mesh, -width * cosY + pz * sinY, py, width * sinY + pz * cosY, filament, 0.15);
    const right = vert(mesh, width * cosY + pz * sinY, py, -width * sinY + pz * cosY, filament, 0.15);
    if (previousLeft >= 0) {
      mesh.indices.push(previousLeft, left, previousRight, previousRight, left, right);
    }
    previousLeft = left;
    previousRight = right;
  }
}

export function createLilyGeometry(scatter?: Scatter) {
  const mesh = bag();
  const petal: RGB = [0.9, 0.9, 0.82];
  const tip: RGB = [1, 1, 0.97];
  for (let i = 0; i < 6; i += 1) {
    const inner = i % 2 === 1;
    addPetal(
      mesh,
      (i / 6) * Math.PI * 2 + (inner ? 0.18 : 0),
      inner ? 0.7 : 1.15,
      inner ? 0.38 : 0.52,
      inner ? 0.13 : 0.18,
      inner ? 0.42 : 0.78,
      petal,
      tip,
      0.45,
    );
  }
  for (let i = 0; i < 5; i += 1) {
    addStamen(mesh, (i / 5) * Math.PI * 2, [0.78, 0.42, 0.12]);
  }
  addDisc(mesh, 0.04, 0.05, [0.9, 0.78, 0.28], 0.05);
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

export function createLupinGeometry(scatter?: Scatter) {
  const mesh = bag();
  const white: RGB = [1, 0.98, 0.94];
  const stemBottom = vert(mesh, -0.008, 0, 0, [0.28, 0.4, 0.16], 0.15);
  const stemTopL = vert(mesh, -0.004, 1.02, 0, [0.5, 0.62, 0.28], 0.55);
  const stemTopR = vert(mesh, 0.004, 1.02, 0, [0.5, 0.62, 0.28], 0.55);
  const stemBaseR = vert(mesh, 0.008, 0, 0, [0.28, 0.4, 0.16], 0.15);
  mesh.indices.push(stemBottom, stemTopL, stemBaseR, stemBaseR, stemTopL, stemTopR);
  const florets = 12;
  for (let floret = 0; floret < florets; floret += 1) {
    const t = floret / (florets - 1);
    const y = 0.16 + t * 0.82;
    const size = 0.105 * (1 - t * 0.78);
    const yaw = floret * 0.9;
    const shade = 0.55 + t * 0.45;
    const color: RGB = [shade, shade * 0.96, shade];
    for (let petal = 0; petal < 4; petal += 1) {
      addPetal(
        mesh,
        yaw + (petal / 4) * Math.PI * 2,
        1.25,
        size,
        size * 0.62,
        0.12,
        color,
        white,
        0.2,
        y,
        2,
        2,
      );
    }
  }
  return finish(mesh, scatter);
}

/** Two triangles. Dark at the root, pale at the tip. */
export function createGrassGeometry(scatter?: Scatter) {
  const mesh = bag();
  const root: RGB = [0.08, 0.16, 0.05];
  const mid: RGB = [0.28, 0.46, 0.14];
  const tip: RGB = [0.84, 0.95, 0.5];
  const left = vert(mesh, -0.014, 0, 0, root, 1);
  const right = vert(mesh, 0.014, 0, 0, root, 1);
  const midL = vert(mesh, -0.008, 0.42, 0.04, mid, 1);
  const midR = vert(mesh, 0.008, 0.42, 0.04, mid, 1);
  const top = vert(mesh, 0.002, 1, 0.16, tip, 1);
  mesh.indices.push(left, midL, right, right, midL, midR, midL, top, midR);
  return finish(mesh, scatter);
}

function addRidge(
  mesh: Bag,
  z: number,
  height: number,
  dip: number,
  base: RGB,
  crest: RGB,
) {
  const columns = 32;
  const ids: number[] = [];
  for (let column = 0; column <= columns; column += 1) {
    const u = column / columns;
    const x = (u - 0.5) * 70;
    const wave = 0.78 + 0.22 * Math.sin(u * Math.PI * 5 + z * 0.15);
    const edge = Math.abs(u - 0.5) * 2;
    const peak = height * wave * Math.pow(edge, 1.7) * dip - 0.35;
    const crestMix = Math.min(1, Math.pow(edge, 1.35));
    ids.push(vert(mesh, x, -0.8, z, base, 0));
    ids.push(vert(mesh, x, peak, z, mix(base, crest, crestMix), 0));
  }
  for (let column = 0; column < columns; column += 1) {
    const a = ids[column * 2] ?? 0;
    const b = ids[column * 2 + 1] ?? 0;
    const c = ids[column * 2 + 2] ?? 0;
    const d = ids[column * 2 + 3] ?? 0;
    mesh.indices.push(a, b, c, c, b, d);
  }
}

/** Layered silhouettes. Centre stays low so the wordmark keeps sky; the sides rise. */
export function createHillsGeometry() {
  const mesh = bag();
  const far: RGB = [0.91, 0.95, 0.77];
  const mid: RGB = [0.62, 0.78, 0.4];
  const near: RGB = [0.22, 0.48, 0.26];
  const treeline: RGB = [0.04, 0.14, 0.1];
  addRidge(mesh, -26, 3.4, 1, far, mid);
  addRidge(mesh, -15, 4.4, 1, mid, near);
  addRidge(mesh, -8.5, 5.2, 1, near, treeline);
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
