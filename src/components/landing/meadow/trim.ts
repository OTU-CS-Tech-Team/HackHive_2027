export type TrimKind = "grass" | "flower" | "other";
export type TrimLevel = 0 | 1 | 2;

/** Trim 1 halves grass. Trim 2 quarters it. Flowers stay at the full count both times. */
export function trimmedInstances(full: number, kind: TrimKind, level: TrimLevel) {
  if (level === 0) return full;
  switch (kind) {
    case "grass": {
      const fraction = level === 1 ? 0.5 : 0.25;
      return Math.min(full, Math.max(4, Math.floor(full * fraction)));
    }
    case "flower":
    case "other":
      return full;
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
}

/** Sparks halve on the first trim and drop further on the second. */
export function trimmedSparks(full: number, level: TrimLevel) {
  if (level === 0) return full;
  const fraction = level === 1 ? 0.5 : 0.25;
  return Math.max(8, Math.floor(full * fraction));
}

export function readForcedTrim(search: string): TrimLevel {
  const value = new URLSearchParams(search).get("meadowTrim");
  if (value === "1") return 1;
  if (value === "2") return 2;
  return 0;
}
