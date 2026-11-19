import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadAllByKeyset } from "@/lib/admin/applicants";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { Decision } from "@/lib/application/decision-email";
import type { Application } from "@/lib/application/schema";
import { POOLS, POOL_LABELS, SEATS, tallyPools, type Accept, type PoolTally } from "@/lib/decisions/pools";
import { loadStagedDecisions, type StagedDecision } from "@/lib/decisions/staged";
import { formatDateTime } from "@/lib/time";
import { ReviewNotice } from "../applicants/DecisionControls";
import { PromoteWaitlist, ReleasePanel, RetryUnsent, UndoStaged } from "./DecisionsClient";

export const metadata: Metadata = { title: "Decisions | HackHive 2027" };

// Sending a wave's emails is batched to fit well inside this.
export const maxDuration = 60;

export default function DecisionsPage() {
  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Decisions</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Accept, Waitlist and Reject on the{" "}
          <Link href="/admin/applicants" className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
            Applicants
          </Link>{" "}
          and{" "}
          <Link href="/admin/hive" className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
            Hive Mind
          </Link>{" "}
          pages only stage a decision. Nobody hears anything until you release a wave here.
        </p>
      </header>
      <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Loading decisions…</p>}>
        <Decisions />
      </Suspense>
    </main>
  );
}

type Session = Awaited<ReturnType<typeof requireAdmin>>;
type App = Pick<Application, "id" | "email" | "first_name" | "last_name" | "preferred_name" | "university" | "year_of_study" | "decision" | "submitted_at">;
type Wave = { id: number; includes_rejections: boolean; released_by: string | null; released_at: string };
type WaveEmail = { wave_id: number; application_id: string; decision: Decision; sent_at: string | null; error: string | null };

const PAGE_SIZE = 1000;
const APP_COLUMNS = "id, email, first_name, last_name, preferred_name, university, year_of_study, decision, submitted_at";

