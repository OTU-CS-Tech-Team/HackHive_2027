import "server-only";

import { loadAllByKeyset } from "@/lib/admin/applicants";
import type { createClient } from "@/lib/supabase/server";
import { TIERS, isTier, type Tier } from "@/lib/hive/tier";
import { DEFAULT_SETTINGS, POOLS, poolTargets, type Outcome, type Pool, type ReviewSettings } from "./pools";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PAGE_SIZE = 1000;

export type OutcomeRow = {
  application_id: string;
  outcome: Outcome;
  pool: Pool | null;
  waitlist_position: number | null;
  decided_at: string;
  released_at: string | null;
};

export type PoolStats = {
  pools: { pool: Pool; count: number; target: number }[];
  waitlisted: number;
  rejected: number;
  unreleased: number;
};

export async function loadSettings(session: Supabase): Promise<ReviewSettings> {
  const { data } = await session.from("review_settings").select("seats, otu_pct, early_pct, general_pct").eq("id", 1).maybeSingle();
  return data ? { seats: data.seats, otu_pct: Number(data.otu_pct), early_pct: Number(data.early_pct), general_pct: Number(data.general_pct) } : DEFAULT_SETTINGS;
}

export function loadOutcomes(session: Supabase) {
  return loadAllByKeyset<OutcomeRow>(
    (after) => {
      const query = session
        .from("review_outcomes")
        .select("application_id, outcome, pool, waitlist_position, decided_at, released_at")
        .order("application_id")
        .limit(PAGE_SIZE);
      return after ? query.gt("application_id", after) : query;
    },
    { key: "application_id" },
  );
}

export function poolStats(settings: ReviewSettings, outcomes: OutcomeRow[]): PoolStats {
  const targets = poolTargets(settings);
  return {
    pools: POOLS.map((pool) => ({
      pool,
      count: outcomes.filter((row) => row.outcome === "accepted" && row.pool === pool).length,
      target: targets[pool],
    })),
    waitlisted: outcomes.filter((row) => row.outcome === "waitlisted").length,
    rejected: outcomes.filter((row) => row.outcome === "rejected").length,
    unreleased: outcomes.filter((row) => !row.released_at).length,
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
