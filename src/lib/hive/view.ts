import { QUOTA_ERROR } from "./errors";
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
  attempts: number; // tries since the last success
  error: string | null; // on a scored row: the last re-score failed, the score shown is the earlier one
  claim_token: string | null;
  claimed_at: string | null; // set while a grading is running
  scored_at: string | null;
  updated_at: string;
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

/** Not yet scored with the current prompt. */
export const needsScoring = (score: HiveScore | undefined) =>
  !score || score.status !== "scored" || score.prompt_version !== PROMPT_VERSION;

// Match MAX_ATTEMPTS in score.ts and the 2 minutes in hive_backlog() / claim_hive_score().
const MAX_ATTEMPTS = 5;
const CLAIM_MS = 2 * 60_000;

/** A grading is running now (a claim older than 2 minutes was cut off, so it doesn't count). */
export const isScoring = (score: HiveScore | undefined, now: number) =>
  !!score?.claimed_at && now - Date.parse(score.claimed_at) < CLAIM_MS;

/** Failed 5 times in a row, so "Score now" skips them; Re-score still works. */
export const gaveUp = (score: HiveScore | undefined) => score?.status === "failed" && score.attempts >= MAX_ATTEMPTS;

/** What "Score now" will pick up: matches hive_backlog() in SQL. */
export const inBacklog = (score: HiveScore | undefined, now: number) =>
  needsScoring(score) && !gaveUp(score) && !isScoring(score, now);

/** OpenAI ran out of credits more recently than anything scored, so scoring is stalled until someone tops up. */
export function creditsRunOut(scores: HiveScore[]): boolean {
  let lastQuota = 0;
  let lastScored = 0;
  for (const score of scores) {
    if (score.error === QUOTA_ERROR) lastQuota = Math.max(lastQuota, Date.parse(score.updated_at));
    if (score.status === "scored" && !score.error && score.scored_at) lastScored = Math.max(lastScored, Date.parse(score.scored_at));
  }
  return lastQuota > lastScored;
}

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
