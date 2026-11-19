import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { applicantStatus } from "@/components/ApplicationView";
import { loadAllByKeyset } from "@/lib/admin/applicants";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { Application } from "@/lib/application/schema";
import type { Decision } from "@/lib/application/decision-email";
import { loadStagedMap } from "@/lib/decisions/staged";
import { MAX_TOTAL, TIERS, type Tier } from "@/lib/hive/tier";
import {
  compareForReview,
  creditsRunOut,
  displayTier,
  gaveUp,
  inBacklog,
  isScoring,
  isTierFilter,
  scoreTotal,
  type HiveScore,
  type TierChange,
  type TierFilter,
} from "@/lib/hive/view";
import { formatDateTime } from "@/lib/time";
import { DecisionControls, ReviewNotice } from "../applicants/DecisionControls";
import { HivePanel, type HistoryEntry } from "./HivePanel";
import { HiveBrowser } from "./HiveBrowser";
import { ScoreBacklog } from "./ScoreBacklog";
import { FlagPills, MinorPill, TierBadge } from "./TierBadge";

export const metadata: Metadata = { title: "Hive Mind | HackHive 2027" };

// Server actions on this page (batch scoring, re-score) call OpenAI.
export const maxDuration = 60;

type SearchParams = Promise<{ tier?: string | string[]; q?: string | string[] }>;

export default function HivePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hive Mind</h1>
        <p className="mt-1 text-sm text-neutral-600">
          AI-suggested tiers from the short answers (a total out of 15), so applicants are compared with their peers. Nobody is accepted
          or rejected by the AI: every decision is yours.
        </p>
      </header>
      <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Loading the Hive Mind…</p>}>
        <Hive searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type Session = Awaited<ReturnType<typeof requireAdmin>>;
type App = Pick<
  Application,
  "id" | "email" | "first_name" | "last_name" | "preferred_name" | "university" | "age" | "status" | "decision" | "submitted_at" | "hackathons_count"
>;

const PAGE_SIZE = 1000;
const APP_COLUMNS = "id, email, first_name, last_name, preferred_name, university, age, status, decision, submitted_at, hackathons_count";

