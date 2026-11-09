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
  const across = 3;
  const along = 5;
  const ids: number[] = [];
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  for (let yStep = 0; yStep <= along; yStep += 1) {
    const v = yStep / along;
    const profile = Math.sin(Math.PI * v) * (0.25 + 0.75 * Math.min(1, v / 0.12));
    const half = width * profile;
    for (let xStep = 0; xStep <= across; xStep += 1) {
      const u = (xStep / across) * 2 - 1;
      const x = u * half;
      const py = v * length;
      const cup = (1 - u * u) * 0.045 * Math.sin(Math.PI * v);
      const pz = cup - Math.pow(v, 2.05) * curl;
      const y2 = py * cosP - pz * sinP;
      const z2 = py * sinP + pz * cosP;
      const x3 = x * cosY + z2 * sinY;
      const z3 = -x * sinY + z2 * cosY;
      const throat = v < 0.22 ? mix([1, 0.86, 0.45], base, v / 0.22) : mix(base, tip, (v - 0.22) / 0.78);
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
  const steps = 9;
  const ring: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push(vert(mesh, Math.cos(angle) * radius, y + 0.02, Math.sin(angle) * radius, color, bend));
  }
  for (let i = 0; i < steps; i += 1) {
    mesh.indices.push(center, ring[i] ?? center, ring[(i + 1) % steps] ?? center);
  }
}

function addStamen(mesh: Bag, yaw: number, color: RGB) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const steps = 4;
  let previousLeft = -1;
  let previousRight = -1;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const py = 0.08 + t * 0.72;
    const pz = 0.04 + Math.sin(t * Math.PI) * 0.16;
    const width = t > 0.78 ? 0.034 : 0.011;
    const filament: RGB = t > 0.78 ? color : [0.78, 0.72, 0.28];
    const left = vert(mesh, (-width) * cosY + pz * sinY, py, -(-width) * sinY + pz * cosY, filament, 0.2);
    const right = vert(mesh, width * cosY + pz * sinY, py, -(width) * sinY + pz * cosY, filament, 0.2);
    if (previousLeft >= 0) {
      mesh.indices.push(previousLeft, left, previousRight, previousRight, left, right);
    }
    previousLeft = left;
    previousRight = right;
  }
}

export function createLilyGeometry(scatter?: Scatter) {
  const mesh = bag();
  for (let petal = 0; petal < 6; petal += 1) {
    const inner = petal % 2 === 1;
    addPetal(
      mesh,
      (petal / 6) * Math.PI * 2,
      inner ? 0.85 : 1.12,
      inner ? 0.92 : 1.08,
      inner ? 0.2 : 0.26,
      inner ? 0.42 : 0.62,
      [0.98, 0.97, 0.94],
      [1, 1, 1],
      0.42,
    );
  }
  for (let stamen = 0; stamen < 6; stamen += 1) {
    addStamen(mesh, (stamen / 6) * Math.PI * 2 + 0.25, [0.72, 0.42, 0.12]);
  }
  addDisc(mesh, 0.06, 0.06, [0.85, 0.78, 0.28], 0.1);
  return finish(mesh, scatter);
}

export function createDaisyGeometry(scatter?: Scatter) {
  const mesh = bag();
  const petals = 8;
  for (let petal = 0; petal < petals; petal += 1) {
    addPetal(
      mesh,
      (petal / petals) * Math.PI * 2,
      1.18,
      0.62,
      0.11,
      0.08,
      [0.99, 0.99, 0.97],
      [1, 1, 1],
      0.3,
    );
  }
  addDisc(mesh, 0.05, 0.16, [0.95, 0.74, 0.18], 0.1);
  addDisc(mesh, 0.07, 0.08, [0.86, 0.58, 0.1], 0.1);
  return finish(mesh, scatter);
}

export function createLupinGeometry(scatter?: Scatter) {
  const mesh = bag();
  const white: RGB = [1, 1, 1];
  const stemBottom = vert(mesh, -0.02, 0, 0, [0.7, 0.75, 0.55], 0.15);
  const stemTopL = vert(mesh, -0.015, 1.15, 0, [0.85, 0.88, 0.7], 0.35);
  const stemTopR = vert(mesh, 0.015, 1.15, 0, [0.85, 0.88, 0.7], 0.35);
  const stemBaseR = vert(mesh, 0.02, 0, 0, [0.7, 0.75, 0.55], 0.15);
  mesh.indices.push(stemBottom, stemTopL, stemBaseR, stemBaseR, stemTopL, stemTopR);
  const florets = 6;
  for (let floret = 0; floret < florets; floret += 1) {
    const t = floret / (florets - 1);
    const y = 0.28 + t * 0.86;
    const size = 0.28 * (1 - t * 0.35);
    const yaw = floret * 1.35;
    const shade = 0.72 + t * 0.28;
    const color: RGB = [shade, shade, shade];
    for (let petal = 0; petal < 3; petal += 1) {
      addPetal(mesh, yaw + (petal / 3) * Math.PI * 2, 1.05, size, size * 0.62, 0.04, color, white, 0.55, y);
    }
  }
  return finish(mesh, scatter);
}

