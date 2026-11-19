import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { loadAllByKeyset } from "@/lib/admin/applicants";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { Decision } from "@/lib/application/decision-email";
import type { Application } from "@/lib/application/schema";
import { POOLS, POOL_LABELS, SEATS, tallyPools, type Accept, type PoolTally } from "@/lib/decisions/pools";
import { loadStagedDecisions } from "@/lib/decisions/staged";
import { formatDateTime } from "@/lib/time";
import { ReviewNotice } from "../applicants/DecisionControls";
import { PromoteWaitlist, ReleasePanel, RetryUnsent, UndoStaged } from "./DecisionsClient";

export const metadata: Metadata = { title: "Decisions | HackHive 2027" };

// Sending a wave's emails is batched to fit well inside this.
export const maxDuration = 60;

export default function DecisionsPage() {
  return (
    <main className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Decisions</h1>
        <p className="mt-1 text-sm text-neutral-600">Nobody hears anything until you release a wave.</p>
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
  const waves = loaded.waves.map((wave, i) => {
    const emails = emailsByWave.get(wave.id) ?? [];
    const unsent = emails.filter((email) => !email.sent_at);
    return { wave, number: i + 1, emails, unsent: unsent.length, lastError: unsent.find((email) => email.error)?.error ?? null };
  });
  const stuck = waves.filter((wave) => wave.unsent > 0);
  const acceptedTotal = accepts.length;

  return (
    <ReviewNotice>
      <div className="space-y-8">
        {stuck.map(({ wave, number, unsent, lastError }) => (
          <div key={wave.id} role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                Wave {number} has {plural(unsent, "unsent email")}
              </p>
              {lastError && <p className="break-words text-amber-900">Last error: {lastError}</p>}
            </div>
            <RetryUnsent waveId={wave.id} unsent={unsent} />
          </div>
        ))}

        <ReleasePanel
          nextWave={loaded.waves.length + 1}
          accepts={stagedCount("accepted")}
          waitlists={stagedCount("waitlisted")}
          rejections={stagedCount("rejected")}
          undecided={pendingReview}
        />

        <section aria-labelledby="seats-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="seats-heading" className="font-semibold">Seats</h2>
            <p className="text-sm text-neutral-600 tabular-nums">
              {acceptedTotal} of {SEATS}
            </p>
          </div>
          <ul className="space-y-3">
            {POOLS.map((pool) => (
              <PoolRow key={pool} label={POOL_LABELS[pool]} tally={pools[pool]} />
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-amber-600" /> Accepted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-amber-300" /> Staged
            </span>
            <span>For reference only. Nobody is moved up or down because of these.</span>
          </p>
        </section>

        <section aria-labelledby="waitlist-heading" className="flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="waitlist-heading" className="font-semibold">Waitlist</h2>
            <p className="text-sm text-neutral-600">
              <span className="tabular-nums">{waitlisted === 1 ? "1 person" : `${waitlisted} people`}</span>. Promoting stages accepts for the top by Hive Mind rank.
            </p>
          </div>
          <PromoteWaitlist waitlisted={waitlisted} />
        </section>

        <div className="divide-y divide-neutral-200 border-y border-neutral-200">
          <Disclosure title="Staged, not sent" count={staged.length}>
            {staged.length === 0 ? (
              <p className="text-sm text-neutral-600">
                Nothing staged. Decide on people from{" "}
                <Link href="/admin/applicants" className={link}>
                  Applicants
                </Link>{" "}
                or{" "}
                <Link href="/admin/hive" className={link}>
                  Hive Mind
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-4">
                {DECISIONS.map((decision) => {
                  const rows = staged.filter((row) => row.decision === decision).toSorted((a, b) => a.staged_at.localeCompare(b.staged_at));
                  return (
                    <NameGroup key={decision} title={GROUP_TITLES[decision]} count={rows.length}>
                      {rows.map((row) => {
                        const app = appById.get(row.application_id)!;
                        return (
                          <NameRow key={row.application_id} app={app} note={app.decision ? `was ${app.decision}` : null}>
                            <UndoStaged id={row.application_id} name={fullName(app)} />
                          </NameRow>
                        );
                      })}
                    </NameGroup>
                  );
                })}
              </div>
            )}
          </Disclosure>
          <Disclosure title="Past waves" count={waves.length}>
            {waves.length === 0 ? (
              <p className="text-sm text-neutral-600">No waves yet.</p>
            ) : (
              <ol className="divide-y divide-neutral-100">
                {waves.toReversed().map(({ wave, number, emails, unsent }) => (
                  <li key={wave.id}>
                    <details className="group/wave">
                      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="block font-medium">
                            Wave {number}
                            {wave.includes_rejections && <span className="font-normal text-neutral-600"> (final)</span>}
                          </span>
                          <span className="block text-neutral-600">
                            {formatDateTime(wave.released_at)} by {(wave.released_by && adminName.get(wave.released_by)) || "Admin"}.{" "}
                            {DECISIONS.map((decision) => countOf(emails, decision))
                              .filter(Boolean)
                              .join(", ")}
                            . {unsent ? `${unsent} unsent.` : "All sent."}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-sm underline underline-offset-2">
                          <span className="group-open/wave:hidden">Show names</span>
                          <span className="hidden group-open/wave:inline">Hide names</span>
                        </span>
                      </summary>
                      <div className="space-y-4 pt-1 pb-3">
                        {DECISIONS.map((decision) => {
                          const rows = emails
                            .filter((email) => email.decision === decision)
                            .map((email) => ({ email, app: appById.get(email.application_id) }))
                            .filter((row): row is { email: WaveEmail; app: App } => !!row.app)
                            .toSorted((a, b) => fullName(a.app).localeCompare(fullName(b.app)));
                          return (
                            <NameGroup key={decision} title={SENT_TITLES[decision]} count={rows.length}>
                              {rows.map(({ email, app }) => (
                                <NameRow
                                  key={app.id}
                                  app={app}
                                  note={app.decision !== decision ? `now ${app.decision ?? "pending"}` : null}
                                  warning={email.sent_at ? null : email.error ? "email failed" : "email not sent yet"}
                                />
                              ))}
                            </NameGroup>
                          );
                        })}
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </Disclosure>
        </div>
      </div>
    </ReviewNotice>
  );
}

const link = "underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";

const NOUNS: Record<Decision, string> = { accepted: "accept", waitlisted: "waitlist", rejected: "rejection" };
function countOf(emails: WaveEmail[], decision: Decision) {
  const n = emails.filter((email) => email.decision === decision).length;
  return n ? plural(n, NOUNS[decision]) : "";
}

function poolFields(app: App) {
  return { id: app.id, university: app.university, year_of_study: app.year_of_study, submittedAt: app.submitted_at };
}

function PoolRow({ label, tally }: { label: string; tally: PoolTally }) {
  const total = tally.sent + tally.staged;
  const width = (n: number) => `${Math.min(100, (n / tally.target) * 100)}%`;
  return (
    <li className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_6rem]">
      <span className="font-medium">{label}</span>
      <div
        role="img"
        aria-label={`${tally.sent} accepted and ${tally.staged} staged of ${tally.target}`}
        className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100"
      >
        <div className="h-full bg-amber-600" style={{ width: width(tally.sent) }} />
        <div className="h-full bg-amber-300" style={{ width: `calc(${width(total)} - ${width(tally.sent)})` }} />
      </div>
      <span className={`text-right tabular-nums ${total > tally.target ? "font-semibold text-amber-800" : "text-neutral-700"}`}>
        {total} / {tally.target}
      </span>
    </li>
  );
}

function Disclosure({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 [&::-webkit-details-marker]:hidden">
        <h2 className="font-semibold">
          {title} <span className="font-normal text-neutral-600 tabular-nums">({count})</span>
        </h2>
        <ChevronDown aria-hidden className="size-4 text-neutral-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

const GROUP_TITLES: Record<Decision, string> = { accepted: "Accepting", waitlisted: "Waitlisting", rejected: "Rejecting (held for the final wave)" };
const SENT_TITLES: Record<Decision, string> = { accepted: "Accepted", waitlisted: "Waitlisted", rejected: "Rejected" };

function NameGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-neutral-600 tabular-nums">({count})</span>
      </h3>
      <ul className="mt-1 divide-y divide-neutral-100">{children}</ul>
    </div>
  );
}

function NameRow({ app, note, warning, children }: { app: App; note?: string | null; warning?: string | null; children?: ReactNode }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 py-1">
      <p className="min-w-0 text-sm break-words">
        <span className="font-medium">{fullName(app)}</span>
        {fullName(app) !== app.email && <span className="text-neutral-600"> {app.email}</span>}
        {note && <span className="text-neutral-600"> ({note})</span>}
        {warning && <span className="font-medium text-red-700"> {warning}</span>}
      </p>
      {children}
    </li>
  );
}
