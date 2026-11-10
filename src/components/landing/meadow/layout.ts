import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Quality } from "@/components/landing/meadow/quality";
import { countsFor } from "@/components/landing/meadow/quality";

/** Flowers stay off the calm centre. Grass may grow closer to the path edge. */
export const FLOWER_CLEAR = 1.12;
export const GRASS_CLEAR = 0.84;
export const PATCH_BANDS = [2.4, -3.2] as const;

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

function shuffle(items: Item[], seed: number) {
  const rng = mulberry32(seed);
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = items[i];
    items[i] = items[j] ?? swap;
    items[j] = swap ?? items[j];
  }
  return items;
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

function emptyScatter(): Scatter {
  return { count: 0, matrices: new Float32Array(), colors: new Float32Array(), phases: new Float32Array() };
}

/** Prefix of a shuffled scatter is an even sample, not the nearest instances. */
export function splitPatches(items: Item[], seed: number): Scatter[] {
  const bins: Item[][] = [[], [], []];
  for (const item of items) {
    const band = item.z > PATCH_BANDS[0] ? 0 : item.z > PATCH_BANDS[1] ? 1 : 2;
    bins[band]?.push(item);
  }
  return bins.map((bin, index) => (bin.length === 0 ? emptyScatter() : toScatter(shuffle(bin, seed + index * 97))));
}

const LUPINS: RGB[] = [
  [0.82, 0.28, 0.32],
  [0.92, 0.72, 0.22],
  [0.48, 0.32, 0.7],
];

export type Patch = {
  grass: Scatter;
  lilies: Scatter;
  daisies: Scatter;
  lupins: Scatter;
};

export type SceneLayout = {
  patches: Patch[];
  clouds: Scatter;
  glows: Scatter;
  sparks: Scatter;
  leaves: Scatter;
};

function flowerBed(
  count: number,
  seed: number,
  scaleRange: [number, number],
  tint: (rng: () => number) => RGB,
  nearMul = 1,
) {
  const rng = mulberry32(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i += 1) {
    const fringe = i < Math.ceil(count * 0.42);
    const depth = Math.pow(rng(), 0.62);
    const z = fringe ? 2.55 + rng() * 1.2 : 4.4 - depth * 14;
    const side = rng() < 0.5 ? -1 : 1;
    const near = z > 2.4;
    const spread = fringe ? 1.15 : near ? 2.4 : 4.8;
    const x = side * (FLOWER_CLEAR + Math.pow(rng(), fringe ? 0.8 : 0.6) * spread);
    const size = (scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])) * (near ? nearMul : 1);
    items.push({
      x,
      y: 0,
      z,
      yaw: rng() * Math.PI * 2,
      pitch: (rng() - 0.5) * 0.08,
      sx: size,
      sy: size,
      sz: size,
      color: tint(rng),
      phase: rng() * Math.PI * 2,
    });
  }
  return items;
}

export function buildLayout(quality: Quality): SceneLayout {
  const counts = countsFor(quality);
  const lilies = flowerBed(counts.lilies, 11, [0.4, 0.62], (rng) => {
    const warm = rng() * 0.04;
    return [0.97 - warm, 0.96 - warm * 0.4, 0.93];
  }, 0.55);
  const daisies = flowerBed(counts.daisies, 29, [0.26, 0.4], () => [1, 1, 1], 0.85);
  const lupinItems = flowerBed(counts.lupins, 47, [0.7, 1.05], (rng) => {
    const base = LUPINS[Math.floor(rng() * LUPINS.length)] ?? LUPINS[0];
    return base;
  }, 0.9);

  const grassRng = mulberry32(101);
  const grass: Item[] = [];
  for (let i = 0; i < counts.grass; i += 1) {
    const fringe = i < Math.ceil(counts.grass * 0.28);
    const depth = Math.pow(grassRng(), 0.85);
    const z = fringe ? 2.4 + grassRng() * 1.5 : 5.4 - depth * 18;
    const side = grassRng() < 0.5 ? -1 : 1;
    const near = z > 2.4;
    const spread = fringe ? 1.35 : near ? 2.6 : 6.4;
    const x = side * (GRASS_CLEAR + Math.pow(grassRng(), fringe ? 0.7 : 0.5) * spread);
    const height = 0.34 + grassRng() * 0.4;
    const shade = 0.75 + grassRng() * 0.4;
    grass.push({
      x,
      y: 0,
      z,
      yaw: grassRng() * Math.PI * 2,
      pitch: 0,
      sx: 0.7 + grassRng() * 0.8,
      sy: height,
      sz: 0.8 + grassRng() * 0.5,
      color: [shade * 0.85, shade, shade * 0.55],
      phase: grassRng() * Math.PI * 2,
    });
  }

  const glowItems: Item[] = [];
  const glowLilies = [...lilies].sort((a, b) => b.z - a.z).slice(0, 20);
  for (const flower of glowLilies) {
    glowItems.push({
      ...flower,
      y: 0.22 * flower.sy,
      sx: flower.sx * 0.32,
      sy: flower.sy * 0.32,
      sz: 1,
      color: [1, 0.96, 0.86],
    });
  }
  const cloudRng = mulberry32(7);
  const clouds: Item[] = [];
  for (let i = 0; i < counts.clouds; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    clouds.push({
      x: side * (1.2 + cloudRng() * 4.5),
      y: 3.4 + cloudRng() * 1.1,
      z: 4.5 - cloudRng() * 14,
      yaw: 0,
      pitch: 0,
      sx: 3.4 + cloudRng() * 2.2,
      sy: 1.35 + cloudRng() * 0.7,
      sz: 1,
      color: [1, 1, 1],
      phase: cloudRng() * Math.PI * 2,
    });
  }

  const sparkRng = mulberry32(19);
  const sparks: Item[] = [];
  const sparkColors: RGB[] = [
    [1, 0.95, 0.72],
    [1, 0.82, 0.45],
    [0.95, 0.78, 1],
    [1, 0.96, 0.96],
    [0.78, 0.95, 0.62],
  ];
  for (let i = 0; i < counts.sparks; i += 1) {
    const side = sparkRng() < 0.5 ? -1 : 1;
    const z = 1.2 - sparkRng() * 12;
    const color = sparkColors[Math.floor(sparkRng() * sparkColors.length)] ?? [1, 0.95, 0.72];
    sparks.push({
      x: side * (1.35 + Math.pow(sparkRng(), 0.7) * 5.2),
      y: 0.18 + sparkRng() * 0.55,
      z,
      yaw: 0,
      pitch: 0,
      sx: 0.08 + sparkRng() * 0.1,
      sy: 0.08 + sparkRng() * 0.1,
      sz: 1,
      color,
      phase: sparkRng() * Math.PI * 2,
    });
  }

  const leaves: Item[] = [];

  const grassPatches = splitPatches(grass, 501);
  const lilyPatches = splitPatches(lilies, 511);
  const daisyPatches = splitPatches(daisies, 521);
  const lupinPatches = splitPatches(lupinItems, 531);

  return {
    patches: [0, 1, 2].map((index) => ({
      grass: grassPatches[index] ?? emptyScatter(),
      lilies: lilyPatches[index] ?? emptyScatter(),
      daisies: daisyPatches[index] ?? emptyScatter(),
      lupins: lupinPatches[index] ?? emptyScatter(),
    })),
    clouds: toScatter(shuffle(clouds, 13)),
    glows: toScatter(shuffle(glowItems, 17)),
    sparks: toScatter(shuffle(sparks, 23)),
    leaves: toScatter(shuffle(leaves, 29)),
  };
}
