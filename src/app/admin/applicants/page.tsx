import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApplicationView, applicantStatus } from "@/components/ApplicationView";
import { bySubmittedAt, loadAllByKeyset } from "@/lib/admin/applicants";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { Application } from "@/lib/application/schema";
import { displayTier, type HiveScore } from "@/lib/hive/view";
import type { Tier } from "@/lib/hive/tier";
import { formatDateTime } from "@/lib/time";
import { deleteApplicants } from "../actions";
import { DeleteButton, SelectBox, Selection } from "../Selection";
import { MinorPill, TierBadge } from "../hive/TierBadge";
import { DecisionControls, ReviewNotice } from "./DecisionControls";
import { DraftReminder } from "./DraftReminder";

export const metadata: Metadata = { title: "Applicants | HackHive 2027" };

const FILTERS = {
  applied: "Pending",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
  draft: "Drafts",
} as const;
type Filter = keyof typeof FILTERS;

const EMPTY: Record<Filter, string> = {
  applied: "Nobody is waiting for a decision.",
  accepted: "Nobody has been accepted yet.",
  waitlisted: "Nobody is on the waitlist.",
  rejected: "Nobody has been rejected.",
  draft: "No unfinished drafts.",
};

type SearchParams = Promise<{ status?: string | string[]; q?: string | string[] }>;

export default function ApplicantsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Applicants</h1>
      </header>
      <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Loading applicants…</p>}>
        <Applicants searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const fullName = (app: Application) => [app.first_name, app.last_name].filter(Boolean).join(" ");

function matches(app: Application, query: string) {
  return [fullName(app), app.email, app.university].some((value) => value?.toLowerCase().includes(query));
}

const PAGE_SIZE = 1000;

function loadAllApplications(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return loadAllByKeyset<Application>(
    (afterId) => {
      const query = session.from("applications").select("*").order("id").limit(PAGE_SIZE);
      return afterId ? query.gt("id", afterId) : query;
    },
    { sort: bySubmittedAt },
  );
}

type TierRow = Pick<HiveScore, "application_id" | "status" | "suggested_tier" | "tier_override">;

// Tier badges only; the Hive Mind page has the rest. A failure (e.g. the migration
// isn't applied yet) leaves all the badges off, never just some of them.
async function loadTiers(session: Awaited<ReturnType<typeof requireAdmin>>) {
  const { data } = await loadAllByKeyset<TierRow>(
    (after) => {
      const query = session.from("hive_scores").select("application_id, status, suggested_tier, tier_override").order("application_id").limit(PAGE_SIZE);
      return after ? query.gt("application_id", after) : query;
    },
    { key: "application_id" },
  );
  return new Map((data ?? []).map((row) => [row.application_id, { tier: displayTier(row as HiveScore), overridden: !!row.tier_override }]));
}