async function loadDecisions(session: Session) {
  const [apps, staged, waves] = await Promise.all([
    loadAllByKeyset<App>((after) => {
      const query = session.from("applications").select(APP_COLUMNS).eq("status", "submitted").order("id").limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    loadStagedDecisions(session),
    session.from("release_waves").select("id, includes_rejections, released_by, released_at").order("released_at").order("id"),
  ]);
  if (!apps.data || !staged.data || waves.error || !waves.data) return null;

  // One wave at a time: wave_emails' key is (wave, applicant), and keyset paging needs a single column.
  const emails = await Promise.all(
    (waves.data as Wave[]).map((wave) =>
      loadAllByKeyset<WaveEmail>(
        (after) => {
          const query = session
            .from("wave_emails")
            .select("wave_id, application_id, decision, sent_at, error")
            .eq("wave_id", wave.id)
            .order("application_id")
            .limit(PAGE_SIZE);
          return after ? query.gt("application_id", after) : query;
        },
        { key: "application_id" },
      ),
    ),
  );
  if (emails.some((result) => !result.data)) return null;

  const adminIds = [...new Set((waves.data as Wave[]).map((wave) => wave.released_by).filter((id): id is string => !!id))];
  const { data: admins } = adminIds.length
    ? await session.from("profiles").select("id, full_name, email").in("id", adminIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

  return {
    apps: apps.data,
    staged: staged.data,
    waves: waves.data as Wave[],
    emails: emails.flatMap((result) => result.data ?? []),
    admins: admins ?? [],
  };
}

const fullName = (app: App) => [app.preferred_name || app.first_name, app.last_name].filter(Boolean).join(" ") || app.email;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const DECISIONS: Decision[] = ["accepted", "waitlisted", "rejected"];
const DECISION_HEADINGS: Record<Decision, string> = { accepted: "Accepts", waitlisted: "Waitlists", rejected: "Rejections" };

async function Decisions() {
  const session = await requireAdmin("/admin/decisions");
  const loaded = await loadDecisions(session);
  if (!loaded) {
    return (
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">Decisions couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again. If it keeps failing, check the release_waves migration has been applied.</p>
      </div>
    );
  }

  const appById = new Map(loaded.apps.map((app) => [app.id, app]));
  // Only staged rows that would change something: release drops the rest.
  const staged = loaded.staged.filter((row) => {
    const app = appById.get(row.application_id);
    return app && app.decision !== row.decision;
  });
  const stagedById = new Map(staged.map((row) => [row.application_id, row]));
  const stagedCount = (decision: Decision) => staged.filter((row) => row.decision === decision).length;
  const sentCount = (decision: Decision) => loaded.apps.filter((app) => app.decision === decision).length;
  const pendingReview = loaded.apps.filter((app) => !app.decision && !stagedById.has(app.id)).length;
  const waitlisted = loaded.apps.filter((app) => app.decision === "waitlisted" && !stagedById.has(app.id)).length;

  // When the wave that accepted each applicant went out (none for accepts from before waves).
  const waveTime = new Map(loaded.waves.map((wave) => [wave.id, wave.released_at]));
  const acceptedAt = new Map<string, string>();
  for (const email of loaded.emails) {
    if (email.decision !== "accepted") continue;
    const at = waveTime.get(email.wave_id)!;
    const current = acceptedAt.get(email.application_id);
    if (!current || Date.parse(at) > Date.parse(current)) acceptedAt.set(email.application_id, at);
  }
  const accepts: Accept[] = [
    ...loaded.apps
      .filter((app) => app.decision === "accepted")
      .map((app) => ({ ...poolFields(app), sent: true, releasedAt: acceptedAt.get(app.id) ?? null, stagedAt: null })),
    ...staged
      .filter((row) => row.decision === "accepted")
      .map((row) => ({ ...poolFields(appById.get(row.application_id)!), sent: false, releasedAt: null, stagedAt: row.staged_at })),
  ];
  const pools = tallyPools(accepts);

  const adminName = new Map(loaded.admins.map((admin) => [admin.id, admin.full_name || admin.email || "Admin"]));
  const emailsByWave = new Map<number, WaveEmail[]>();
  for (const email of loaded.emails) emailsByWave.set(email.wave_id, [...(emailsByWave.get(email.wave_id) ?? []), email]);

  return (
    <ReviewNotice>
      <div className="space-y-8">
        <section aria-labelledby="pools-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="pools-heading" className="text-lg font-semibold">Seat targets</h2>
            <p className="text-sm text-neutral-600 tabular-nums">
              {accepts.filter((a) => a.sent).length} accepted + {accepts.filter((a) => !a.sent).length} staged of {SEATS} seats
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {POOLS.map((pool) => (
              <PoolCard key={pool} label={POOL_LABELS[pool]} tally={pools[pool]} />
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Display only: these never accept, reject or reorder anyone. Accepts count in the order they were released, then staged. Ontario
            Tech 1st and 2nd years count towards lower years once Ontario Tech is full.
          </p>
        </section>

        <section aria-labelledby="totals-heading">
          <h2 id="totals-heading" className="mb-3 text-lg font-semibold">Totals</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Pending review" value={pendingReview} note="no decision, nothing staged" />
            {DECISIONS.map((decision) => (
              <Stat
                key={decision}
                label={{ accepted: "Accepted", waitlisted: "Waitlisted", rejected: "Rejected" }[decision]}
                value={sentCount(decision)}
                note={`released · ${stagedCount(decision)} staged`}
              />
            ))}
          </dl>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReleasePanel
            nextWave={loaded.waves.length + 1}
            accepts={stagedCount("accepted")}
            waitlists={stagedCount("waitlisted")}
            rejections={stagedCount("rejected")}
          />
          <section aria-labelledby="waitlist-heading" className="rounded-lg border border-neutral-200 p-4">
            <h2 id="waitlist-heading" className="font-semibold">Waitlist</h2>
            <p className="mt-1 text-sm">
              <strong className="tabular-nums">{waitlisted}</strong> on the waitlist (released, nothing staged)
            </p>
            <p className="text-sm text-neutral-600">Stages accepts for the top of the waitlist by Hive Mind rank. They go out with the next wave.</p>
            <PromoteWaitlist waitlisted={waitlisted} />
          </section>
        </div>

        <section aria-labelledby="staged-heading">
          <details className="group rounded-lg border border-neutral-200">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
              <h2 id="staged-heading" className="font-semibold">
                Staged, not sent <span className="font-normal text-neutral-600 tabular-nums">({staged.length})</span>
              </h2>
              <span className="text-sm underline underline-offset-2">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="space-y-4 border-t border-neutral-200 px-4 py-3">
              {staged.length === 0 && <p className="text-sm text-neutral-600">Nothing is staged.</p>}
              {DECISIONS.map((decision) => {
                const rows = staged.filter((row) => row.decision === decision).toSorted((a, b) => a.staged_at.localeCompare(b.staged_at));
                if (!rows.length) return null;
                return (
                  <div key={decision}>
                    <h3 className="text-sm font-semibold">
                      {DECISION_HEADINGS[decision]} <span className="font-normal text-neutral-600 tabular-nums">({rows.length})</span>
                    </h3>
                    <ul className="mt-1 divide-y divide-neutral-200">
                      {rows.map((row) => (
                        <StagedRow key={row.application_id} row={row} app={appById.get(row.application_id)!} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </details>
        </section>

        <section aria-labelledby="waves-heading">
          <h2 id="waves-heading" className="mb-3 text-lg font-semibold">Wave history</h2>
          {loaded.waves.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
              No waves yet. Anyone decided before waves existed already counts as released.
            </p>
          ) : (
            <ol className="divide-y divide-neutral-200 border-y border-neutral-200">
              {loaded.waves
                .map((wave, i) => ({ wave, number: i + 1, emails: emailsByWave.get(wave.id) ?? [] }))
                .toReversed()
                .map(({ wave, number, emails }) => {
                  const sent = emails.filter((email) => email.sent_at).length;
                  const unsent = emails.length - sent;
                  const failed = emails.filter((email) => !email.sent_at && email.error).length;
                  const lastError = emails.find((email) => !email.sent_at && email.error)?.error;
                  return (
                    <li key={wave.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          Wave {number}
                          {wave.includes_rejections && <span className="ml-2 text-sm font-normal text-neutral-600">final (with rejections)</span>}
                        </h3>
                        <p className="text-sm text-neutral-600">
                          {formatDateTime(wave.released_at)} · by {(wave.released_by && adminName.get(wave.released_by)) || "Admin"}
                        </p>
                        <p className="text-sm tabular-nums">
                          {DECISIONS.map((decision) => plural(emails.filter((email) => email.decision === decision).length, decision === "accepted" ? "accept" : decision === "waitlisted" ? "waitlist" : "rejection")).join(" · ")}
                        </p>
                        <p className={`text-sm tabular-nums ${unsent ? "text-red-700" : "text-neutral-600"}`}>
                          Emails: {sent} sent · {failed} failed · {unsent - failed} not tried yet
                        </p>
                        {lastError && <p className="text-sm break-words text-red-700">Last error: {lastError}</p>}
                      </div>
                      {unsent > 0 && <RetryUnsent waveId={wave.id} unsent={unsent} />}
                    </li>
                  );
                })}
            </ol>
          )}
        </section>
      </div>
    </ReviewNotice>
  );
}

function poolFields(app: App) {
  return { id: app.id, university: app.university, year_of_study: app.year_of_study, submittedAt: app.submitted_at };
}

function PoolCard({ label, tally }: { label: string; tally: PoolTally }) {
  const total = tally.sent + tally.staged;
  const percent = Math.round((total / tally.target) * 100);
  const width = (n: number) => `${Math.min(100, (n / tally.target) * 100)}%`;
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {total}
        <span className="text-base font-normal text-neutral-600"> / {tally.target}</span>
      </p>
      <p className="text-sm text-neutral-600 tabular-nums">
        {tally.sent} accepted + {tally.staged} staged · {percent}%{total > tally.target && " (over target)"}
      </p>
      <div
        role="img"
        aria-label={`${tally.sent} accepted and ${tally.staged} staged of ${tally.target}`}
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-neutral-100"
      >
        <div className="h-full bg-amber-600" style={{ width: width(tally.sent) }} />
        <div className="h-full bg-amber-300" style={{ width: `calc(${width(total)} - ${width(tally.sent)})` }} />
      </div>
      <p className="mt-2 flex gap-3 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-amber-600" /> Accepted
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-amber-300" /> Staged
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
      <dd className="text-sm text-neutral-600 tabular-nums">{note}</dd>
    </div>
  );
}

function StagedRow({ row, app }: { row: StagedDecision; app: App }) {
  const name = fullName(app);
  const was = app.decision ? ` (now ${app.decision})` : "";
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium break-words">
          {name}
          {was && <span className="font-normal text-neutral-600">{was}</span>}
        </p>
        <p className="text-sm break-words text-neutral-600">
          {app.email}
          {app.university && ` · ${app.university}`}
        </p>
      </div>
      <UndoStaged id={row.application_id} name={name} />
    </li>
  );
}
