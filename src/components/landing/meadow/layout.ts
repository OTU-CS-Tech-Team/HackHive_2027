import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { hexToRgb } from "@/components/landing/meadow/palette";
import type { Quality } from "@/components/landing/meadow/quality";
import { countsFor } from "@/components/landing/meadow/quality";
import { TREE } from "@/components/landing/meadow/tree";

/** Flowers stay off the calm centre. Grass may grow closer to the path edge. */
export const FLOWER_CLEAR = 1.12;
export const GRASS_CLEAR = 0.84;
export const PATCH_BANDS = [2.4, -4.15] as const;

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
  blossoms: Scatter;
  /** Instances that stay when the far petal drift is trimmed. */
  canopyCount: number;
};

function paint(rng: () => number, family: boolean) {
  if (!family) return { color: [1, 1, 1] as RGB, tip: undefined };
  const picked = LUPINS[Math.floor(rng() * LUPINS.length)] ?? LUPINS[0];
  return { color: picked.base, tip: picked.tip };
}

function placeFlower(
  items: Item[],
  rng: () => number,
  x: number,
  y: number,
  z: number,
  size: number,
  sy: number,
  color: RGB,
  tip: RGB | undefined,
  lean: number,
  yawSpan: number,
) {
  items.push({
    x,
    y,
    z,
    yaw: (rng() - 0.5) * yawSpan,
    pitch: lean + (rng() - 0.5) * 0.12,
    sx: size,
    sy,
    sz: size,
    color,
    tip,
    phase: rng() * Math.PI * 2,
  });
}

/** Ground half-width at the frame edge. High matches the 1280 camera; low matches a 390 after the portrait squeeze. */
function frameEdge(z: number, compact: boolean) {
  if (compact) return 0.9 + Math.max(0, 4.1 - z) * 0.31;
  return (0.98 + Math.max(0, 5.05 - z) * 0.67) * 1.02;
}

function sideX(
  rng: () => number,
  side: number,
  z: number,
  clear: number,
  compact: boolean,
  outer: boolean,
  inward: boolean,
) {
  const edge = Math.max(clear + 0.22, frameEdge(z, compact));
  const along = inward ? Math.pow(rng(), 1.65) : outer ? 0.74 + rng() * 0.26 : rng();
  let x = side * (clear + 0.05 + along * (edge - clear));
  if (Math.abs(x) < clear) x = side * (clear + 0.08 + rng() * 0.15);
  return x;
}

/** Full meshes, spread from the path shoulder out to the frame edge. */
function scatterFull(
  count: number,
  seed: number,
  z0: number,
  z1: number,
  scaleRange: [number, number],
  clear: number,
  compact: boolean,
  family: boolean,
  lean: number,
  yawSpan: number,
  inward = false,
) {
  const rng = mulberry32(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const depth = i % 5 === 0 ? rng() * 0.4 : rng();
    const z = z0 + depth * (z1 - z0);
    const x = sideX(rng, side, z, clear, compact, i % 5 === 1, inward);
    const tint = paint(rng, family);
    const size = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
    placeFlower(items, rng, x, 0.02, z, size, size, tint.color, tint.tip, lean, yawSpan);
  }
  return items;
}

const BLOSSOM_ROSE: RGB[] = [hexToRgb("#c43a62"), hexToRgb("#a83254"), hexToRgb("#d24e72")];
const BLOSSOM_MID: RGB[] = [hexToRgb("#e87898"), hexToRgb("#f0a0b6"), hexToRgb("#f6c4d0")];
const BLOSSOM_PALE: RGB[] = [hexToRgb("#ffe4ee"), hexToRgb("#ffd0e0"), hexToRgb("#fff0f4")];

