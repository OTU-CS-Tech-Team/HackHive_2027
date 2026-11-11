import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { hexToRgb } from "@/components/landing/meadow/palette";
import type { Quality } from "@/components/landing/meadow/quality";
import { countsFor } from "@/components/landing/meadow/quality";
import { TREE, TREE_LIMBS, type LimbPoint } from "@/components/landing/meadow/tree";

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

/** Half the painted dirt. Flowers inside this are standing on the path. */
function dirtLimit(z: number, aspect: number) {
  const narrow = 1 - smooth01(0.62, 1.15, Math.max(aspect, 0.3));
  const base = 1.05 * (1 - narrow) + 0.42 * narrow;
  const half = base * (1 - 0.38 * pathEaseAt(z));
  return half * 0.92 + 0.16;
}

function onAnyPath(x: number, z: number) {
  const aspects = [1.6, 0.75, 0.46];
  for (const aspect of aspects) {
    if (Math.abs(x - centerFor(z, anchorFor(aspect))) < dirtLimit(z, aspect)) return true;
  }
  return false;
}

/**
 * Mid flowers in the open lawn left of every path. The wide dirt sits
 * well to the right here, so this band is grass at 1280, 768, and 390.
 */
function fillLeftLawn(lilies: Item[], daisies: Item[], lupins: Item[]) {
  const rng = mulberry32(1401);
  const count = 16;
  for (let i = 0; i < count; i += 1) {
    const z = 0.95 + (i % 8) * 0.17 + (rng() - 0.5) * 0.04;
    let x = -0.22 - Math.floor(i / 8) * 0.42 - rng() * 0.1;
    for (let step = 0; step < 5 && onAnyPath(x, z); step += 1) x -= 0.14;
    if (onAnyPath(x, z)) continue;
    const visible = Math.max(0.45, 1.3 - z * 0.191);
    if (x < -visible * 0.92) continue;
    if (i % 5 === 0) {
      const tint = paint(rng, true);
      const size = 0.46 + rng() * 0.1;
      placeFlower(lupins, rng, x, 0.02, z, size, size, tint.color, tint.tip, 0, Math.PI * 2);
    } else if (i % 2 === 0) {
      const size = 0.26 + rng() * 0.08;
      placeFlower(lilies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0.4, 0.4);
    } else {
      const size = 0.16 + rng() * 0.06;
      placeFlower(daisies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0, Math.PI * 2);
    }
  }
}

/**
 * The bed right of the phone path, in front of the far tree. Short lilies
 * and daisies sit by the dirt; short lupins stand among them so the right
 * side has the same colour as the left garden. The lupins stay low enough
 * to pass under the phone crown. z stays in the mid patch.
 */
function fillTreeFoot(lilies: Item[], daisies: Item[], lupins: Item[]) {
  const rng = mulberry32(1601);
  const aspect = 0.46;
  const narrow = 1 - smooth01(0.62, 1.15, aspect);
  const base = 1.05 * (1 - narrow) + 0.42 * narrow;
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const z = 1.7 + i * 0.1 + (rng() - 0.5) * 0.03;
    const center = centerFor(z, anchorFor(aspect));
    const half = base * (1 - 0.38 * pathEaseAt(z));
    const x = center + half * 0.58 + (i % 3) * 0.04;
    const size = 0.24 + rng() * 0.04;
    if (i % 2 === 0) {
      placeFlower(lilies, rng, x, 0.02, z, size, size * 0.9, [1, 1, 1], undefined, 0.15, 0.2);
    } else {
      placeFlower(daisies, rng, x, 0.02, z, size * 0.85, size * 0.85, [1, 1, 1], undefined, 0, Math.PI * 2);
    }
  }
  // Short lupins (under 0.32, so the shaders leave them on the right
  // grass) fill the open lawn between the dirt and the frame edge.
  const spikes = 8;
  for (let i = 0; i < spikes; i += 1) {
    const z = 1.3 + i * 0.11 + (rng() - 0.5) * 0.05;
    const center = centerFor(z, anchorFor(aspect));
    const half = base * (1 - 0.38 * pathEaseAt(z));
    const x = center + half * (0.62 + (i % 3) * 0.22);
    const tint = paint(rng, true);
    const size = 0.26 + rng() * 0.05;
    placeFlower(lupins, rng, x, 0.02, z, size, size, tint.color, tint.tip, 0, Math.PI * 2);
  }
}

/**
 * White flowers in the strip beside the wide dirt. The band stays narrow so
 * the open lawn left of the tablet path, which fillTabletLawn plants, is
 * not pulled away.
 */
