// Hive Mind tiers. The AI answers four yes/no checks and gives two ratings;
// turning those into an experience score, a total out of 15 and a tier is plain
// code here, so the rule is consistent, testable, and can be retuned without
// re-scoring anyone.

export const TIERS = ["larva", "worker", "queen"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  larva: "Monty (Weak Candidate)",
  worker: "Decent Candidate",
  queen: "Strong Candidate",
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

export type Ratings = { experience: number; creativity: number; quality: number };

/** Experience + creativity + quality, out of 15 (each is 1-5, so 3-15). */
export const totalScore = ({ experience, creativity, quality }: Ratings) => experience + creativity + quality;
export const MAX_TOTAL = 15;

/**
 * Lowest total for each tier, tuned on the first 55 applicants (about 20% larva,
 * 58% worker, 22% queen). Keep in sync with the SQL in
 * supabase/migrations/20261119000000_hive_tier_by_total.sql if they change.
 * The self-reported hackathon count is deliberately left out: anyone can type
 * "5", so it only breaks ties within a tier.
 */
export const TIER_CUTOFFS = { queen: 12, worker: 8 } as const;

export function suggestTier(ratings: Ratings): Tier {
  const total = totalScore(ratings);
  if (total >= TIER_CUTOFFS.queen) return "queen";
  if (total >= TIER_CUTOFFS.worker) return "worker";
  return "larva";
}

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}
