import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApplicationView, applicantStatus } from "@/components/ApplicationView";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { Application } from "@/lib/application/schema";
import { formatDateTime } from "@/lib/time";
import { DecisionControls, DeleteApplicant, ReviewNotice } from "./DecisionControls";

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
    <main className="mx-auto max-w-5xl px-4 pt-20 pb-8">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Applicants</h1>
        <Link href="/admin" className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">← Admin</Link>
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

async function Applicants({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAdmin("/admin/applicants");
  const { status, q } = await searchParams;
  const filter: Filter = typeof status === "string" && Object.hasOwn(FILTERS, status) ? (status as Filter) : "applied";
  const search = typeof q === "string" ? q.trim() : "";

  // ponytail: loads everyone and filters here, capped by Supabase's 1000-row limit. Filter in the query past that.
  const { data, error } = await session.from("applications").select("*").order("submitted_at", { ascending: true, nullsFirst: false });
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

      {shown.length ? (
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {shown.map((app) => (
            <ApplicantRow key={app.id} app={app} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-neutral-200 p-5 text-neutral-600">
          {search ? `Nobody in ${FILTERS[filter]} matches “${search}”.` : EMPTY[filter]}
        </p>
      )}
    </ReviewNotice>
  );
}

function ApplicantRow({ app }: { app: Application }) {
  const name = fullName(app) || app.email;
  const school = [app.university, app.program].filter(Boolean).join(" · ");

  return (
    <li className="py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold break-words">{name}</h2>
          <p className="text-sm break-words text-neutral-600">{app.email}</p>
          {school && <p className="text-sm break-words text-neutral-600">{school}</p>}
          {app.submitted_at && <p className="text-sm text-neutral-600">Submitted {formatDateTime(app.submitted_at)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {app.status === "submitted" && <DecisionControls id={app.id} name={name} decision={app.decision} />}
          <DeleteApplicant id={app.id} email={app.email} />
        </div>
      </div>
      <details className="mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-2">View application</summary>
        <div className="mt-3">
          {app.resume_path && (
            <a
              href={`/admin/applicants/${app.id}/resume`}
              target="_blank"
              rel="noreferrer"
              className="mb-4 inline-flex min-h-11 items-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              Open resume
            </a>
          )}
          <ApplicationView application={app} />
        </div>
      </details>
    </li>
  );
}
