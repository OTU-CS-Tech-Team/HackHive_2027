/** One light for the whole hero. Sky, fog, hills, and the ground all read these. */

export const SKY_TOP = "#e2f2f8";
export const SKY_MID = "#d7eef8";
export const HORIZON = "#f4e4b4";
export const SUN = "#fff6e2";
export const AMBIENT = "#e7f1ea";
export const GRASS_NEAR = "#78a84a";
export const GRASS_FAR = "#b7d57a";
export const PATH = "#f4e0bc";
export const HILL = "#d5e4b4";

/** Direction the light travels from (toward the sun), shared by every shader. */
export const SUN_DIR: readonly [number, number, number] = [0.46, 0.62, 0.34];

export const FOG_DENSITY = 0.028;

export function clamp01(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** 0 through the walk, then a soft wash into the horizon so chapter 2 can cross-fade. */
export function handoffVeil(progress: number) {
  return smoothstep((clamp01(progress) - 0.56) / 0.44) * 0.4;
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
