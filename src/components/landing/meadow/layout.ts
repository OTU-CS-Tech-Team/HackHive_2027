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

function smooth01(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function pathEaseAt(z: number) {
  const approach = 1 - smooth01(TREE.z, 4.6, z);
  return approach * approach * (3 - 2 * approach);
}

/** Centre of the path that climbs to the wide-frame tree. Matches the ground shader. */
export function pathCenterAt(z: number) {
  const line = Math.sin(z * 0.33) * 0.14 + Math.sin(z * 0.91 + 1.7) * 0.06;
  const ease = pathEaseAt(z);
  return line * (1 - ease) + (TREE.x + TREE.shiftWide) * ease;
}

/** How far a flower stays from that centre. The path narrows as it reaches the tree. */
export function flowerMargin(z: number) {
  return Math.min(FLOWER_CLEAR, 1.05 * (1 - 0.38 * pathEaseAt(z)) + 0.08);
}

/** Centre of the path on a tablet, where the trunk sits closer to the title. */
export function pathCenterMid(z: number) {
  const line = Math.sin(z * 0.33) * 0.14 + Math.sin(z * 0.91 + 1.7) * 0.06;
  return line * (1 - pathEaseAt(z)) + (TREE.x + TREE.shiftMid) * pathEaseAt(z);
}

function anchorFor(aspect: number) {
  const wide = smooth01(0.95, 1.45, Math.max(aspect, 0.3));
  const phone = 1 - smooth01(0.5, 0.72, aspect);
  const mid = (1 - wide) * (1 - phone);
  return TREE.x + mid * TREE.shiftMid + wide * TREE.shiftWide + phone * TREE.shiftPhone;
}

function halfFor(aspect: number, z: number) {
  const narrow = 1 - smooth01(0.62, 1.15, Math.max(aspect, 0.3));
  const base = 1.05 * (1 - narrow) + 0.42 * narrow;
  return base * (1 - 0.38 * pathEaseAt(z));
}

function centerFor(z: number, anchor: number) {
  const line = Math.sin(z * 0.33) * 0.14 + Math.sin(z * 0.91 + 1.7) * 0.06;
  return line * (1 - pathEaseAt(z)) + anchor * pathEaseAt(z);
}

/** Half-width settlePortrait keeps on screen. Flowers past this pile up on the frame. */
function visibleHalf(z: number, aspect: number) {
  const aspectT = Math.min(1.35, Math.max(0, (aspect - 0.46) / 0.29));
  const blended = (1.3 - z * 0.191) * (1 - Math.min(aspectT, 1)) + (2.12 - z * 0.31) * Math.min(aspectT, 1);
  return Math.max(0.4, blended + Math.max(0, aspectT - 1) * 0.4) * 0.98;
}

/** Ground half-width the camera can see. The wide frame is wider than settlePortrait. */
function frameHalf(z: number, aspect: number) {
  if (aspect >= 1.2) return Math.max(0.9, 1.79 + (3.84 - z) * 0.67);
  return visibleHalf(z, aspect);
}

function mergeIntervals(parts: [number, number][]) {
  const sorted = parts.filter((part) => part[1] - part[0] > 0.05).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 0.03) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/**
 * Lawns that are actually on screen beside a path. High covers the desktop
 * and the tablet, because both use this layout. Low also covers the phone.
 * A bed only has to clear the path of the width it shows on.
 */
function flowerBeds(z: number, compact: boolean) {
  const aspects = compact ? [0.46, 0.75, 1.6] : [0.75, 1.6];
  const parts: [number, number][] = [];
  for (const aspect of aspects) {
    const vis = frameHalf(z, aspect);
    const center = centerFor(z, anchorFor(aspect));
    const half = halfFor(aspect, z) * 0.8;
    const left: [number, number] = [-vis, Math.min(vis, center - half)];
    const right: [number, number] = [Math.max(-vis, center + half), vis];
    if (left[1] - left[0] > 0.05) parts.push(left);
    if (right[1] - right[0] > 0.05) parts.push(right);
  }
  return mergeIntervals(parts);
}

function sideX(
  rng: () => number,
  side: number,
  z: number,
  _clear: number,
  compact: boolean,
  outer: boolean,
  inward: boolean,
) {
  const beds = flowerBeds(z, compact);
  const pivot = pathCenterAt(z);
  const wanted = beds.filter(([start, end]) => {
    const mid = (start + end) / 2;
    return side < 0 ? mid < pivot : mid > pivot;
  });
  if (wanted.length === 0) return pivot + side * (0.58 + rng() * 0.45);
  const pool = wanted;
  let total = 0;
  for (const [start, end] of pool) {
    const mid = (start + end) / 2;
    const onScreen = Math.abs(mid) <= visibleHalf(z, compact ? 0.46 : 0.75) + 0.08;
    total += (end - start) * (onScreen ? 4 : 0.4);
  }
  let pick = rng() * total;
  let chosen = pool[0] ?? [pivot + side, pivot + side * 1.4];
  for (const bed of pool) {
    const mid = (bed[0] + bed[1]) / 2;
    const onScreen = Math.abs(mid) <= visibleHalf(z, compact ? 0.46 : 0.75) + 0.08;
    const weight = (bed[1] - bed[0]) * (onScreen ? 4 : 0.4);
    if (pick <= weight) {
      chosen = bed;
      break;
    }
    pick -= weight;
  }
  const vis = visibleHalf(z, compact ? 0.46 : 0.75);
  const innerStart = Math.max(chosen[0], -vis);
  const innerEnd = Math.min(chosen[1], vis);
  const focus: [number, number] = innerEnd - innerStart > 0.05 ? [innerStart, innerEnd] : chosen;
  const pathIsOnTheRight = (focus[0] + focus[1]) / 2 < pivot;
  const roll = rng();
  let span: [number, number] = focus;
  let t = rng();
  if (inward && roll < 0.32) {
    const shoulder = (focus[1] - focus[0]) * 0.36;
    span = pathIsOnTheRight
      ? [Math.max(focus[0], focus[1] - shoulder), focus[1]]
      : [focus[0], Math.min(focus[1], focus[0] + shoulder)];
    t = pathIsOnTheRight ? 1 - Math.pow(t, 1.5) : Math.pow(t, 1.5);
  } else if (roll < 0.6) {
    span = focus;
  } else {
    span = chosen;
    t = pathIsOnTheRight ? Math.pow(t, 1.55) : 1 - Math.pow(t, 1.55);
  }
  return span[0] + (span[1] - span[0]) * t;
}

/** Half-width of the tablet path, matching the ground shader at aspect 0.75. */
function tabletHalf(z: number) {
  const narrow = 1 - smooth01(0.62, 1.15, 0.75);
  const base = 1.05 * (1 - narrow) + 0.42 * narrow;
  return base * (1 - 0.38 * pathEaseAt(z));
}

/** Just outside the tablet path, in the grass band under the tree at 768. */
function tabletShoulder(z: number, side: number, rng: () => number) {
  const half = tabletHalf(z);
  const gap = half * 0.7 + 0.1 + rng() * 0.24;
  return pathCenterMid(z) + side * gap;
}

/**
 * Mid flowers in the open lawn on the left of the tablet path. That band
 * sits between the left lupins and the dirt around screen y 560–700 at 768.
 * The wide path is further right, so these stay off it at 1280 too.
 */
function fillTabletGap(lilies: Item[], daisies: Item[], lupins: Item[]) {
  const rng = mulberry32(907);
  const count = 24;
  for (let i = 0; i < count; i += 1) {
    const z = 0.95 + (i % 6) * 0.22 + (rng() - 0.5) * 0.07;
    const column = Math.floor(i / 6);
    const x = 0.05 - column * 0.32 - rng() * 0.08;
    const lily = i % 3 === 0;
    const lupin = i % 5 === 0;
    if (lupin) {
      const tint = paint(rng, true);
      const size = 0.48 + rng() * 0.14;
      placeFlower(lupins, rng, x, 0.02, z, size, size, tint.color, tint.tip, 0, Math.PI * 2);
    } else if (lily) {
      const size = 0.26 + rng() * 0.1;
      placeFlower(lilies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0.92, 0.5);
    } else {
      const size = 0.16 + rng() * 0.08;
      placeFlower(daisies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0, Math.PI * 2);
    }
  }
}

/**
 * A few mid flowers in the lawn just off the wide path. That grass is
 * the band behind the button at 1280. z stays in the mid patch.
 */
function fillButtonBand(lilies: Item[], daisies: Item[], lupins: Item[]) {
  const rng = mulberry32(1201);
  const count = 8;
  for (let i = 0; i < count; i += 1) {
    const z = 1.55 + (i % 4) * 0.18 + (rng() - 0.5) * 0.05;
    const side = i < 5 ? -1 : 1;
    const x = pathCenterAt(z) + side * (0.82 + (i % 3) * 0.16 + rng() * 0.06);
    if (i % 4 === 0) {
      const tint = paint(rng, true);
      const size = 0.5 + rng() * 0.1;
      placeFlower(lupins, rng, x, 0.02, z, size, size, tint.color, tint.tip, 0, Math.PI * 2);
    } else if (i % 4 === 1) {
      const size = 0.28 + rng() * 0.06;
      placeFlower(lilies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0.92, 0.5);
    } else {
      const size = 0.18 + rng() * 0.06;
      placeFlower(daisies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0, Math.PI * 2);
    }
  }
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
    const nearTree = z > 0.35 && z < 2.35;
    const x = nearTree && i % 4 === 0 ? tabletShoulder(z, side, rng) : sideX(rng, side, z, clear, compact, i % 5 === 1, inward);
    const tint = paint(rng, family);
    const size = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
    placeFlower(items, rng, x, 0.02, z, size, size, tint.color, tint.tip, lean, yawSpan);
  }
  return items;
}

