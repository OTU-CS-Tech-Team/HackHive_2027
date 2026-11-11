export type Quality = "low" | "high";

export type SceneCounts = {
  grass: number;
  lilies: number;
  daisies: number;
  lupins: number;
  farLilies: number;
  farDaisies: number;
  farLupins: number;
  clouds: number;
  sparks: number;
  dpr: number;
  antialias: boolean;
};

const COUNTS: Record<Quality, SceneCounts> = {
  high: {
    grass: 830,
    lilies: 180,
    daisies: 90,
    lupins: 110,
    farLilies: 72,
    farDaisies: 56,
    farLupins: 40,
    clouds: 7,
    sparks: 280,
    dpr: 1.25,
    antialias: false,
  },
  low: {
    grass: 480,
    lilies: 180,
    daisies: 90,
    lupins: 110,
    farLilies: 72,
    farDaisies: 56,
    farLupins: 40,
    clouds: 7,
    sparks: 140,
    dpr: 1,
    antialias: false,
  },
};

export function countsFor(quality: Quality): SceneCounts {
  switch (quality) {
    case "high":
      return COUNTS.high;
    case "low":
      return COUNTS.low;
    default: {
      const unknown: never = quality;
      return unknown;
    }
  }
}

/** Opt-in tier override (`?meadow=low|high`) so a weak machine can still show both scenes. */
export function readForcedQuality(search: string): Quality | null {
  const value = new URLSearchParams(search).get("meadow");
  if (value === "low" || value === "high") return value;
  return null;
}

/** Opt-in canvas scale (`?meadowDpr=0.5`) for fill-rate checks. Ignored when absent. */
export function readForcedDpr(search: string): number | null {
  const value = new URLSearchParams(search).get("meadowDpr");
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.25 || parsed > 2) return null;
  return parsed;
}

export function detectQuality(): Quality {
  if (typeof window === "undefined") return "high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const narrow = window.matchMedia("(max-width: 767px)").matches;
  let weakGpu = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return "low";
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "";
    weakGpu = /mali-|adreno \(tm\) [1-4]|microsoft basic render/i.test(renderer);
  } catch {
    weakGpu = true;
  }
  if (narrow || cores <= 4 || memory <= 4 || weakGpu) return "low";
  return "high";
}

export function webglAvailable() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