function placeShell(
  items: Item[],
  count: number,
  yCenter: number,
  radius: number,
  zBias: number,
  phase: number,
  colors: RGB[],
  sizeMin: number,
  sizeMax: number,
) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const yNorm = 0.92 - ((i + 0.5) / count) * 1.08;
    const ring = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
    const theta = golden * i;
    const jitter = 0.76 + (i % 5) * 0.06;
    const reach = radius * ring * jitter;
    const color = colors[i % colors.length] ?? BLOSSOM_PALE[0];
    if (!color) continue;
    const size = sizeMin + (i % 7) * ((sizeMax - sizeMin) / 6);
    items.push({
      x: TREE.x + Math.cos(theta) * reach,
      y: TREE.baseY + yCenter + yNorm * radius * TREE.canopySquash,
      z: TREE.z + Math.sin(theta) * reach * 0.92 + zBias,
      yaw: 0,
      pitch: 0,
      sx: size,
      sy: size * (0.84 + (i % 3) * 0.08),
      sz: 1,
      color,
      phase: phase + (i % 5) * 0.03,
    });
  }
}

/** Layered blossom cloud: shadow, warm rim, three depths, then a few falling petals. */
function buildBlossoms(quality: Quality) {
  const compact = quality === "low";
  const glows = compact ? 2 : 3;
  const petals = compact ? 10 : 16;
  const items: Item[] = [];
  items.push({
    x: TREE.x,
    y: TREE.baseY + 0.02,
    z: TREE.z,
    yaw: 0,
    pitch: 0,
      sx: 0.9,
    sy: 0.55,
    sz: 1,
    color: hexToRgb("#243018"),
    phase: 21,
  });
  for (let i = 0; i < glows; i += 1) {
    const angle = (i / glows) * Math.PI * 2;
    items.push({
      x: TREE.x + Math.cos(angle) * 0.16,
      y: TREE.baseY + TREE.canopyY + 0.04,
      z: TREE.z - 0.42,
      yaw: 0,
      pitch: 0,
      sx: 0.44,
      sy: 0.32,
      sz: 1,
      color: hexToRgb("#ffd2b8"),
      phase: 11 + i * 0.15,
    });
  }
  const back = compact ? 24 : 40;
  const mid = compact ? 30 : 48;
  const front = compact ? 20 : 32;
  placeShell(items, back, TREE.canopyY - 0.06, TREE.canopyRadius * 1.02, -0.22, 0.25, BLOSSOM_ROSE, 0.32, 0.44);
  placeShell(items, mid, TREE.canopyY + 0.02, TREE.canopyRadius * 0.88, 0.0, 2.7, BLOSSOM_MID, 0.28, 0.4);
  placeShell(items, front, TREE.canopyY + 0.08, TREE.canopyRadius * 0.68, 0.18, 5.3, BLOSSOM_PALE, 0.24, 0.34);
  const sprigs = compact ? 6 : 10;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < sprigs; i += 1) {
    const angle = golden * i * 2.4 + 0.4;
    const reach = TREE.canopyRadius * (1.12 + (i % 4) * 0.07);
    const lift = ((i % 5) - 2) * 0.11;
    const color = i % 3 === 0 ? BLOSSOM_PALE[i % BLOSSOM_PALE.length] : BLOSSOM_MID[i % BLOSSOM_MID.length];
    if (!color) continue;
    items.push({
      x: TREE.x + Math.cos(angle) * reach,
      y: TREE.baseY + TREE.canopyY + lift,
      z: TREE.z + Math.sin(angle) * reach * 0.9,
      yaw: 0,
      pitch: 0,
      sx: 0.16 + (i % 3) * 0.03,
      sy: 0.2 + (i % 4) * 0.02,
      sz: 1,
      color,
      phase: 6.4 + (i % 3) * 0.04,
    });
  }
  for (let i = 0; i < petals; i += 1) {
    const angle = golden * i * 1.7;
    const radius = 0.18 + (i % 5) * 0.12;
    const color = BLOSSOM_PALE[i % BLOSSOM_PALE.length] ?? BLOSSOM_MID[0];
    if (!color) continue;
    items.push({
      x: TREE.x + Math.cos(angle) * radius,
      y: TREE.baseY + TREE.canopyY + 0.12 + (i % 4) * 0.06,
      z: TREE.z + Math.sin(angle) * radius,
      yaw: 0,
      pitch: 0,
      sx: 0.09 + (i % 3) * 0.02,
      sy: 0.12,
      sz: 1,
      color,
      phase: 30 + i * 0.37,
    });
  }
  return { scatter: toScatter(items), canopyCount: 1 + glows + back + mid + front + sprigs };
}