async function loadHive(session: Session) {
  const [apps, scores, changes, staged] = await Promise.all([
    loadAllByKeyset<App>((after) => {
      const query = session.from("applications").select(APP_COLUMNS).eq("status", "submitted").order("id").limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    loadAllByKeyset<HiveScore>(
      (after) => {
        const query = session.from("hive_scores").select("*").order("application_id").limit(PAGE_SIZE);
        return after ? query.gt("application_id", after) : query;
      },
      { key: "application_id" },
    ),
    loadAllByKeyset<TierChange>((after) => {
      const query = session.from("hive_tier_changes").select("*").order("id").limit(PAGE_SIZE);
      return after ? query.gt("id", Number(after)) : query;
    }),
    loadStagedMap(session),
  ]);
  if (!apps.data || !scores.data || !changes.data) return null;

  const adminIds = [...new Set(changes.data.map((change) => change.changed_by).filter((id): id is string => !!id))];
  const { data: admins } = adminIds.length
    ? await session.from("profiles").select("id, full_name, email").in("id", adminIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  return { apps: apps.data, scores: scores.data, changes: changes.data, admins: admins ?? [], staged };
}

// "Scoring now" depends on the time, so it's worked out per request.
async function requestTime() {
  await connection();
  return Date.now();
}

const fullName = (app: App) => [app.preferred_name || app.first_name, app.last_name].filter(Boolean).join(" ");

async function Hive({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAdmin("/admin/hive");
  const { tier: tierParam, q } = await searchParams;
  const filter: TierFilter = isTierFilter(tierParam) ? tierParam : "all";
  const search = typeof q === "string" ? q.trim() : "";

  const loaded = await loadHive(session);
  const now = await requestTime();
  if (!loaded) {
    return (
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">The Hive Mind couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again. If it keeps failing, check the hive_scores migration has been applied.</p>
      </div>
    );
  }

  const scoreById = new Map(loaded.scores.map((score) => [score.application_id, score]));
  const adminName = new Map(loaded.admins.map((admin) => [admin.id, admin.full_name || admin.email || "Admin"]));
  const historyById = new Map<string, HistoryEntry[]>();
  for (const change of loaded.changes) {
    const list = historyById.get(change.application_id) ?? [];
    list.push({
      id: change.id,
      from: change.from_tier,
      to: change.to_tier,
      reason: change.reason,
      by: (change.changed_by && adminName.get(change.changed_by)) || "Admin",
      at: formatDateTime(change.changed_at),
    });
    historyById.set(change.application_id, list);
  }

  const rows = loaded.apps.map((app) => {
    const score = scoreById.get(app.id);
    return { ...app, score, tier: displayTier(score) };
  });

  const counts = Object.fromEntries(
    TIERS.map((tier) => {
      const inTier = rows.filter((row) => row.tier === tier);
      return [tier, { total: inTier.length, accepted: inTier.filter((row) => row.decision === "accepted").length }];
    }),
  ) as Record<Tier, { total: number; accepted: number }>;
  const unscored = rows.filter((row) => !row.tier);
  const failed = unscored.filter((row) => row.score?.status === "failed").length;
  const givenUp = rows.filter((row) => gaveUp(row.score)).length;
  const backlog = rows.filter((row) => inBacklog(row.score, now)).length;
  const outOfCredits = creditsRunOut(loaded.scores);

  const sorted = rows.toSorted(compareForReview);

  return (
    <ReviewNotice>
      {outOfCredits && (
        <div role="alert" className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">OpenAI credits are used up</p>
          <p className="mt-1">
            Applications are still coming in and saving normally; they just aren&apos;t being scored. Top up the OpenAI account, then press
            &ldquo;Score now&rdquo; to catch up.
          </p>
        </div>
      )}
      <HiveBrowser
        initialFilter={filter}
        initialSearch={search}
        counts={counts}
        unscoredCard={
          <div className="rounded-lg border border-neutral-200 p-4">
            <p className="text-sm font-medium">Unscored</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{unscored.length}</p>
            <p className="mb-3 text-sm text-neutral-600 tabular-nums">
              {failed} failed
              {givenUp > 0 && ` · ${givenUp} gave up after 5 tries (use Re-score)`}
            </p>
            <ScoreBacklog count={backlog} />
          </div>
        }
        rows={sorted.map((row) => ({
          id: row.id,
          tier: row.tier,
          text: [fullName(row), row.email, row.university].filter(Boolean).join(" ").toLowerCase(),
          node: (
            <HiveRow
              row={row}
              history={historyById.get(row.id) ?? []}
              scoring={isScoring(row.score, now)}
              staged={loaded.staged.get(row.id) ?? null}
            />
          ),
        }))}
      />
    </ReviewNotice>
  );
}

const DECISION_LABELS = { applied: "Pending", accepted: "Accepted", waitlisted: "Waitlisted", rejected: "Rejected", draft: "Draft" } as const;

function HiveRow({
  row,
  history,
  scoring,
  staged,
}: {
  row: App & { score?: HiveScore; tier: Tier | null };
  history: HistoryEntry[];
  scoring: boolean;
  staged: Decision | null;
}) {
  const name = fullName(row) || row.email;
  const status = applicantStatus(row);
  const { score } = row;

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold break-words">{name}</h2>
            <TierBadge tier={row.tier} overridden={!!score?.tier_override} />
            {row.age !== null && row.age < 18 && <MinorPill age={row.age} />}
          </div>
          <p className="text-sm break-words text-neutral-600">
            {row.email}
            {row.university && ` · ${row.university}`}
          </p>
          <p className="text-sm text-neutral-600">
            {DECISION_LABELS[status]}
            {row.submitted_at && ` · Submitted ${formatDateTime(row.submitted_at)}`} · {row.hackathons_count ?? 0} hackathons
          </p>
          {score?.status === "scored" && (
            <p className="mt-1 text-sm">
              <strong>{scoreTotal(score)}/{MAX_TOTAL}</strong> (Exp {score.experience}/5 · Creativity {score.creativity}/5 · Quality {score.quality}/5)
            </p>
          )}
          {score && score.flags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              <FlagPills flags={score.flags} />
            </div>
          )}
        </div>
        <DecisionControls id={row.id} name={name} decision={row.decision} staged={staged} />
      </div>
      <details className="group mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-2">
          <span className="group-open:hidden">Show Hive Mind details</span>
          <span className="hidden group-open:inline">Hide Hive Mind details</span>
        </summary>
        <div className="mt-3 space-y-3">
          <HivePanel
            // A fresh panel whenever the score changes, so "Move tier" starts from the new suggestion.
            key={score?.updated_at ?? "unscored"}
            id={row.id}
            scoring={scoring}
            age={row.age}
            score={score}
            history={history}
            scoredAt={score?.scored_at ? formatDateTime(score.scored_at) : null}
          />
          <Link
            href={`/admin/applicants?${new URLSearchParams({ status, q: row.email })}`}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            Open full application
          </Link>
        </div>
      </details>
    </>
  );
}