function onLeftShoulder(flower: Item) {
  const center = pathCenterAt(flower.z);
  const gap = center - flower.x;
  return gap > 0.05 && gap < dirtLimit(flower.z, 1.6) + 0.75;
}

/**
 * That border was one white row. Most of those blooms trade with a lupin
 * that sits deeper in the bed, so a coloured spike takes the shoulder and
 * the white flower steps back. One in six stays, which keeps lilies and
 * daisies in the mix.
 */
function mixHedge(lilies: Item[], daisies: Item[], lupins: Item[]) {
  const rng = mulberry32(1901);
  const white = [...lilies, ...daisies].filter(onLeftShoulder);
  white.sort((a, b) => b.z - a.z);
  const used = new Set<Item>();
  white.forEach((flower, index) => {
    if (index % 6 === 0) return;
    const flowerGap = pathCenterAt(flower.z) - flower.x;
    let partner: Item | undefined;
    let best = 99;
    for (const lupin of lupins) {
      if (used.has(lupin)) continue;
      const center = pathCenterAt(lupin.z);
      const gap = center - lupin.x;
      if (gap < flowerGap + 0.55) continue;
      const score = Math.abs(lupin.z - flower.z);
      if (score < best) {
        best = score;
        partner = lupin;
      }
    }
    if (!partner || best > 1.8) return;
    used.add(partner);
    const x = flower.x;
    const z = flower.z;
    const sy = flower.sy;
    flower.x = partner.x;
    flower.z = partner.z;
    partner.x = x;
    partner.z = z;
    const tall = index % 2 === 0;
    partner.sy = sy * (tall ? 1.5 + rng() * 0.45 : 0.85 + rng() * 0.3);
    partner.sx = Math.max(partner.sx, sy * (0.55 + rng() * 0.3));
  });
}

/**
 * The open grass between the left garden and the tablet path, mid-frame
 * at 768. Mixed heights, and off the dirt at 1280 and 390 as well.
 */
function fillTabletLawn(lilies: Item[], daisies: Item[], lupins: Item[]) {
  const rng = mulberry32(1801);
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const z = 1.05 + (i % 7) * 0.16 + (rng() - 0.5) * 0.04;
    const center = pathCenterMid(z);
    let x = center - dirtLimit(z, 0.75) - 0.14 - Math.floor(i / 7) * 0.26 - rng() * 0.08;
    if (onAnyPath(x, z)) x -= 0.2;
    if (onAnyPath(x, z)) continue;
    if (i % 3 === 0) {
      const tint = paint(rng, true);
      const size = 0.44 + rng() * 0.14;
      placeFlower(lupins, rng, x, 0.02, z, size, size, tint.color, tint.tip, 0, Math.PI * 2);
    } else if (i % 3 === 1) {
      const size = 0.24 + rng() * 0.08;
      placeFlower(lilies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0.35, 0.4);
    } else {
      const size = 0.15 + rng() * 0.06;
      placeFlower(daisies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0, Math.PI * 2);
    }
  }
}

/** Lilies and daisies just past the right edge of the wide dirt. */
function fillRightShoulder(lilies: Item[], daisies: Item[]) {
  const rng = mulberry32(1701);
  const count = 26;
  for (let i = 0; i < count; i += 1) {
    const z = 1.15 + (i % 6) * 0.22 + (rng() - 0.5) * 0.04;
    const x = pathCenterAt(z) + dirtLimit(z, 1.6) + 0.16 + (i % 2) * 0.14 + rng() * 0.06;
    const size = 0.22 + rng() * 0.08;
    if (i % 2 === 0) {
      placeFlower(lilies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0.35, 0.35);
    } else {
      placeFlower(daisies, rng, x, 0.02, z, size * 0.8, size * 0.8, [1, 1, 1], undefined, 0, Math.PI * 2);
    }
  }
}

/** A few mid flowers in the grass just off the wide path, behind the button. */
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

/**
 * Flowers that only belong in a wide frame carry this in their phase. The
 * shaders drop an instance whose phase is past WIDE_ONLY below aspect
 * 1.15, and past NOT_PHONE below aspect 0.6, so a narrow frame does not
 * pull them onto its edge. Sway only uses the phase in a sine, so the
 * offset does not change how a flower moves.
 */
export const WIDE_ONLY = 100;
export const NOT_PHONE = 200;
/** The reverse: only a phone (aspect below 0.6) draws these. */
export const PHONE_ONLY = 300;

