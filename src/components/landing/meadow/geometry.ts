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
) {
  const across = 2;
  const along = 3;
  const ids: number[] = [];
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  for (let yStep = 0; yStep <= along; yStep += 1) {
    const v = yStep / along;
    const profile = Math.sin(Math.PI * v) * (0.35 + 0.65 * Math.min(1, v / 0.18));
    const half = width * profile;
    for (let xStep = 0; xStep <= across; xStep += 1) {
      const u = (xStep / across) * 2 - 1;
      const x = u * half;
      const py = v * length;
      const cup = (1 - u * u) * 0.06 * Math.sin(Math.PI * v);
      const pz = cup - Math.pow(v, 1.7) * curl;
      const y2 = py * cosP - pz * sinP;
      const z2 = py * sinP + pz * cosP;
      const x3 = x * cosY + z2 * sinY;
      const z3 = -x * sinY + z2 * cosY;
      const throat = v < 0.2 ? mix([1, 0.9, 0.55], base, v / 0.2) : mix(base, tip, (v - 0.2) / 0.8);
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
  const petal: RGB = [0.98, 0.97, 0.94];
  const tip: RGB = [1, 1, 0.98];
  for (let i = 0; i < 6; i += 1) {
    const inner = i % 2 === 1;
    addPetal(
      mesh,
      (i / 6) * Math.PI * 2,
      inner ? 0.42 : 0.78,
      inner ? 0.62 : 0.84,
      inner ? 0.14 : 0.2,
      inner ? 0.22 : 0.48,
      petal,
      tip,
      0.4,
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
  const white: RGB = [1, 1, 1];
  const stemBottom = vert(mesh, -0.012, 0, 0, [0.45, 0.55, 0.28], 0.2);
  const stemTopL = vert(mesh, -0.008, 0.92, 0, [0.62, 0.72, 0.36], 0.45);
  const stemTopR = vert(mesh, 0.008, 0.92, 0, [0.62, 0.72, 0.36], 0.45);
  const stemBaseR = vert(mesh, 0.012, 0, 0, [0.45, 0.55, 0.28], 0.2);
  mesh.indices.push(stemBottom, stemTopL, stemBaseR, stemBaseR, stemTopL, stemTopR);
  const florets = 5;
  for (let floret = 0; floret < florets; floret += 1) {
    const t = floret / (florets - 1);
    const y = 0.22 + t * 0.7;
    const size = 0.16 * (1 - t * 0.55);
    const yaw = floret * 1.2;
    const shade = 0.78 + t * 0.22;
    const color: RGB = [shade, shade, shade];
    for (let petal = 0; petal < 3; petal += 1) {
      addPetal(mesh, yaw + (petal / 3) * Math.PI * 2, 1.15, size, size * 0.42, 0.03, color, white, 0.35, y);
    }
  }
  return finish(mesh, scatter);
}

/** One tapered triangle. Instance scale keeps near blades small. */
export function createGrassGeometry(scatter?: Scatter) {
  const mesh = bag();
  const root: RGB = [0.32, 0.46, 0.18];
  const tip: RGB = [0.72, 0.9, 0.46];
  const left = vert(mesh, -0.016, 0, 0, root, 1);
  const right = vert(mesh, 0.016, 0, 0, root, 1);
  const top = vert(mesh, 0.004, 1, 0.14, tip, 1);
  mesh.indices.push(left, top, right);
  return finish(mesh, scatter);
}

export function createHillsGeometry() {
  const mesh = bag();
  const columns = 24;
  const rows = 6;
  const ids: number[][] = [];
  const near: RGB = [0.72, 0.8, 0.58];
  const far: RGB = [0.93, 0.88, 0.74];
  for (let row = 0; row <= rows; row += 1) {
    const line: number[] = [];
    const v = row / rows;
    const z = -8 - v * 28;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const x = (u - 0.5) * 46;
      const ridge = Math.sin(u * Math.PI * 3.2) * 0.35 * (1 - v);
      const y = -0.15 + ridge * (1 - v * 0.4);
      line.push(vert(mesh, x, y, z, mix(near, far, v), 0));
    }
    ids.push(line);
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = ids[row]?.[column] ?? 0;
      const b = ids[row]?.[column + 1] ?? 0;
      const c = ids[row + 1]?.[column] ?? 0;
      const d = ids[row + 1]?.[column + 1] ?? 0;
      mesh.indices.push(a, c, b, b, c, d);
    }
  }
  return finish(mesh);
}

/** Soft card. The shader draws the blob; the quad itself is never a hard edge. */
export function createCardGeometry(scatter?: Scatter) {
  const geometry = new PlaneGeometry(1, 1);
  if (scatter) {
    geometry.setAttribute("aPhase", new InstancedBufferAttribute(scatter.phases, 1));
  } else {
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("aPhase", new Float32BufferAttribute(new Float32Array(count), 1));
  }
  return geometry;
}
