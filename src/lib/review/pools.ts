// Seat pools for blind review. Placement and seat counts happen in SQL
// (cast_review_vote / review_pool_counts in
// supabase/migrations/20261121000000_blind_review.sql); this is what the pages
// show. Pool keys and labels match the Decisions page.

export const POOLS = ["otu", "lower_years", "general"] as const;
export type Pool = (typeof POOLS)[number];
export const isPool = (value: unknown): value is Pool => typeof value === "string" && (POOLS as readonly string[]).includes(value);

export const POOL_LABELS: Record<Pool, string> = {
  otu: "Ontario Tech",
  lower_years: "Lower years (1st & 2nd year)",
  general: "Everyone else",
};

/** "#0427": how reviewers refer to an applicant. */
export const formatApplicantNo = (n: number) => `#${String(n).padStart(4, "0")}`;

export const VOTES = ["yes", "no", "skip"] as const;
export type Vote = (typeof VOTES)[number];
export const isVote = (value: unknown): value is Vote => typeof value === "string" && (VOTES as readonly string[]).includes(value);

export const VOTE_LABELS: Record<Vote, string> = { yes: "Yes", no: "No", skip: "Knows them (skipped)" };

export type Outcome = "accepted" | "waitlisted" | "rejected";