/**
 * The bed right of the phone path, from the tree down to the near frame.
 * A phone has no room there inside the frame, so these sit on the frame
 * edge and parkOffPath walks them out beside the dirt, where the frame crops
 * them like a border. They stay short (daisies and lilies under 0.24, lupins
 * under 0.32) so the phone tree clearing leaves them on the right.
 */
function fillPhoneRight(lilies: Item[], daisies: Item[], lupins: Item[]) {
  const rng = mulberry32(3301);
  const count = 22;
  for (let i = 0; i < count; i += 1) {
    const z = 1.6 + (i / (count - 1)) * 2.5 + (rng() - 0.5) * 0.08;
    const x = visibleHalf(z, 0.46) * (0.9 + rng() * 0.06);
    // Lupins only up by the tree: further down the tree clearing would
    // slide a spike to the left bed.
    const roll = z < 2.3 ? i % 4 : 1 + (i % 2) * 2;
    let list: Item[];
    if (roll === 0 || roll === 2) {
      const tint = paint(rng, true);
      const size = 0.25 + rng() * 0.05;
      placeFlower(lupins, rng, x, 0.02, z, size, size, tint.color, tint.tip, 0, Math.PI * 2);
      list = lupins;
    } else if (roll === 1) {
      const size = 0.17 + rng() * 0.05;
      placeFlower(daisies, rng, x, 0.02, z, size, size, [1, 1, 1], undefined, 0, Math.PI * 2);
      list = daisies;
    } else {
      const size = 0.2 + rng() * 0.03;
      placeFlower(lilies, rng, x, 0.02, z, size, size * 0.9, [1, 1, 1], undefined, 0.15, 0.2);
      list = lilies;
    }
    list[list.length - 1].phase += PHONE_ONLY;
  }
}

/** The trunk of the wide tree. The garden leaves it a clear foot. */
const WIDE_TRUNK_X = TREE.x + TREE.shiftWide;

/**
 * The lawn behind and beside the front beds, out to the frame at 1920
 * wide. Rows of jittered spots, in drifts of one colour family so it reads
 * as planted beds and not confetti. Past z -1.6 the flowers join the far
 * specks; nearer, they use the mid meshes. In front of the path's end
 * (z 0.35) only the outer lawns are planted, well clear of every path.
 * Spots a tablet or phone never sees, and the band behind the copy on a
 * narrow screen, are tagged so those frames skip them. The low tier
 * leaves the wide-only spots out.
 */