async function Applicants({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAdmin("/admin/applicants");
  const { status, q } = await searchParams;
  const filter: Filter = typeof status === "string" && Object.hasOwn(FILTERS, status) ? (status as Filter) : "applied";
  const search = typeof q === "string" ? q.trim() : "";

  // Loads everyone in pages (Supabase returns at most 1000 rows per query), oldest
  // submission first, and filters here.
  const [{ data, error }, tiers] = await Promise.all([loadAllApplications(session), loadTiers(session)]);
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">Applicants couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again.</p>
      </div>
    );
  }

  // Counts follow the search, so the tabs show where a match landed.
  const found = ((data ?? []) as Application[]).filter((app) => !search || matches(app, search.toLowerCase()));
  const count = (key: Filter) => found.filter((app) => applicantStatus(app) === key).length;
  const shown = found.filter((app) => applicantStatus(app) === filter);
  const href = (key: Filter) => `/admin/applicants?${new URLSearchParams({ status: key, ...(search && { q: search }) })}`;

  return (
    <ReviewNotice>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter applicants" className="flex gap-1 overflow-x-auto">
          {(Object.keys(FILTERS) as Filter[]).map((key) => (
            <Link
              key={key}
              href={href(key)}
              aria-current={key === filter ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${key === filter ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              {FILTERS[key]}
              <span className="tabular-nums opacity-70">{count(key)}</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/applicants" className="flex gap-2">
          <input type="hidden" name="status" value={filter} />
          <label className="sr-only" htmlFor="applicant-search">Search by name, email or school</label>
          <input
            id="applicant-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Name, email or school"
            className="min-h-11 w-full min-w-0 rounded-md border border-neutral-300 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 lg:w-64 lg:text-sm"
          />
          <button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
            Search
          </button>
        </form>
      </div>

      {filter === "draft" && (
        <>
          {/* Every draft, not just the ones matching the search. */}
          <DraftReminder ids={((data ?? []) as Application[]).filter((app) => applicantStatus(app) === "draft").map((app) => app.id)} />
          <LastReminder session={session} />
        </>
      )}

      {shown.length ? (
        <Selection
          items={shown.map((app) => ({ id: app.id, label: fullName(app) || app.email }))}
          onDelete={deleteApplicants}
          warning="This removes their account, application and resume for good (for admins, just the application). It can't be undone."
        >
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {shown.map((app) => (
              <ApplicantRow key={app.id} app={app} tier={tiers.get(app.id)} />
            ))}
          </ul>
        </Selection>
      ) : (
        <p className="rounded-lg border border-neutral-200 p-5 text-neutral-600">
          {search ? `Nobody in ${FILTERS[filter]} matches “${search}”.` : EMPTY[filter]}
        </p>
      )}
    </ReviewNotice>
  );
}

// "Days ago" depends on the time, so it's worked out per request.
async function requestTime() {
  await connection();
  return Date.now();
}

// "today", "yesterday", "3 days ago", next to the reminder's date.
function daysAgo(iso: string, now: number) {
  const day = (time: number) => new Date(time).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(Date.parse(iso)))) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// When the last "finish your application" reminder went out, who sent it, and how it went.
async function LastReminder({ session }: { session: Awaited<ReturnType<typeof requireAdmin>> }) {
  const { data: run, error } = await session
    .from("draft_reminder_runs")
    .select("started_at, recipients, sent, failed, skipped, sender:profiles!sent_by(full_name, email)")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const now = await requestTime();

  type Sender = { full_name: string | null; email: string | null };
  const joined = run?.sender as Sender | Sender[] | null | undefined;
  const sender = Array.isArray(joined) ? joined[0] : joined;
  const handled = run ? run.sent + run.failed + run.skipped : 0;

  return (
    <section aria-labelledby="last-reminder-heading" className="mb-4 rounded-lg border border-neutral-200 p-5">
      <h2 id="last-reminder-heading" className="text-sm font-medium text-neutral-600">
        Last reminder
      </h2>
      {error ? (
        <p className="mt-1 text-sm text-red-700">Couldn&apos;t load it. Check the draft_reminder_runs migration has been applied.</p>
      ) : !run ? (
        <p className="mt-1 font-semibold">No reminders sent yet.</p>
      ) : (
        <>
          <p className="mt-1 font-semibold">
            {formatDateTime(run.started_at)} <span className="font-normal text-neutral-600">({daysAgo(run.started_at, now)})</span>
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {sender && <>By {sender.full_name || sender.email} · </>}
            {run.sent} of {run.recipients} sent
            {run.failed > 0 && ` · ${run.failed} failed`}
            {run.skipped > 0 && ` · ${run.skipped} skipped (already submitted)`}
            {handled < run.recipients && ` · still sending, or stopped early`}
          </p>
        </>
      )}
    </section>
  );
}

const fileButton =
  "inline-flex min-h-11 items-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";

function ApplicantRow({ app, tier }: { app: Application; tier?: { tier: Tier | null; overridden: boolean } }) {
  const name = fullName(app) || app.email;
  const school = [app.university, app.program].filter(Boolean).join(" · ");

  return (
    <li className="flex gap-3 py-4 has-[[data-select]:checked]:bg-amber-50/60">
      <SelectBox id={app.id} label={name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold break-words">{name}</h2>
              {app.status === "submitted" && (
                <Link
                  href={`/admin/hive?${new URLSearchParams({ ...(tier?.tier ? { tier: tier.tier } : { tier: "unscored" }), q: app.email })}`}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                  title="Open in Hive Mind"
                >
                  <TierBadge tier={tier?.tier ?? null} overridden={tier?.overridden} />
                </Link>
              )}
              {app.age !== null && app.age < 18 && <MinorPill age={app.age} />}
            </div>
            <p className="text-sm break-words text-neutral-600">{app.email}</p>
            {school && <p className="text-sm break-words text-neutral-600">{school}</p>}
            {app.submitted_at && <p className="text-sm text-neutral-600">Submitted {formatDateTime(app.submitted_at)}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {app.status === "submitted" && <DecisionControls id={app.id} name={name} decision={app.decision} />}
            <DeleteButton id={app.id} label={name} />
          </div>
        </div>
        <details className="group mt-2">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-2">
            <span className="group-open:hidden">View application</span>
            <span className="hidden group-open:inline">Close application</span>
          </summary>
          <div className="mt-3">
            {(app.resume_path || app.indemnification_path) && (
              <div className="mb-4 flex flex-wrap gap-2">
                {app.resume_path && (
                  <a href={`/admin/applicants/${app.id}/resume`} target="_blank" rel="noreferrer" className={fileButton}>
                    Open resume
                  </a>
                )}
                {app.indemnification_path && (
                  <a href={`/admin/applicants/${app.id}/indemnification`} target="_blank" rel="noreferrer" className={fileButton}>
                    View indemnification form
                  </a>
                )}
              </div>
            )}
            <ApplicationView application={app} />
          </div>
        </details>
      </div>
    </li>
  );
}
