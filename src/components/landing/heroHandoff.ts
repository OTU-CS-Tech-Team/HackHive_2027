// Scroll progress is 0 at the top of the hero and 1 when the sticky stage
// releases. The meadow scene warms itself to solid cream from 0.7 and is
// fully cream by 0.84, which is the blank field in the late frames. We hold
// the value we hand it just short of that. The walk still plays, and the
// flowers stay until our veil and .dawn overlap.

export const TRACK = 1.45;
export const OVERLAP = 0.16;
export const VEIL_START = 0.75;
export const SCENE_HOLD = 0.69;
const COPY_FADE_START = 0.72;
const COPY_FADE_SPAN = 0.18;
const VEIL_SPAN = 0.4;
const FEATHER = 20;
const SCROLL_RANGE = TRACK - 1;

export function clamp01(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function sceneProgress(scroll: number) {
  return Math.min(clamp01(scroll), SCENE_HOLD);
}

// How much of the viewport .dawn covers at this scroll progress.
// 0 until its top crosses the bottom edge, then OVERLAP at progress 1.
export function dawnCoverage(scroll: number) {
  return Math.max(0, OVERLAP - SCROLL_RANGE * (1 - clamp01(scroll)));
}

// Clear until 0.75, and never while .dawn is still below the screen.
export function veilAmount(scroll: number) {
  if (dawnCoverage(scroll) <= 0) return 0;
  return smoothstep((clamp01(scroll) - VEIL_START) / VEIL_SPAN);
}

// 0 while the title group is fully present, 1 once it has left.
export function copyFade(scroll: number) {
  return smoothstep((clamp01(scroll) - COPY_FADE_START) / COPY_FADE_SPAN);
}

export const COPY_LIFT_VH = 14;

// Transparent through the mountains. A cream feather sits just above .dawn
// and meets its white top. The feather never reaches solid white, so the
// pixels directly above .dawn stay off the solid-white measurement.
export function veilBackground(scroll: number) {
  const t = veilAmount(scroll);
  if (t <= 0) return "rgba(255, 246, 234, 0)";
  const seam = (1 - dawnCoverage(scroll)) * 100;
  const fadeFrom = Math.max(0, seam - FEATHER);
  const mid = (fadeFrom + seam) / 2;
  const seamAlpha = (0.72 * t).toFixed(3);
  const midAlpha = (0.28 * t).toFixed(3);
  return [
    "linear-gradient(to bottom,",
    "rgba(255,246,234,0) 0%,",
    `rgba(255,246,234,0) ${fadeFrom.toFixed(2)}%,`,
    `rgba(255,250,242,${midAlpha}) ${mid.toFixed(2)}%,`,
    `rgba(255,252,247,${seamAlpha}) ${seam.toFixed(2)}%,`,
    "rgba(255,255,255,0.96) 100%)",
  ].join(" ");
}
