/** One light for the whole hero. Sky, fog, hills, and the ground all read these. */

export const SKY_TOP = "#e2f2f8";
export const SKY_MID = "#d7eef8";
export const HORIZON = "#f4e4b4";
export const SUN = "#fff6e2";
export const AMBIENT = "#e7f1ea";
export const GRASS_NEAR = "#4f8f3a";
export const GRASS_FAR = "#c6e4a4";
/** Warm dirt through the walk. Late progress warms this toward cream. */
export const PATH = "#c9964e";
export const PATH_EDGE = "#c4a06a";
export const HILL = "#c6e4a4";
/** Sponsors woods colour. The meadow no longer fades into it. */
export const FOREST = "#0b2419";
/** Light cream the late fog, hills, and path warm toward, under a white veil. */
export const HANDOFF = "#fff6ea";

/** Direction the light travels from (toward the sun), shared by every shader. */
export const SUN_DIR: readonly [number, number, number] = [0.46, 0.62, 0.34];

export const FOG_DENSITY = 0.02;

/** Shared by the canvas and the frame driver so the first frame matches the walk. */
export const VIEW = {
  fov: 46,
  eye: 1.12,
  startZ: 6.4,
  endZ: 1.85,
  lookAhead: 9.4,
  lookLift: -0.62,
} as const;

export function clamp01(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Closed through the walk. Starts warming at 0.7, fully cream by 0.84, so the
 * scene is already light when the white veil covers it.
 */
export function handoffVeil(progress: number) {
  return smoothstep((clamp01(progress) - 0.7) / 0.14);
}

export function fogDensityFor(progress: number) {
  return FOG_DENSITY * (1 + handoffVeil(progress) * 0.9);
}

export function windScale(progress: number, reduced: boolean) {
  if (reduced) return 0;
  return 1 - smoothstep((clamp01(progress) - 0.62) / 0.38) * 0.78;
}

export function walkBlend(progress: number) {
  return smoothstep(clamp01(progress));
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
