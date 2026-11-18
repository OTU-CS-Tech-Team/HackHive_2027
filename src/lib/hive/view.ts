import { PROMPT_VERSION } from "./prompt";
import { TIERS, totalScore, type Tier } from "./tier";

// How the admin pages read hive_scores rows. Pure, so the ordering is tested.

export type HiveScore = {
  application_id: string;
  status: "pending" | "scored" | "failed";
  built_it: boolean | null;
  shipped: boolean | null;
  impact: boolean | null;
  beyond_tutorial: boolean | null;
  experience: number | null;
  creativity: number | null;
  quality: number | null;
  rationale: string | null;
  flags: string[];
  suggested_tier: Tier | null;
  tier_override: Tier | null;
  override_reason: string | null;
  overridden_at: string | null;
  tier: Tier | null;
  model: string | null;
  prompt_version: number | null;
  attempts: number;
  error: string | null;
  scored_at: string | null;
};

export type TierChange = {
  id: number;
  application_id: string;
  from_tier: Tier | null;
  to_tier: Tier | null;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
};

/** The tier to show: an admin's override always counts; the AI's only once it finished scoring. */
export function displayTier(score: HiveScore | undefined): Tier | null {
  if (!score) return null;
  if (score.tier_override) return score.tier_override;
  return score.status === "scored" ? score.suggested_tier : null;
}

/** Not yet scored with the current prompt, so "Score now" will (re)grade them. */
export const needsScoring = (score: HiveScore | undefined) =>
  !score || score.status !== "scored" || score.prompt_version !== PROMPT_VERSION;

export type TierFilter = Tier | "unscored" | "all";
export const TIER_FILTERS: readonly TierFilter[] = ["all", ...TIERS, "unscored"];
export const isTierFilter = (value: unknown): value is TierFilter =>
  typeof value === "string" && (TIER_FILTERS as readonly string[]).includes(value);

const TIER_RANK: Record<Tier, number> = { queen: 0, worker: 1, larva: 2 };

type Sortable = {
  submitted_at: string | null;
  id: string;
  tier: Tier | null;
  hackathons_count?: number | null;
  score?: HiveScore;
};

/** Out of 15, or null until scored. */
export function scoreTotal(score: HiveScore | undefined): number | null {
  if (score?.status !== "scored" || score.experience === null || score.creativity === null || score.quality === null) {
    return null;
  }
  return totalScore({ experience: score.experience, creativity: score.creativity, quality: score.quality });
}

/**
 * Highest tier first, then highest total /15, then quality, then more
 * hackathons (tie-break only), then oldest submission.
 */
export function compareForReview(a: Sortable, b: Sortable) {
  const rank = (row: Sortable) => (row.tier ? TIER_RANK[row.tier] : 3);
  return (
    rank(a) - rank(b) ||
    (scoreTotal(b.score) ?? 0) - (scoreTotal(a.score) ?? 0) ||
    (b.score?.quality ?? 0) - (a.score?.quality ?? 0) ||
    (b.hackathons_count ?? 0) - (a.hackathons_count ?? 0) ||
    (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") ||
    a.id.localeCompare(b.id)
  );
}