const BLOSSOM_WHITE: RGB[] = [hexToRgb("#fffdfb"), hexToRgb("#fff6f8"), hexToRgb("#ffffff")];
const BLOSSOM_PINK: RGB[] = [hexToRgb("#f6b7c8"), hexToRgb("#f3a4ba"), hexToRgb("#f8c6d4")];
const BLOSSOM_ROSE: RGB[] = [hexToRgb("#f0a0b8"), hexToRgb("#fff8f9"), hexToRgb("#ee94ae"), hexToRgb("#f7c2d0")];
const BLOSSOM_MIXED: RGB[] = [
  hexToRgb("#fffdfb"),
  hexToRgb("#f6b7c8"),
  hexToRgb("#fff7f8"),
  hexToRgb("#f3a4ba"),
  hexToRgb("#ffffff"),
  hexToRgb("#f8c6d4"),
];

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
    const jitter = 0.94 + (i % 3) * 0.02;
    const reach = radius * ring * jitter;
    const color = colors[i % colors.length] ?? BLOSSOM_PINK[0];
    if (!color) continue;
    const size = sizeMin + (i % 7) * ((sizeMax - sizeMin) / 6);
    items.push({
      x: TREE.x + Math.cos(theta) * reach,
      y: TREE.baseY + yCenter + yNorm * radius * TREE.canopySquash,
      z: TREE.z + Math.sin(theta) * reach * 0.92 + zBias,
      yaw: 0,
      pitch: 0,
      sx: size,
      sy: size * (0.92 + (i % 3) * 0.03),
      sz: 1,
      color,
      phase: phase + (i % 5) * 0.03,
    });
  }
}

