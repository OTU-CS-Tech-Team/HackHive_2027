import { isOntarioTech } from "@/lib/schools";

// Seat targets for the Decisions page trackers. Change them here only.
// Display only: they show how close each pool is to its target and are never
// used to accept, reject or reorder anyone.
export const SEATS = 375;
export const POOL_TARGETS = {
  otu: 113, // Ontario Tech students
  lower_years: 56, // 1st and 2nd year students
  general: 206, // everyone else
} as const satisfies Record<string, number>;

export type Pool = keyof typeof POOL_TARGETS;
export const POOLS: readonly Pool[] = ["otu", "lower_years", "general"];
export const POOL_LABELS: Record<Pool, string> = {
  otu: "Ontario Tech",
  lower_years: "Lower years (1st & 2nd year)",
  general: "Everyone else",
};

/** year_of_study is "1".."5" (5 = 5th+) or "6" (graduate). */
export const isLowerYear = (year: string | null) => year === "1" || year === "2";

export type Accept = {
  id: string;
  university: string | null;
  year_of_study: string | null;
  /** Released (emailed or not); false = staged, not released yet. */
  sent: boolean;
  /** When the wave that accepted them went out; null for accepts from before waves (and for staged ones). */
  releasedAt: string | null;
  submittedAt: string | null;
  /** When the accept was staged (staged ones only). */
  stagedAt: string | null;
};

const byTime = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return Date.parse(a) - Date.parse(b);
};

/**
 * Acceptance order: released accepts first (accepts from before waves, then by
 * wave, oldest submission breaking ties), then staged accepts in the order they
 * were staged.
 */
export function compareAcceptance(a: Accept, b: Accept) {
  if (a.sent !== b.sent) return a.sent ? -1 : 1;
  const order = a.sent
    ? byTime(a.releasedAt, b.releasedAt) || byTime(a.submittedAt, b.submittedAt)
    : byTime(a.stagedAt, b.stagedAt);
  return order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Which pool each accept counts towards, walking them in acceptance order.
 * Ontario Tech students count towards the Ontario Tech pool, except that a 1st
 * or 2nd year one counts towards lower years once Ontario Tech is full (an
 * upper-year one keeps counting towards Ontario Tech past its target).
 */
export function assignPools(accepts: readonly Accept[]): Map<string, Pool> {
  const pools = new Map<string, Pool>();
  let otu = 0;
  for (const accept of accepts.toSorted(compareAcceptance)) {
    const lower = isLowerYear(accept.year_of_study);
    let pool: Pool;
    if (accept.university && isOntarioTech(accept.university)) {
      pool = lower && otu >= POOL_TARGETS.otu ? "lower_years" : "otu";
    } else {
      pool = lower ? "lower_years" : "general";
    }
    if (pool === "otu") otu++;
    pools.set(accept.id, pool);
  }
  return pools;
}

export type PoolTally = { sent: number; staged: number; target: number };

export function tallyPools(accepts: readonly Accept[]): Record<Pool, PoolTally> {
  const tally = Object.fromEntries(POOLS.map((pool) => [pool, { sent: 0, staged: 0, target: POOL_TARGETS[pool] }])) as Record<Pool, PoolTally>;
  const pools = assignPools(accepts);
  for (const accept of accepts) {
    tally[pools.get(accept.id)!][accept.sent ? "sent" : "staged"]++;
  }
  return tally;
}
