import { POOLS, type Pool } from "@/lib/review/pools";

// Seat trackers on the Decisions page. Targets come from review_settings (the
// same row blind review places people by), and the counting matches
// review_pool_counts() in supabase/migrations/20261123000000_review_decisions.sql:
// - a blind review placement keeps its pool;
// - anyone else accepted by hand is slotted in by the review rule: Ontario
//   Tech if it has room, else lower years if they're 1st/2nd year and it has
//   room, else everyone else (even past its target).

export type PoolTargets = Record<Pool, number>;

/** review_settings columns, as a Pool-keyed record. */
export const targetsFrom = (row: { otu_seats: number; lower_years_seats: number; general_seats: number }): PoolTargets => ({
  otu: row.otu_seats,
  lower_years: row.lower_years_seats,
  general: row.general_seats,
});

export const totalSeats = (targets: PoolTargets) => POOLS.reduce((sum, pool) => sum + targets[pool], 0);

// Same spellings as review_is_otu() in SQL, so both count the same people.
const OTU_NAMES = new Set(["ontariotechuniversity", "ontariotech", "ontariotechu", "otu", "uoit", "universityofontarioinstituteoftechnology"]);
export const isOtu = (university: string | null) => !!university && OTU_NAMES.has(university.toLowerCase().replace(/[^a-z]/g, ""));

/** year_of_study is "1".."5" (5 = 5th+) or "6" (graduate). */
export const isLowerYear = (year: string | null) => year?.trim() === "1" || year?.trim() === "2";

/** sent: released. staged: staged, not released. review: placed by blind review, nothing staged yet. */
export type AcceptState = "sent" | "staged" | "review";

export type Accept = {
  id: string;
  university: string | null;
  year_of_study: string | null;
  state: AcceptState;
  /** The pool blind review placed them in, if it did. */
  reviewPool: Pool | null;
  submittedAt: string | null;
  /** When the accept was staged (staged ones only). */
  stagedAt: string | null;
};

const byTime = (a: string | null, b: string | null, nulls: "first" | "last") => {
  if (a === b) return 0;
  if (a === null) return nulls === "first" ? -1 : 1;
  if (b === null) return nulls === "first" ? 1 : -1;
  return Date.parse(a) - Date.parse(b);
};

/** Order hand accepts are slotted in: released (oldest submission first), then staged in staging order. */
export function compareAcceptance(a: Accept, b: Accept) {
  return (
    byTime(a.stagedAt, b.stagedAt, "first") || byTime(a.submittedAt, b.submittedAt, "last") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Which pool each accept counts towards. */
export function assignPools(accepts: readonly Accept[], targets: PoolTargets): Map<string, Pool> {
  const pools = new Map<string, Pool>();
  const filled: Record<Pool, number> = { otu: 0, lower_years: 0, general: 0 };
  for (const accept of accepts) {
    if (!accept.reviewPool) continue;
    pools.set(accept.id, accept.reviewPool);
    filled[accept.reviewPool]++;
  }
  for (const accept of accepts.filter((row) => !row.reviewPool).toSorted(compareAcceptance)) {
    let pool: Pool = "general";
    if (isOtu(accept.university) && filled.otu < targets.otu) pool = "otu";
    else if (isLowerYear(accept.year_of_study) && filled.lower_years < targets.lower_years) pool = "lower_years";
    filled[pool]++;
    pools.set(accept.id, pool);
  }
  return pools;
}

export type PoolTally = Record<AcceptState, number> & { target: number };

export function tallyPools(accepts: readonly Accept[], targets: PoolTargets): Record<Pool, PoolTally> {
  const tally = Object.fromEntries(POOLS.map((pool) => [pool, { sent: 0, staged: 0, review: 0, target: targets[pool] }])) as Record<Pool, PoolTally>;
  const pools = assignPools(accepts, targets);
  for (const accept of accepts) tally[pools.get(accept.id)!][accept.state]++;
  return tally;
}