/**
 * One crown for both tiers. Closer cards are first so the depth test
 * rejects the shells behind them. No stacked glow quads.
 */
function buildBlossoms() {
  const petals = 26;
  const items: Item[] = [];
  const back = 64;
  const mid = 76;
  const front = 56;
  placeShell(items, front, TREE.canopyY + 0.06, TREE.canopyRadius * 0.8, 0.12, 5.3, BLOSSOM_WHITE, 0.28, 0.34);
  placeShell(items, mid, TREE.canopyY + 0.0, TREE.canopyRadius * 0.9, 0.0, 2.7, BLOSSOM_MIXED, 0.3, 0.36);
  placeShell(items, back, TREE.canopyY - 0.06, TREE.canopyRadius * 0.98, -0.1, 0.25, BLOSSOM_ROSE, 0.32, 0.38);
  const sprigs = 14;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < sprigs; i += 1) {
    const angle = golden * i * 2.4 + 0.4;
    const reach = TREE.canopyRadius * (1.0 + (i % 4) * 0.015);
    const lift = ((i % 5) - 2) * 0.07;
    const color = i % 2 === 0 ? BLOSSOM_WHITE[i % BLOSSOM_WHITE.length] : BLOSSOM_PINK[i % BLOSSOM_PINK.length];
    if (!color) continue;
    items.push({
      x: TREE.x + Math.cos(angle) * reach,
      y: TREE.baseY + TREE.canopyY + lift,
      z: TREE.z + Math.sin(angle) * reach * 0.9,
      yaw: 0,
      pitch: 0,
      sx: 0.15,
      sy: 0.17,
      sz: 1,
      color,
      phase: 6.4 + (i % 3) * 0.04,
    });
  }
  items.sort((a, b) => b.z - a.z);
  const canopyCount = items.length;
  for (let i = 0; i < petals; i += 1) {
    const angle = golden * i * 1.7;
    const radius = 0.18 + (i % 5) * 0.12;
    const color = i % 2 === 0 ? BLOSSOM_WHITE[i % BLOSSOM_WHITE.length] : BLOSSOM_PINK[i % BLOSSOM_PINK.length];
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
  return { scatter: toScatter(items), canopyCount };
}

