import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Quality } from "@/components/landing/meadow/quality";
import { countsFor } from "@/components/landing/meadow/quality";

export const FLOWER_CLEAR = 1.15;
export const GRASS_CLEAR = 0.72;
export const TREE_AT: readonly [number, number, number] = [-4.2, 0, -3.2];

export type Scatter = {
  count: number;
  matrices: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
};

type RGB = [number, number, number];

type Item = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  sx: number;
  sy: number;
  sz: number;
  color: RGB;
  phase: number;
};

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const euler = new Euler(0, 0, 0, "YXZ");
const matrix = new Matrix4();

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writeMatrix(target: Float32Array, index: number, item: Item) {
  euler.set(item.pitch, item.yaw, 0, "YXZ");
  quaternion.setFromEuler(euler);
  position.set(item.x, item.y, item.z);
  scale.set(item.sx, item.sy, item.sz);
  matrix.compose(position, quaternion, scale);
  matrix.toArray(target, index * 16);
}

function toScatter(items: Item[]): Scatter {
  const count = items.length;
  const matrices = new Float32Array(count * 16);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  items.forEach((item, index) => {
    writeMatrix(matrices, index, item);
    colors[index * 3] = item.color[0];
    colors[index * 3 + 1] = item.color[1];
    colors[index * 3 + 2] = item.color[2];
    phases[index] = item.phase;
  });
  return { count, matrices, colors, phases };
}

const LUPINS: RGB[] = [
  [0.84, 0.3, 0.28],
  [0.91, 0.72, 0.22],
  [0.5, 0.34, 0.68],
];

function flowerBed(count: number, seed: number, scaleRange: [number, number], tint: (rng: () => number, x: number, z: number) => RGB) {
  const rng = mulberry32(seed);
  const items: Item[] = [];
  let guard = 0;
  while (items.length < count && guard < count * 50) {
    guard += 1;
    const side = rng() < 0.5 ? -1 : 1;
    const near = Math.pow(rng(), 0.85);
    const z = 4.4 - near * 22;
    const gutter = z > 1.6 ? 2.15 : FLOWER_CLEAR;
    const x = side * (gutter + Math.pow(rng(), 0.65) * (z > 1.6 ? 2.8 : 5.4));
    if (Math.abs(x) < FLOWER_CLEAR) continue;
    const size = (scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])) * (1 - near * 0.22);
    items.push({
      x,
      y: 0,
      z,
      yaw: rng() * Math.PI * 2,
      pitch: (rng() - 0.5) * 0.16,
      sx: size,
      sy: size,
      sz: size,
      color: tint(rng, x, z),
      phase: rng() * Math.PI * 2,
    });
  }
  items.sort((a, b) => b.z - a.z);
  return items;
}

export type SceneLayout = {
  grass: Scatter;
  lilies: Scatter;
  daisies: Scatter;
  lupins: Scatter;
  glows: Scatter;
  clouds: Scatter;
};

export function buildLayout(quality: Quality): SceneLayout {
  const counts = countsFor(quality);
  const lilies = flowerBed(counts.lilies, 11, [0.72, 1.18], (rng) => [
    0.97 + rng() * 0.03,
    0.96 + rng() * 0.03,
    0.93 + rng() * 0.05,
  ]);
  const daisies = flowerBed(counts.daisies, 29, [0.55, 0.92], () => [1, 0.99, 0.97]);
  const lupins = flowerBed(counts.lupins, 47, [0.85, 1.35], (rng, x, z) => {
    const band = Math.floor((3.6 - z) / 3.2);
    const hue = LUPINS[Math.abs(band + (x < 0 ? 0 : 1)) % LUPINS.length] ?? LUPINS[0];
    const shade = 0.9 + rng() * 0.15;
    return [hue[0] * shade, hue[1] * shade, hue[2] * shade];
  });
  const glows = lilies.map((lily) => ({
    ...lily,
    y: 0.42 * lily.sy,
    sx: lily.sx * 1.7,
    sy: lily.sy * 1.7,
    sz: 1,
    pitch: 0,
    color: [1, 1, 1] as RGB,
  }));

  const grassRng = mulberry32(101);
  const grass: Item[] = [];
  let guard = 0;
  while (grass.length < counts.grass && guard < counts.grass * 20) {
    guard += 1;
    const z = 4.9 - Math.pow(grassRng(), 1.7) * 28;
    const x = (grassRng() * 2 - 1) * 13;
    if (Math.abs(x) < GRASS_CLEAR) continue;
    const height = 0.62 + grassRng() * 0.7;
    const width = 0.75 + grassRng() * 0.7;
    const green = 0.82 + grassRng() * 0.28;
    grass.push({
      x,
      y: 0,
      z,
      yaw: grassRng() * Math.PI * 2,
      pitch: (grassRng() - 0.35) * 0.35,
      sx: width,
      sy: height,
      sz: width,
      color: [0.72 * green, green, 0.46 * green],
      phase: grassRng() * Math.PI * 2,
    });
  }
  grass.sort((a, b) => b.z - a.z);

  const cloudRng = mulberry32(7);
  const clouds: Item[] = [];
  const anchors: Array<[number, number, number]> = [
    [-7.5, 6.6, -4],
    [6.2, 5.8, -9],
    [-1.5, 7.4, -16],
    [9.5, 6.2, -20],
    [-11, 5.6, -12],
  ];
  for (let i = 0; i < counts.clouds; i += 1) {
    const anchor = anchors[i % anchors.length] ?? anchors[0];
    const puff = 2.2 + cloudRng() * 1.5;
    clouds.push({
      x: anchor[0] + (cloudRng() - 0.5) * 1.4,
      y: anchor[1],
      z: anchor[2],
      yaw: cloudRng() * Math.PI,
      pitch: 0,
      sx: puff,
      sy: puff * 0.58,
      sz: puff * 0.85,
      color: [1, 1, 1],
      phase: cloudRng() * Math.PI * 2,
    });
  }

  return {
    grass: toScatter(grass),
    lilies: toScatter(lilies),
    daisies: toScatter(daisies),
    lupins: toScatter(lupins),
    glows: toScatter(glows),
    clouds: toScatter(clouds),
  };
}
