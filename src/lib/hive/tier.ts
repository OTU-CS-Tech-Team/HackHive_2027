// Hive Mind tiers. The AI answers four yes/no checks and gives ratings; turning
// those into an experience score and a tier is plain code here, so the rule is
// consistent, testable, and can be retuned without re-scoring anyone.

export const TIERS = ["larva", "worker", "queen"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  larva: "Larva",
  worker: "Worker Bee",
  queen: "Queen Bee",
};

export const TIER_EMOJI: Record<Tier, string> = {
  larva: "🐛",
  worker: "🐝",
  queen: "👑",
};

/** The four checks on the "most proud of" answer. */
export type ExperienceChecks = {
  builtIt: boolean; // built it themselves
  shipped: boolean; // finished or shipped
  impact: boolean; // real users, a win, or an internship build
  beyondTutorial: boolean; // real work beyond a tutorial
};

export type Rating = 1 | 2 | 3 | 4 | 5;

/** 1 + checks passed: all four = 5, two = 3, none (tutorial level) = 1. */
export function experienceScore(checks: ExperienceChecks): Rating {
  const passed = [checks.builtIt, checks.shipped, checks.impact, checks.beyondTutorial].filter(Boolean).length;
  return (1 + passed) as Rating;
}

/**
 * Starting rule from the selection plan; the highest matching tier wins.
 *   Queen Bee   experience 4-5, or 5+ hackathons
 *   Worker Bee  experience 3,   or 2-4 hackathons
 *   Larva       everything else (0-1 hackathons and experience 1-2)
 * A missing hackathon count counts as 0.
 */
export function suggestTier(experience: Rating, hackathons: number | null | undefined): Tier {
  const count = hackathons ?? 0;
  if (experience >= 4 || count >= 5) return "queen";
  if (experience === 3 || count >= 2) return "worker";
  return "larva";
}

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}
