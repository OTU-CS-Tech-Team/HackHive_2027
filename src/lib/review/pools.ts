// Seat pools for blind review. The placement itself happens in SQL
// (cast_review_vote in supabase/migrations/20261121000000_blind_review.sql);
// this is what the pages show and must match it.

export const POOLS = ["otu", "early", "general"] as const;
export type Pool = (typeof POOLS)[number];

export const POOL_LABELS: Record<Pool, string> = {
  otu: "OTU",
  early: "1st/2nd years",
  general: "General",
};

export type ReviewSettings = { seats: number; otu_pct: number; early_pct: number; general_pct: number };
export const DEFAULT_SETTINGS: ReviewSettings = { seats: 375, otu_pct: 30, early_pct: 15, general_pct: 55 };

/** Seats per pool. General gets the rest, so rounding never loses a seat. Same rule as cast_review_vote. */
export function poolTargets(settings: ReviewSettings): Record<Pool, number> {
  // Postgres round() on numeric rounds halves away from zero, like Math.round for positives.
  const otu = Math.round((settings.seats * Number(settings.otu_pct)) / 100);
  const early = Math.round((settings.seats * Number(settings.early_pct)) / 100);
  return { otu, early, general: Math.max(settings.seats - otu - early, 0) };
}

/** Year of study is saved as "1".."6"; 1st and 2nd years have their own pool. */
export const isEarlyYear = (year: string | null | undefined) => year === "1" || year === "2";

/** "#0427": how reviewers refer to an applicant. */
export const formatApplicantNo = (n: number) => `#${String(n).padStart(4, "0")}`;

export const VOTES = ["yes", "no", "skip"] as const;
export type Vote = (typeof VOTES)[number];
export const isVote = (value: unknown): value is Vote => typeof value === "string" && (VOTES as readonly string[]).includes(value);

export const VOTE_LABELS: Record<Vote, string> = { yes: "Yes", no: "No", skip: "Knows them (skipped)" };

export type Outcome = "accepted" | "waitlisted" | "rejected";

/** At most this many per release, so the emails finish inside one request. */
export const WAVE_LIMIT = 25;
