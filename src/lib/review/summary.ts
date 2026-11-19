import "server-only";

import { loadAllByKeyset } from "@/lib/admin/applicants";
import type { createClient } from "@/lib/supabase/server";
import { TIERS, isTier, type Tier } from "@/lib/hive/tier";
import { POOLS, isPool, type Outcome, type Pool } from "./pools";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PAGE_SIZE = 1000;

export type OutcomeRow = {
  application_id: string;
  outcome: Outcome;
  pool: Pool | null;
  waitlist_position: number | null;
  decided_at: string;
};

export type PoolCount = { pool: Pool; count: number; target: number };

export type PoolStats = {
  pools: PoolCount[];
  waitlisted: number;
  rejected: number;
};

/**
 * Seats taken per pool, from review_pool_counts() (the same numbers voting
 * places people by, including anyone accepted by hand). Null if it fails.
 */
export async function loadPoolCounts(session: Supabase): Promise<PoolCount[] | null> {
  const { data, error } = await session.rpc("review_pool_counts");
  if (error || !data) return null;
  const rows = data as { pool: string; filled: number; target: number }[];
  return POOLS.map((pool) => {
    const row = rows.find((candidate) => isPool(candidate.pool) && candidate.pool === pool);
    return { pool, count: row?.filled ?? 0, target: row?.target ?? 0 };
  });
}

export function loadOutcomes(session: Supabase) {
  return loadAllByKeyset<OutcomeRow>(
    (after) => {
      const query = session
        .from("review_outcomes")
        .select("application_id, outcome, pool, waitlist_position, decided_at")
        .order("application_id")
        .limit(PAGE_SIZE);
      return after ? query.gt("application_id", after) : query;
    },
    { key: "application_id" },
  );
}

export function poolStats(pools: PoolCount[], outcomes: OutcomeRow[]): PoolStats {
  return {
    pools,
    waitlisted: outcomes.filter((row) => row.outcome === "waitlisted").length,
    rejected: outcomes.filter((row) => row.outcome === "rejected").length,
  };
}

export type TierProgress = Record<Tier, { needVotes: number; done: number }>;

/** Per tier: how many still need votes and how many have an outcome; plus how many are waiting to be scored. */
export async function loadTierProgress(session: Supabase, outcomes: OutcomeRow[]) {
  type App = { id: string; decision: string | null };
  type Score = { application_id: string; status: string; tier: string | null };
  const [apps, scores] = await Promise.all([
    loadAllByKeyset<App>((after) => {
      const query = session.from("applications").select("id, decision").eq("status", "submitted").order("id").limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    loadAllByKeyset<Score>(
      (after) => {
        const query = session.from("hive_scores").select("application_id, status, tier").order("application_id").limit(PAGE_SIZE);
        return after ? query.gt("application_id", after) : query;
      },
      { key: "application_id" },
    ),
  ]);
  if (!apps.data || !scores.data) return null;

  const decided = new Set(outcomes.map((row) => row.application_id));
  const scoreById = new Map(scores.data.map((score) => [score.application_id, score]));
  const progress = Object.fromEntries(TIERS.map((tier) => [tier, { needVotes: 0, done: 0 }])) as TierProgress;
  let unscored = 0;
  for (const app of apps.data) {
    const score = scoreById.get(app.id);
    if (score?.status !== "scored" || !isTier(score.tier)) {
      if (!decided.has(app.id) && !app.decision) unscored++;
      continue;
    }
    if (decided.has(app.id)) progress[score.tier].done++;
    else if (!app.decision) progress[score.tier].needVotes++;
  }
  return { progress, unscored };
}
