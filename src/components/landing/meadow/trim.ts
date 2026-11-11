export type TrimKind = "grass" | "flower" | "mid" | "far" | "tree" | "other";
export type TrimLevel = 0 | 1 | 2 | 3;

/**
 * Trim 1 halves grass. Trim 2 and 3 quarter it. Flowers, including the mid
 * and far bands and the crown, stay at the full count. The cheaper meshes
 * are the only saving on those flowers.
 */
export function trimmedInstances(full: number, kind: TrimKind, level: TrimLevel) {
  if (level === 0) return full;
  switch (kind) {
    case "grass": {
      const fraction = level === 1 ? 0.5 : 0.25;
      return Math.min(full, Math.max(4, Math.floor(full * fraction)));
    }
    case "mid":
    case "far":
    case "flower":
    case "tree":
    case "other":
      return full;
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
}

/** Sparks halve on the first trim and drop further on the second. Later trims stay there. */
export function trimmedSparks(full: number, level: TrimLevel) {
  if (level === 0) return full;
  const fraction = level === 1 ? 0.5 : 0.25;
  return Math.max(8, Math.floor(full * fraction));
}

/** `?meadowTrim=` is a development hook. Production builds ignore it. */
export function readForcedTrim(search: string, env = process.env.NODE_ENV): TrimLevel {
  if (env === "production") return 0;
  const value = new URLSearchParams(search).get("meadowTrim");
  if (value === "1") return 1;
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 0;
}