function addBlade(mesh: Bag, yaw: number, lean: number, height: number, width: number) {
  const segments = 2;
  const ids: number[] = [];
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  for (let step = 0; step <= segments; step += 1) {
    const t = step / segments;
    const half = width * (1 - t * 0.9);
    const y = t * height;
    const z = t * t * lean;
    const root: RGB = [0.62, 0.72, 0.48];
    const tip: RGB = [0.92, 1, 0.72];
    const color = mix(root, tip, t);
    const left = vert(mesh, -half * cosY + z * sinY, y, half * sinY + z * cosY, color, 1);
    const right = vert(mesh, half * cosY + z * sinY, y, -half * sinY + z * cosY, color, 1);
    ids.push(left, right);
  }
  for (let step = 0; step < segments; step += 1) {
    const a = ids[step * 2] ?? 0;
    const b = ids[step * 2 + 1] ?? 0;
    const c = ids[(step + 1) * 2] ?? 0;
    const d = ids[(step + 1) * 2 + 1] ?? 0;
    mesh.indices.push(a, c, b, b, c, d);
  }
}

export function createGrassGeometry(scatter?: Scatter) {
  const mesh = bag();
  addBlade(mesh, -0.35, 0.1, 0.72, 0.09);
  addBlade(mesh, 0.28, 0.14, 0.56, 0.075);
  return finish(mesh, scatter);
}

function addSphere(mesh: Bag, cx: number, cy: number, cz: number, radius: number, color: RGB, bend: number) {
  const start = mesh.positions.length / 3;
  const bands = 5;
  const slices = 7;
  for (let j = 0; j <= bands; j += 1) {
    const phi = (j / bands) * Math.PI;
    const y = Math.cos(phi);
    const ring = Math.sin(phi);
    for (let i = 0; i <= slices; i += 1) {
      const theta = (i / slices) * Math.PI * 2;
      vert(
        mesh,
        cx + Math.cos(theta) * ring * radius,
        cy + y * radius,
        cz + Math.sin(theta) * ring * radius,
        color,
        bend,
      );
    }
  }
  const stride = slices + 1;
  for (let j = 0; j < bands; j += 1) {
    for (let i = 0; i < slices; i += 1) {
      const a = start + j * stride + i;
      mesh.indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
}

function addTrunk(mesh: Bag, color: RGB) {
  const sides = 6;
  const start = mesh.positions.length / 3;
  const radii = [0.18, 0.14, 0.1];
  const heights = [0, 0.7, 1.35];
  for (let level = 0; level < heights.length; level += 1) {
    for (let i = 0; i < sides; i += 1) {
      const angle = (i / sides) * Math.PI * 2;
      const radius = radii[level] ?? 0.1;
      vert(mesh, Math.cos(angle) * radius, heights[level] ?? 0, Math.sin(angle) * radius - 0.04, color, 0);
    }
  }
  for (let level = 0; level < heights.length - 1; level += 1) {
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      const a = start + level * sides + i;
      const b = start + level * sides + next;
      const c = start + (level + 1) * sides + i;
      const d = start + (level + 1) * sides + next;
      mesh.indices.push(a, c, b, b, c, d);
    }
  }
}

export function createTreeGeometry() {
  const mesh = bag();
  addTrunk(mesh, [0.45, 0.3, 0.18]);
  const leaves: Array<[number, number, number, number, RGB]> = [
    [0, 1.7, 0.1, 0.85, [0.48, 0.66, 0.28]],
    [-0.55, 1.85, 0.25, 0.62, [0.58, 0.74, 0.34]],
    [0.5, 1.6, -0.15, 0.58, [0.4, 0.58, 0.24]],
    [0.15, 2.15, 0.05, 0.55, [0.66, 0.8, 0.4]],
    [-0.2, 1.45, -0.35, 0.5, [0.36, 0.52, 0.22]],
  ];
  for (const [x, y, z, radius, color] of leaves) {
    addSphere(mesh, x, y, z, radius, color, 0.12);
  }
  return finish(mesh);
}

export function createHillsGeometry() {
  const mesh = bag();
  const columns = 30;
  const rows = 8;
  const ids: number[][] = [];
  for (let row = 0; row <= rows; row += 1) {
    const line: number[] = [];
    const v = row / rows;
    const z = -16 - v * 30;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const x = -34 + u * 68;
      const roll = Math.sin(x * 0.16) * 0.55 + Math.sin(x * 0.05 + 1.7) * 0.45;
      const y = (roll * 0.5 + 0.35) * (0.7 + v * 1.5) - 0.55;
      const lift = 0.78 + v * 0.18;
      const color: RGB = [0.78 * lift, 0.86 * lift, 0.62 * lift];
      const horizon: RGB = [0.957, 0.894, 0.706];
      const blend = y < 0.15 ? 0.55 : y < 0.6 ? 0.22 : 0;
      line.push(vert(mesh, x, y, z, mix(color, horizon, blend), 0));
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

export function createCloudGeometry(scatter: Scatter) {
  const mesh = bag();
  addSphere(mesh, 0, 0, 0, 1, [1, 1, 1], 0);
  return finish(mesh, scatter);
}
