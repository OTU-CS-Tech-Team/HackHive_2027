import type { Metadata } from "next";
import { Suspense } from "react";
import { loadAllByKeyset } from "@/lib/admin/applicants";
import { requireAdmin } from "@/lib/admin/require-admin";
import { isTier } from "@/lib/hive/tier";
import { VOTE_LABELS, type Outcome, type Vote } from "@/lib/review/pools";
import { loadOutcomes, loadPoolCounts, poolStats } from "@/lib/review/summary";
import { formatDateTime } from "@/lib/time";
import { PoolBars, ReviewHeader } from "../ReviewChrome";
import { ResultsTable, type ResultRow } from "./ResultsTable";

export const metadata: Metadata = { title: "Review results | HackHive 2027" };

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-6xl">
      <ReviewHeader
        active="results"
        description="Names come back here. Review outcomes are handed to the Decisions page, which stages and releases them. Reopen sends someone back to the queue, until a decision has been set or staged for them."
      />
      <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Loading results…</p>}>
        <Results />
      </Suspense>
    </main>
  );
}

type Session = Awaited<ReturnType<typeof requireAdmin>>;
type App = { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null; email: string; university: string | null; decision: Outcome | null };
type VoteRow = { application_id: string; admin_id: string; vote: Vote; created_at: string };

const PAGE_SIZE = 1000;

async function loadVotes(session: Session) {
  const rows: VoteRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await session
      .from("review_votes")
      .select("application_id, admin_id, vote, created_at")
      .order("application_id")
      .order("admin_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) return null;
    rows.push(...(data as VoteRow[]));
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function Results() {
  const session = await requireAdmin("/admin/review/results");
  const [pools, outcomes, apps, scores, votes] = await Promise.all([
    loadPoolCounts(session),
    loadOutcomes(session),
    loadAllByKeyset<App>((after) => {
      const query = session
        .from("applications")
        .select("id, first_name, last_name, preferred_name, email, university, decision")
        .eq("status", "submitted")
        .order("id")
        .limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    loadAllByKeyset<{ application_id: string; tier: string | null }>(
      (after) => {
        const query = session.from("hive_scores").select("application_id, tier").order("application_id").limit(PAGE_SIZE);
        return after ? query.gt("application_id", after) : query;
      },
      { key: "application_id" },
    ),
    loadVotes(session),
  ]);
  if (!pools || !outcomes.data || !apps.data || !scores.data || !votes) {
    return (
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">Results couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again. If it keeps failing, check the blind_review migration has been applied.</p>
      </div>
    );
  }

  const adminIds = [...new Set(votes.map((vote) => vote.admin_id))];
  const { data: admins } = adminIds.length
    ? await session.from("profiles").select("id, full_name, email").in("id", adminIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const adminName = new Map((admins ?? []).map((admin) => [admin.id, admin.full_name || admin.email || "Admin"]));
  const appById = new Map(apps.data.map((app) => [app.id, app]));
  const tierById = new Map(scores.data.map((score) => [score.application_id, score.tier]));
  const votesById = new Map<string, VoteRow[]>();
  for (const vote of votes) votesById.set(vote.application_id, [...(votesById.get(vote.application_id) ?? []), vote]);

  const rows: ResultRow[] = outcomes.data
    .toSorted((a, b) => b.decided_at.localeCompare(a.decided_at))
    .map((outcome) => {
      const app = appById.get(outcome.application_id);
      const tier = tierById.get(outcome.application_id);
      return {
        id: outcome.application_id,
        name: app ? [app.preferred_name || app.first_name, app.last_name].filter(Boolean).join(" ") || app.email : "Withdrawn application",
        email: app?.email ?? "",
        school: app?.university ?? null,
        tier: isTier(tier) ? tier : null,
        votes: (votesById.get(outcome.application_id) ?? [])
          .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
          .map((vote) => ({ admin: adminName.get(vote.admin_id) ?? "Admin", vote: VOTE_LABELS[vote.vote] ?? vote.vote, raw: vote.vote })),
        outcome: outcome.outcome,
        pool: outcome.pool,
        waitlistPosition: outcome.waitlist_position,
        decidedAt: formatDateTime(outcome.decided_at),
        decision: app?.decision ?? null,
      };
    });

  return (
    <>
      <PoolBars stats={poolStats(pools, outcomes.data)} />
      <ResultsTable rows={rows} />
    </>
  );
}