function splitCount(total: number, nearShare: number) {
  const near = Math.max(4, Math.round(total * nearShare));
  return { near, mid: Math.max(4, total - near) };
}

export function buildLayout(quality: Quality): SceneLayout {
  const counts = countsFor(quality);
  const compact = quality === "low";
  const flowerClear = FLOWER_CLEAR;
  const lilySplit = splitCount(counts.lilies, 0.34);
  const daisySplit = splitCount(counts.daisies, 0.34);
  const lupinSplit = splitCount(counts.lupins, 0.34);
  const lilyScale: [number, number] = [0.26, 0.38];
  const daisyScale: [number, number] = [0.16, 0.26];
  const lupinScale: [number, number] = [0.46, 0.66];
  const nearZ = [4.05, 1.35] as const;
  const midZ = [3.85, 0.05] as const;
  const spread = false;
  const nearLilies = scatterFull(lilySplit.near, 11, nearZ[0], nearZ[1], lilyScale, flowerClear, spread, false, 0.92, 0.5, true);
  const midLilies = scatterFull(lilySplit.mid, 13, midZ[0], midZ[1], lilyScale, flowerClear, spread, false, 0.92, 0.5, true);
  const nearDaisies = scatterFull(daisySplit.near, 29, nearZ[0], nearZ[1], daisyScale, flowerClear, spread, false, 0, Math.PI * 2, true);
  const midDaisies = scatterFull(daisySplit.mid, 31, midZ[0], midZ[1], daisyScale, flowerClear, spread, false, 0, Math.PI * 2, true);
  const nearLupins = scatterFull(lupinSplit.near, 47, nearZ[0], nearZ[1], lupinScale, flowerClear, spread, true, 0, Math.PI * 2, true);
  const midLupins = scatterFull(lupinSplit.mid, 53, midZ[0], midZ[1], lupinScale, flowerClear, spread, true, 0, Math.PI * 2, true);
  fillTabletGap(midLilies, midDaisies, midLupins);
  fillButtonBand(midLilies, midDaisies, midLupins);
  const farScale = 0.46;
  const farLilyScale: [number, number] = [lilyScale[0] * farScale, lilyScale[1] * farScale];
  const farDaisyScale: [number, number] = [daisyScale[0] * farScale, daisyScale[1] * farScale];
  const farLupinScale: [number, number] = [lupinScale[0] * farScale, lupinScale[1] * farScale];
  const farLilies = scatterFull(counts.farLilies, 71, -1.9, -3.75, farLilyScale, flowerClear, spread, false, 0.92, 0.5);
  const farDaisies = scatterFull(counts.farDaisies, 73, -1.9, -3.75, farDaisyScale, flowerClear, spread, false, 0, Math.PI * 2);
  const farLupins = scatterFull(counts.farLupins, 79, -1.9, -3.75, farLupinScale, flowerClear, spread, true, 0, Math.PI * 2);
  const blossoms = buildBlossoms();

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
    const shade = 0.92 + grassRng() * 0.08;
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
      color: [(0.52 + warm * 0.1) * shade, (0.7 + (1 - warm) * 0.08) * shade, (0.24 + grassRng() * 0.05) * shade],
      phase: grassRng() * Math.PI * 2,
    });
  }

  const glowItems: Item[] = [];
  const glowLilies = [...nearLilies, ...midLilies]
    .filter((flower) => Math.abs(flower.x - pathCenterAt(flower.z)) > 1.05 && Math.abs(flower.x - pathCenterMid(flower.z)) > 0.55)
    .sort((a, b) => b.z - a.z)
    .slice(0, 8);
  for (const flower of glowLilies) {
    glowItems.push({
      ...flower,
      y: flower.sy * 0.92,
      sx: flower.sx * 0.2,
      sy: flower.sy * 0.2,
      sz: 1,
      color: [1, 0.98, 0.92],
    });
  }
  const cloudRng = mulberry32(7);
  const clouds: Item[] = [];
  const cloudSpots: [number, number, number][] = [
    [-6.2, 3.9, -6.5],
    [6.4, 3.95, -7],
    [-2.6, 4.5, -12.4],
    [2.9, 4.45, -12.8],
  ];
  const cloudSize: [number, number][] = [
    [4.0, 1.5],
    [4.0, 1.5],
    [3.2, 1.15],
    [3.2, 1.15],
  ];
  for (let i = 0; i < counts.clouds; i += 1) {
    const spot = cloudSpots[i % cloudSpots.length] ?? [-5, 4.6, -8];
    const size = cloudSize[i % cloudSize.length] ?? [3.4, 1.2];
    clouds.push({
      x: spot[0] + (cloudRng() - 0.5) * 0.12,
      y: spot[1] + cloudRng() * 0.08,
      z: spot[2],
      yaw: 0,
      pitch: 0,
      sx: size[0] + cloudRng() * 0.12,
      sy: size[1] + cloudRng() * 0.06,
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
    const size = 0.045 + sparkRng() * 0.04;
    let x = side * (edge + Math.pow(sparkRng(), 0.62) * reach);
    const clearOf = (center: number, gap: number) => {
      if (Math.abs(x - center) >= gap) return;
      x = center + (x >= center ? 1 : -1) * gap;
    };
    clearOf(pathCenterAt(z), 1.05);
    clearOf(pathCenterMid(z), 0.62);
    clearOf(pathCenterAt(z), 1.05);
    sparks.push({
      x,
      y: 0.42 + sparkRng() * (middle ? 0.55 : 0.7),
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
