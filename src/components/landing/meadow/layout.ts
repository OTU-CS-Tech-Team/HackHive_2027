import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { hexToRgb } from "@/components/landing/meadow/palette";
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
  tips?: Float32Array;
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
  tip?: RGB;
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
  const tipped = items.some((item) => item.tip);
  const tips = tipped ? new Float32Array(count * 3) : undefined;
  items.forEach((item, index) => {
    writeMatrix(matrices, index, item);
    colors[index * 3] = item.color[0];
    colors[index * 3 + 1] = item.color[1];
    colors[index * 3 + 2] = item.color[2];
    const tip = item.tip ?? item.color;
    if (tips) {
      tips[index * 3] = tip[0];
      tips[index * 3 + 1] = tip[1];
      tips[index * 3 + 2] = tip[2];
    }
    phases[index] = item.phase;
  });
  return { count, matrices, colors, phases, tips };
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

const LUPINS: { base: RGB; tip: RGB }[] = [
  { base: hexToRgb("#e0453a"), tip: hexToRgb("#ff8a7a") },
  { base: hexToRgb("#f2b52e"), tip: hexToRgb("#ffe27a") },
  { base: hexToRgb("#8a5bd6"), tip: hexToRgb("#c7a6ff") },
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
  clear = FLOWER_CLEAR,
  spreadMul = 1,
  lean = 0,
  yawJitter = Math.PI * 2,
) {
  const rng = mulberry32(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i += 1) {
    const corner = i < Math.ceil(count * 0.14);
    const fringe = !corner && i < Math.ceil(count * 0.42);
    const depth = Math.pow(rng(), 0.62);
    const z = corner ? 4.35 - rng() * 1.15 : fringe ? 4.05 - rng() * 1.55 : 2.35 - depth * 11;
    const side = rng() < 0.5 ? -1 : 1;
    const near = z > 2.4;
    const spread = (corner ? (spreadMul < 1 ? 1.6 : 2.9) : fringe ? 1.15 : near ? 2.4 : 4.8) * spreadMul;
    const x = side * (clear + Math.pow(rng(), fringe ? 0.8 : 0.6) * spread);
    const size = (scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])) * (near ? nearMul : 1);
    items.push({
      x,
      y: 0,
      z,
      yaw: (rng() - 0.5) * yawJitter,
      pitch: lean + (rng() - 0.5) * 0.2,
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
  const compact = quality === "low";
  const flowerClear = compact ? 0.32 : FLOWER_CLEAR;
  const spreadMul = compact ? 0.42 : 1;
  const lilyRng = mulberry32(11);
  const lilies: Item[] = [];
  for (let i = 0; i < counts.lilies; i += 1) {
    const corner = i < Math.ceil(counts.lilies * 0.12);
    const near = !corner && i < Math.ceil(counts.lilies * 0.22);
    const depth = lilyRng();
    const z = corner ? 4.25 - depth * 0.9 : near ? 3.5 - depth * 1.15 : 2.15 - depth * 6.2;
    const side = lilyRng() < 0.5 ? -1 : 1;
    const reach = (corner ? 2.7 : near ? 1.35 : 1.8 + depth * 2.6) * spreadMul;
    const x = side * (flowerClear + 0.12 + Math.pow(lilyRng(), 0.8) * reach);
    const size = corner
      ? (compact ? 0.15 : 0.18) + lilyRng() * 0.04
      : near
        ? (compact ? 0.26 : 0.3) + lilyRng() * (compact ? 0.04 : 0.06)
        : (compact ? 0.16 : 0.2) + lilyRng() * (compact ? 0.07 : 0.1);
    lilies.push({
      x,
      y: 0.02,
      z,
      yaw: (lilyRng() - 0.5) * 0.5,
      pitch: 0.92 + (lilyRng() - 0.5) * 0.08,
      sx: size,
      sy: size,
      sz: size,
      color: [1, 1, 1],
      phase: lilyRng() * Math.PI * 2,
    });
  }
  const daisies = flowerBed(counts.daisies, 29, [0.16, 0.26], () => [1, 1, 1], 0.85, flowerClear, spreadMul);
  const lupinTips: RGB[] = [];
  const lupinItems = flowerBed(counts.lupins, 47, compact ? [0.38, 0.55] : [0.46, 0.66], (rng) => {
    const family = LUPINS[Math.floor(rng() * LUPINS.length)] ?? LUPINS[0];
    lupinTips.push(family.tip);
    return family.base;
  }, 0.85, flowerClear, spreadMul);
  lupinItems.forEach((item, index) => {
    item.tip = lupinTips[index];
  });

  const grassRng = mulberry32(101);
  const grass: Item[] = [];
  const grassClear = compact ? 0.18 : GRASS_CLEAR;
  const widthMul = compact ? 0.42 : 1;
  for (let i = 0; i < counts.grass; i += 1) {
    const roll = grassRng();
    const foreground = roll < 0.46;
    const clump = !foreground && roll < 0.74;
    let x = 0;
    let z = 0;
    if (foreground) {
      const side = grassRng() < 0.42 ? -1 : 1;
      z = 4.75 - grassRng() * 2.15;
      const along = Math.pow(grassRng(), compact ? 1.45 : 0.62);
      const reach = compact ? 2.2 : 4.6;
      x = side * (grassClear + along * reach);
    } else if (clump) {
      const id = Math.floor(grassRng() * 9);
      const side = id % 2 === 0 ? -1 : 1;
      const anchorZ = 4.4 - (id % 5) * 1.7;
      const anchorX = side * (grassClear + 0.55 + (id % 3) * 1.15 * widthMul);
      x = anchorX + (grassRng() - 0.5) * 1.15 * widthMul;
      z = anchorZ + (grassRng() - 0.5) * 0.85;
      if (Math.abs(x) < grassClear) x = side * (grassClear + grassRng() * 0.35);
    } else {
      const depth = Math.pow(grassRng(), 1.15);
      const side = grassRng() < 0.5 ? -1 : 1;
      z = 2.1 - depth * 7.2;
      x = side * (grassClear + Math.pow(grassRng(), 0.55) * 6.4 * widthMul);
    }
    const height = foreground ? 0.12 + grassRng() * 0.16 : 0.11 + grassRng() * 0.22;
    const shade = 0.82 + grassRng() * 0.18;
    const warm = grassRng();
    grass.push({
      x,
      y: 0,
      z,
      yaw: (grassRng() - 0.5) * Math.PI * 2,
      pitch: (grassRng() - 0.5) * 0.44,
      sx: 0.55 + grassRng() * 0.85,
      sy: height,
      sz: 0.5 + grassRng() * 0.9,
      color: [(0.4 + warm * 0.14) * shade, (0.58 + (1 - warm) * 0.12) * shade, (0.16 + grassRng() * 0.08) * shade],
      phase: grassRng() * Math.PI * 2,
    });
  }

  const glowItems: Item[] = [];
  const glowLilies = [...lilies].sort((a, b) => b.z - a.z).slice(0, 20);
  for (const flower of glowLilies) {
    glowItems.push({
      ...flower,
      y: 0.72 * flower.sy,
      sx: flower.sx * 0.62,
      sy: flower.sy * 0.62,
      sz: 1,
      color: [1, 1, 1],
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
    [1, 0.98, 0.94],
    [1, 0.84, 0.32],
    [0.7, 0.52, 0.96],
  ];
  for (let i = 0; i < counts.sparks; i += 1) {
    const side = sparkRng() < 0.5 ? -1 : 1;
    const middle = sparkRng() < 0.78;
    const z = middle ? 2.6 - sparkRng() * 9 : -6.2 - sparkRng() * 8;
    const edge = compact ? 0.28 : 1.02;
    const reach = middle ? (compact ? 0.95 : 2.2) : (compact ? 1.8 : 4.8);
    const color = sparkColors[Math.floor(sparkRng() * sparkColors.length)] ?? [1, 0.98, 0.94];
    const size = 0.14 + sparkRng() * (middle ? 0.16 : 0.1);
    sparks.push({
      x: side * (edge + Math.pow(sparkRng(), 0.62) * reach),
      y: 0.1 + sparkRng() * (middle ? 0.42 : 0.62),
      z,
      yaw: 0,
      pitch: 0,
      sx: size,
      sy: size,
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
