import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import { loadRequestHistory } from "../actions";
import { REQUEST_COLUMNS } from "./query";
import { RequestHistory, RequestQueue, type ItemRequest } from "./RequestQueue";

export const metadata: Metadata = { title: "Item requests | HackHive 2027" };

const VIEWS = { queue: "Queue", history: "History" } as const;
type View = keyof typeof VIEWS;

type SearchParams = Promise<{ view?: string | string[] }>;

export default function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-4xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Item requests</h1>
        <p className="mt-1 text-sm text-neutral-600">
          First come, first served: review the request at the top before moving on. The hacker is emailed your decision.
        </p>
      </header>
      <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Loading requests…</p>}>
        <RequestsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function RequestsContent({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await requireAdmin("/admin/requests");
  const { view: requested } = await searchParams;
  const view: View = requested === "history" ? "history" : "queue";

  // Only the open tab's requests are loaded; the other tab just needs its count.
  // History comes a page at a time (the rest loads from the page), through the same
  // action the "Load more" button uses.
  const [pending, reviewedCount, history] = await Promise.all([
    supabase.from("item_requests").select(REQUEST_COLUMNS).eq("status", "pending").order("queue_number"),
    supabase.from("item_requests").select("*", { count: "exact", head: true }).neq("status", "pending"),
    view === "history" ? loadRequestHistory(null) : null,
  ]);
  if (pending.error || reviewedCount.error || (history && !history.ok)) {
    return (
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">Requests couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again.</p>
      </div>
    );
  }

  const counts: Record<View, number> = { queue: pending.data.length, history: reviewedCount.count ?? 0 };

  return (
    <>
      <nav aria-label="Item request views" className="mb-4 flex gap-1 overflow-x-auto">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <Link
            key={key}
            href={key === "queue" ? "/admin/requests" : `/admin/requests?view=${key}`}
            aria-current={key === view ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${key === view ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
          >
            {VIEWS[key]}
            <span className="tabular-nums opacity-70">{counts[key]}</span>
          </Link>
        ))}
      </nav>
      {view === "queue" ? (
        <RequestQueue requests={pending.data as unknown as ItemRequest[]} />
      ) : (
        history?.ok && <RequestHistory firstPage={history.requests} firstPageHasMore={history.hasMore} />
      )}
    </>
  );
}