function fillGarden(
  mid: { lilies: Item[]; daisies: Item[]; lupins: Item[] },
  far: { lilies: Item[]; daisies: Item[]; lupins: Item[] },
  compact: boolean,
) {
  const rng = mulberry32(2411);
  const rowStep = 0.26;
  const colStep = 0.3;
  const z0 = -3.85;
  const z1 = 1.65;
  for (let z = z0; z <= z1; z += rowStep) {
    const edge = frameHalf(z, 1.6) * 1.12;
    for (let x = -edge; x <= edge; x += colStep) {
      const fz = z + (rng() - 0.5) * rowStep * 0.9;
      const fx = x + (rng() - 0.5) * colStep * 0.9;
      const drift = Math.sin(fx * 0.9 + 1.3) * Math.cos(fz * 1.1 - 0.4) + (rng() - 0.5) * 0.7;
      if (rng() < 0.1) continue;
      // Thin the back rows unevenly, so the meadow breaks up toward the hills.
      const thin = Math.min(1, Math.max(0, (-fz - 1.4) / 2.4));
      if (rng() < thin * 0.38 * (0.6 + 0.8 * Math.max(0, Math.sin(fx * 1.7 + fz * 2.3)))) continue;
      if (Math.abs(fx) > frameHalf(fz, 1.6) * 1.12) continue;
      // The path has faded out under the tree by z 0.3. In front of that,
      // only the outer lawns, a full stride from any path.
      if (fz > 0.3) {
        if (onAnyPath(fx, fz)) continue;
        const outerLeft = fx < -1.2 && fx < pathCenterMid(fz) - 1.5;
        const outerRight = fx > WIDE_TRUNK_X + 0.9;
        if (!outerLeft && !outerRight) continue;
      }
      // Keep the wide trunk standing in grass.
      if (Math.abs(fx - WIDE_TRUNK_X) < 0.45 && fz > 0.1 && fz < 1.7) continue;
      const tabletSees = Math.abs(fx) < visibleHalf(fz, 0.75) * 0.96;
      const phoneSees = Math.abs(fx) < visibleHalf(fz, 0.46) * 0.96;
      // On a tablet or phone, the lawn straight ahead sits behind the copy.
      const behindCopy = fz < -0.4 && Math.abs(fx - 0.25) < 1.25;
      let tag = 0;
      if (!tabletSees || behindCopy) tag = WIDE_ONLY;
      else if (!phoneSees) tag = NOT_PHONE;
      const kind = drift > 0.28 ? "lupin" : drift < -0.3 ? "lily" : "daisy";
      const isFar = fz < -1.6;
      const shrink = isFar ? 0.7 : 0.86 - Math.max(0, -fz) * 0.08;
      const target = isFar ? far : mid;
      const list = kind === "lupin" ? target.lupins : kind === "lily" ? target.lilies : target.daisies;
      if (kind === "lupin") {
        const tint = paint(rng, true);
        // Past the beds the spikes vary a lot in height, so the back row
        // isn't a picket fence: mostly short, the odd tall one.
        const spread = rng();
        const back = Math.min(1, Math.max(0, (-fz - 0.6) / 2.6));
        const reach = 1 - back * 0.5 + back * spread * spread * 0.9;
        const size = (0.46 + rng() * 0.2) * shrink * reach;
        placeFlower(list, rng, fx, 0.02, fz, size, size * (1 - back * 0.25 + back * spread * 0.35), tint.color, tint.tip, 0, Math.PI * 2);
      } else if (kind === "lily") {
        const size = (0.26 + rng() * 0.12) * shrink;
        placeFlower(list, rng, fx, 0.02, fz, size, size, [1, 1, 1], undefined, 0.6, 0.6);
      } else {
        const size = (0.17 + rng() * 0.09) * shrink;
        placeFlower(list, rng, fx, 0.02, fz, size, size, [1, 1, 1], undefined, 0, Math.PI * 2);
      }
      // Placed, then dropped, so both tiers draw the same random sequence.
      if (compact && tag === WIDE_ONLY) list.pop();
      else {
        const placed = list[list.length - 1];
        if (placed) placed.phase += tag;
      }
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

/**
 * Where the crown opens up: a notch low on the shade side that reaches the
 * inner shell, so the limbs show, and two shallow bites in the sunlit
 * outline that only thin the outer shells.
 */
const CROWN_GAPS: { dir: [number, number, number]; reach: number; deep: boolean }[] = [
  { dir: [-0.78, -0.42, 0.46], reach: 0.9, deep: true },
  { dir: [0.5, 0.72, 0.48], reach: 0.93, deep: false },
  { dir: [0.9, -0.1, 0.42], reach: 0.95, deep: false },
];

function inCrownGap(x: number, y: number, z: number, inner: boolean) {
  const length = Math.hypot(x, y, z) || 1;
  return CROWN_GAPS.some((gap) => (gap.deep || !inner) && (x * gap.dir[0] + y * gap.dir[1] + z * gap.dir[2]) / length > gap.reach);
}

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
    if (inCrownGap(Math.cos(theta) * ring, yNorm, Math.sin(theta) * ring, radius < TREE.canopyRadius * 0.6)) continue;
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

/** Point on a limb at height y, or null when the limb never reaches it. */
function limbAt(limb: LimbPoint[], y: number) {
  for (let i = 0; i < limb.length - 1; i += 1) {
    const a = limb[i];
    const b = limb[i + 1];
    if (!a || !b || y < a.y || y > b.y) continue;
    const t = (y - a.y) / Math.max(b.y - a.y, 1e-4);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  }
  return null;
}

/**
 * Blossom clusters that hang off each limb below the cloud, so the bark
 * runs up into flowers instead of stopping under a floating crown.
 */
function hangOnLimbs(items: Item[]) {
  const rng = mulberry32(2207);
  const heights = [0.74, 0.82, 0.9, 0.97];
  TREE_LIMBS.forEach((limb, li) => {
    heights.forEach((h, hi) => {
      const at = limbAt(limb, h);
      if (!at) return;
      const cards = hi === 0 ? 2 : hi === 1 ? 3 : 4;
      for (let c = 0; c < cards; c += 1) {
        const angle = rng() * Math.PI * 2;
        const spread = 0.04 + rng() * 0.06;
        const palette = (li + hi + c) % 3 === 0 ? BLOSSOM_PINK : (li + c) % 2 === 0 ? BLOSSOM_WHITE : BLOSSOM_MIXED;
        const color = palette[Math.floor(rng() * palette.length)] ?? BLOSSOM_PINK[0];
        if (!color) continue;
        const size = 0.17 + rng() * 0.07;
        items.push({
          x: TREE.x + at.x + Math.cos(angle) * spread,
          y: TREE.baseY + h - 0.03 - rng() * 0.06,
          z: TREE.z + at.z + Math.sin(angle) * spread * 0.8,
          yaw: 0,
          pitch: 0,
          sx: size,
          sy: size * 0.96,
          sz: 1,
          color,
          phase: 7.1 + li * 0.07 + c * 0.02,
        });
      }
    });
  });
}

/**
 * One crown for both tiers. Closer cards are first so the depth test
 * rejects the shells behind them. No stacked glow quads.
 */
function buildBlossoms() {
  const petals = 26;
  const items: Item[] = [];
  const core = 40;
  const back = 72;
  const mid = 86;
  const front = 64;
  placeShell(items, core, TREE.canopyY + 0.02, TREE.canopyRadius * 0.48, 0.02, 1.1, BLOSSOM_MIXED, 0.18, 0.24);
  placeShell(items, front, TREE.canopyY + 0.03, TREE.canopyRadius * 0.78, 0.08, 5.3, BLOSSOM_WHITE, 0.22, 0.28);
  placeShell(items, mid, TREE.canopyY, TREE.canopyRadius * 0.92, 0.0, 2.7, BLOSSOM_MIXED, 0.24, 0.3);
  placeShell(items, back, TREE.canopyY - 0.02, TREE.canopyRadius * 1.0, -0.05, 0.25, BLOSSOM_ROSE, 0.26, 0.32);
  const sprigs = 18;
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
      sx: 0.16,
      sy: 0.17,
      sz: 1,
      color,
      phase: 6.4 + (i % 3) * 0.04,
    });
  }
  hangOnLimbs(items);
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
  fillLeftLawn(midLilies, midDaisies, midLupins);
  fillTabletLawn(midLilies, midDaisies, midLupins);
  fillTreeFoot(midLilies, midDaisies, midLupins);
  fillRightShoulder(midLilies, midDaisies);
  mixHedge(nearLilies, nearDaisies, nearLupins);
  mixHedge(midLilies, midDaisies, midLupins);
  // After the hedge swap, so no tagged bloom trades places with a lupin.
  fillPhoneRight(midLilies, midDaisies, midLupins);
  const farScale = 0.46;
  const farLilyScale: [number, number] = [lilyScale[0] * farScale, lilyScale[1] * farScale];
  const farDaisyScale: [number, number] = [daisyScale[0] * farScale, daisyScale[1] * farScale];
  const farLupinScale: [number, number] = [lupinScale[0] * farScale, lupinScale[1] * farScale];
  const farLilies = scatterFull(counts.farLilies, 71, -1.9, -3.75, farLilyScale, flowerClear, spread, false, 0.92, 0.5);
  const farDaisies = scatterFull(counts.farDaisies, 73, -1.9, -3.75, farDaisyScale, flowerClear, spread, false, 0, Math.PI * 2);
  const farLupins = scatterFull(counts.farLupins, 79, -1.9, -3.75, farLupinScale, flowerClear, spread, true, 0, Math.PI * 2);
  fillGarden({ lilies: midLilies, daisies: midDaisies, lupins: midLupins }, { lilies: farLilies, daisies: farDaisies, lupins: farLupins }, compact);
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
      // The clump is modelled in proportion, so it scales evenly: slim,
      // pointed blades whose arch stays as tall as it is wide.
      sx: height * (0.85 + grassRng() * 0.35),
      sy: height,
      sz: height * (0.85 + grassRng() * 0.35),
      color: [(0.52 + warm * 0.1) * shade, (0.7 + (1 - warm) * 0.08) * shade, (0.24 + grassRng() * 0.05) * shade],
      phase: grassRng() * Math.PI * 2,
    });
  }

  const glowItems: Item[] = [];
  const glowLilies = [...nearLilies, ...midLilies]
    .filter((flower) => flower.phase < WIDE_ONLY)
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
  // Big ones up front, one over the open sky in the middle, a pair behind,
  // and two faint ones among the peaks (the ranges cover their feet).
  const cloudSpots: [number, number, number][] = [
    [-6.4, 3.85, -6.5],
    [6.6, 3.95, -7],
    [0.4, 4.75, -9.5],
    [-2.8, 4.45, -12.4],
    [3.4, 4.35, -12.8],
    [-11, 6.4, -30],
    [13, 7.6, -42],
  ];
  const cloudSize: [number, number][] = [
    [4.4, 1.9],
    [4.0, 1.75],
    [2.6, 1.15],
    [3.0, 1.3],
    [2.8, 1.2],
    [8.5, 3.2],
    [9.5, 3.4],
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
