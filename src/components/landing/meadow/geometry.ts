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

/** One lathed bell. A single surface, so the rim cannot break into petals. */
function addBell(mesh: Bag, length: number, radius: number) {
  const around = 16;
  const along = 9;
  const rings: number[][] = [];
  for (let yStep = 0; yStep <= along; yStep += 1) {
    const v = yStep / along;
    const flare = 0.18 + Math.pow(v, 1.45) * 0.82;
    const r = radius * flare;
    const y = length * (0.04 + v * 0.96);
    const ring: number[] = [];
    for (let step = 0; step < around; step += 1) {
      const ang = (step / around) * Math.PI * 2;
      ring.push(vert(mesh, Math.cos(ang) * r, y, Math.sin(ang) * r, [1, 1, 1], 0.04 + v * 0.08));
    }
    rings.push(ring);
  }
  const cap = vert(mesh, 0, length * 0.04, 0, [1, 1, 1], 0.02);
  const first = rings[0] ?? [];
  for (let step = 0; step < around; step += 1) {
    mesh.indices.push(cap, first[step] ?? cap, first[(step + 1) % around] ?? cap);
  }
  for (let yStep = 0; yStep < along; yStep += 1) {
    const lower = rings[yStep] ?? [];
    const upper = rings[yStep + 1] ?? [];
    for (let step = 0; step < around; step += 1) {
      const next = (step + 1) % around;
      const a = lower[step] ?? cap;
      const b = lower[next] ?? cap;
      const c = upper[step] ?? cap;
      const d = upper[next] ?? cap;
      mesh.indices.push(a, b, d, a, d, c);
    }
  }
}

export function createLilyGeometry(scatter?: Scatter) {
  const mesh = bag();
  addBell(mesh, 0.22, 0.09);
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

function addBump(mesh: Bag, x: number, y: number, z: number, radius: number, lit: RGB, dark: RGB, bend: number) {
  const lon = 6;
  const rings = [
    { y: radius * 0.62, r: radius * 0.78, shade: 0.12 },
    { y: radius * 0.16, r: radius, shade: 0.28 },
    { y: -radius * 0.42, r: radius * 0.82, shade: 0.55 },
  ];
  const top = vert(mesh, x, y + radius * 0.92, z, lit, bend);
  const bot = vert(mesh, x, y - radius * 0.86, z, dark, bend);
  const bands = rings.map((ring) => {
    const ids: number[] = [];
    for (let i = 0; i < lon; i += 1) {
      const angle = (i / lon) * Math.PI * 2;
      ids.push(
        vert(
          mesh,
          x + Math.cos(angle) * ring.r,
          y + ring.y,
          z + Math.sin(angle) * ring.r,
          mix(lit, dark, ring.shade),
          bend,
        ),
      );
    }
    return ids;
  });
  const stitch = (above: number[], below: number[]) => {
    for (let i = 0; i < lon; i += 1) {
      const next = (i + 1) % lon;
      const a0 = above[i] ?? top;
      const a1 = above[next] ?? top;
      const b0 = below[i] ?? bot;
      const b1 = below[next] ?? bot;
      mesh.indices.push(a0, a1, b1, a0, b1, b0);
    }
  };
  const upper = bands[0] ?? [];
  const equator = bands[1] ?? [];
  const lower = bands[2] ?? [];
  for (let i = 0; i < lon; i += 1) {
    const next = (i + 1) % lon;
    mesh.indices.push(top, upper[next] ?? top, upper[i] ?? top);
    mesh.indices.push(lower[i] ?? bot, lower[next] ?? bot, bot);
  }
  stitch(upper, equator);
  stitch(equator, lower);
}

/** A tapered spike of little floret bumps, not a smooth cone. */
export function createLupinGeometry(scatter?: Scatter) {
  const mesh = bag();
  const stemBottom = vert(mesh, -0.012, 0, 0, [0.22, 0.36, 0.14], 0.2);
  const stemTopL = vert(mesh, -0.004, 1.05, 0, [0.4, 0.55, 0.22], 0.55);
  const stemTopR = vert(mesh, 0.004, 1.05, 0, [0.4, 0.55, 0.22], 0.55);
  const stemBaseR = vert(mesh, 0.012, 0, 0, [0.22, 0.36, 0.14], 0.2);
  mesh.indices.push(stemBottom, stemTopL, stemBaseR, stemBaseR, stemTopL, stemTopR);
  const florets = 16;
  const lit: RGB = [1, 0.98, 0.93];
  const dark: RGB = [0.62, 0.56, 0.52];
  for (let floret = 0; floret < florets; floret += 1) {
    const t = floret / (florets - 1);
    const y = 0.16 + t * 0.78;
    const radius = 0.04 * (1 - t * 0.4);
    const spin = floret * 2.15;
    const ring = (1 - t) * 0.02;
    addBump(mesh, Math.cos(spin) * ring, y, Math.sin(spin) * ring, radius, lit, dark, 0.16);
  }
  return finish(mesh, scatter);
}

function addBlade(mesh: Bag, ox: number, lean: number) {
  const root: RGB = [0.06, 0.13, 0.04];
  const mid: RGB = [0.22, 0.4, 0.11];
  const tip: RGB = [0.74, 0.9, 0.42];
  const width = 0.016;
  const left = vert(mesh, ox - width, 0, 0, root, 1);
  const right = vert(mesh, ox + width, 0, 0, root, 1);
  const midL = vert(mesh, ox - width * 0.42, 0.4, lean, mid, 1);
  const midR = vert(mesh, ox + width * 0.42, 0.4, lean, mid, 1);
  const top = vert(mesh, ox + lean, 1, lean * 2.4, tip, 1);
  mesh.indices.push(left, midL, right, right, midL, midR, midL, top, midR);
}

/** A facing pair. Dark at the root, pale at the tip, wide enough to read as a tuft. */
export function createGrassGeometry(scatter?: Scatter) {
  const mesh = bag();
  addBlade(mesh, -0.018, -0.035);
  addBlade(mesh, 0.02, 0.04);
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