function splitCount(total: number, nearShare: number) {
  const near = Math.max(4, Math.round(total * nearShare));
  return { near, mid: Math.max(4, total - near) };
}

export function buildLayout(quality: Quality): SceneLayout {
  const counts = countsFor(quality);
  const compact = quality === "low";
  const flowerClear = compact ? 0.62 : FLOWER_CLEAR;
  const lilySplit = splitCount(counts.lilies, compact ? 0.58 : 0.34);
  const daisySplit = splitCount(counts.daisies, compact ? 0.58 : 0.34);
  const lupinSplit = splitCount(counts.lupins, compact ? 0.58 : 0.34);
  const lilyScale = compact ? ([0.22, 0.32] as [number, number]) : ([0.26, 0.38] as [number, number]);
  const daisyScale = compact ? ([0.2, 0.3] as [number, number]) : ([0.16, 0.26] as [number, number]);
  const lupinScale = compact ? ([0.42, 0.6] as [number, number]) : ([0.46, 0.66] as [number, number]);
  // On a phone the ground past about z=3.9 is below the frame, so the near row sits inside it.
  const nearZ = compact ? ([3.85, 1.35] as const) : ([4.75, 1.55] as const);
  const nearLilies = scatterFull(lilySplit.near, 11, nearZ[0], nearZ[1], lilyScale, flowerClear, compact, false, 0.92, 0.5, compact);
  const midLilies = scatterFull(lilySplit.mid, 13, -3.9, 1.9, lilyScale, flowerClear, compact, false, 0.92, 0.5);
  const nearDaisies = scatterFull(daisySplit.near, 29, nearZ[0], nearZ[1], daisyScale, flowerClear, compact, false, 0, Math.PI * 2, compact);
  const midDaisies = scatterFull(daisySplit.mid, 31, -3.9, 1.9, daisyScale, flowerClear, compact, false, 0, Math.PI * 2);
  const nearLupins = scatterFull(lupinSplit.near, 47, nearZ[0], nearZ[1], lupinScale, flowerClear, compact, true, 0, Math.PI * 2, compact);
  const midLupins = scatterFull(lupinSplit.mid, 53, -3.9, 1.9, lupinScale, flowerClear, compact, true, 0, Math.PI * 2);
  const farScale = 0.46;
  const farLilyScale: [number, number] = [lilyScale[0] * farScale, lilyScale[1] * farScale];
  const farDaisyScale: [number, number] = [daisyScale[0] * farScale, daisyScale[1] * farScale];
  const farLupinScale: [number, number] = [lupinScale[0] * farScale, lupinScale[1] * farScale];
  const farLilies = scatterFull(counts.farLilies, 71, -1.9, -3.75, farLilyScale, flowerClear, compact, false, 0.92, 0.5);
  const farDaisies = scatterFull(counts.farDaisies, 73, -1.9, -3.75, farDaisyScale, flowerClear, compact, false, 0, Math.PI * 2);
  const farLupins = scatterFull(counts.farLupins, 79, -1.9, -3.75, farLupinScale, flowerClear, compact, true, 0, Math.PI * 2);
  const blossoms = buildBlossoms(quality);

  const grassRng = mulberry32(101);
  const grass: Item[] = [];
  const grassClear = compact ? 0.18 : GRASS_CLEAR;
  const widthMul = compact ? 0.42 : 1;
  for (let i = 0; i < counts.grass; i += 1) {
    const roll = grassRng();
    const foreground = roll < 0.3;
    const shoulder = !foreground && roll < 0.48;
    const clump = !foreground && !shoulder && roll < 0.74;
    let x = 0;
    let z = 0;
    if (foreground) {
      const side = grassRng() < 0.5 ? -1 : 1;
      z = 4.15 - grassRng() * 1.7;
      const along = Math.pow(grassRng(), compact ? 1.45 : 0.62);
      const reach = compact ? 1.15 : 4.6;
      x = side * (grassClear + along * reach);
    } else if (shoulder) {
      const side = grassRng() < 0.5 ? -1 : 1;
      z = 2.25 + grassRng() * 1.35;
      const along = Math.pow(grassRng(), 0.8);
      x = side * (grassClear + 0.02 + along * (compact ? 0.7 : 0.9));
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
    const phoneGrass = !compact || z <= 1.35 ? 1 : Math.max(0.1, 0.7 - Math.max(0, z - 1.2) * 0.22);
    const height = (foreground ? 0.12 + grassRng() * 0.16 : 0.11 + grassRng() * 0.22) * phoneGrass;
    const shade = 0.82 + grassRng() * 0.18;
    const warm = grassRng();
    grass.push({
      x,
      y: 0,
      z,
      yaw: (grassRng() - 0.5) * Math.PI * 2,
      pitch: (grassRng() - 0.5) * 0.44,
      sx: (0.55 + grassRng() * 0.85) * phoneGrass,
      sy: height,
      sz: (0.5 + grassRng() * 0.9) * phoneGrass,
      color: [(0.4 + warm * 0.14) * shade, (0.58 + (1 - warm) * 0.12) * shade, (0.16 + grassRng() * 0.08) * shade],
      phase: grassRng() * Math.PI * 2,
    });
  }

  const glowItems: Item[] = [];
  const glowLilies = [...nearLilies, ...midLilies].sort((a, b) => b.z - a.z).slice(0, 20);
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
  const gutter = compact ? 2.05 : 5.2;
  for (let i = 0; i < counts.clouds; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const depth = i / Math.max(1, counts.clouds - 1);
    clouds.push({
      x: side * (gutter + (i % 3) * (compact ? 0.55 : 1.15) + cloudRng() * (compact ? 0.7 : 1.4)),
      y: 2.85 + cloudRng() * 0.7,
      z: -2.2 - depth * 6.4 - cloudRng() * 0.8,
      yaw: 0,
      pitch: 0,
      sx: (compact ? 3.4 : 4.6) + cloudRng() * 1.6,
      sy: 1.9 + cloudRng() * 0.7,
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

  return {
    patches: [
      {
        grass: grassPatches[0] ?? emptyScatter(),
        lilies: toScatter(shuffle(nearLilies, 511)),
        daisies: toScatter(shuffle(nearDaisies, 521)),
        lupins: toScatter(shuffle(nearLupins, 531)),
      },
      {
        grass: grassPatches[1] ?? emptyScatter(),
        lilies: toScatter(shuffle(midLilies, 541)),
        daisies: toScatter(shuffle(midDaisies, 551)),
        lupins: toScatter(shuffle(midLupins, 561)),
      },
      {
        grass: grassPatches[2] ?? emptyScatter(),
        lilies: toScatter(shuffle(farLilies, 571)),
        daisies: toScatter(shuffle(farDaisies, 581)),
        lupins: toScatter(shuffle(farLupins, 591)),
      },
    ],
    clouds: toScatter(shuffle(clouds, 13)),
    glows: toScatter(shuffle(glowItems, 17)),
    sparks: toScatter(shuffle(sparks, 23)),
    leaves: toScatter(shuffle(leaves, 29)),
    blossoms: blossoms.scatter,
    canopyCount: blossoms.canopyCount,
  };
}
