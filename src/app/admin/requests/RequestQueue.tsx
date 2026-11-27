"use client";

import { useState, useTransition, type ReactNode } from "react";
import { formatDateTime } from "@/lib/time";
import { deleteItemRequests, loadRequestHistory, reviewItemRequest, type ActionResult } from "../actions";
import { DeleteButton, SelectBox, Selection } from "../Selection";

export type ItemRequest = {
  id: string;
  queue_number: number;
  items: { category: string; name: string; quantity: number }[];
  team_members: string[];
  details: string | null;
  created_at: string;
  status: "pending" | "accepted" | "rejected";
  reviewed_at: string | null;
  admin_note: string | null;
  requester: Person | null;
  reviewer: Person | null;
};

type Person = { full_name: string | null; email: string | null };

const nameOf = (person: Person | null, fallback: string) => person?.full_name || person?.email || fallback;

// The same buttons, pills and notices as the Applicants and Hive Mind pages.
const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const button = `inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;
const pill = "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";
const emptyState = "rounded-lg border border-neutral-200 p-5 text-neutral-600";

const STATUS = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-900 ring-amber-300" },
  accepted: { label: "Accepted", className: "bg-green-50 text-green-800 ring-green-300" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-800 ring-red-300" },
} as const;

function StatusPill({ status }: { status: ItemRequest["status"] }) {
  return <span className={`${pill} ${STATUS[status].className}`}>{STATUS[status].label}</span>;
}

function Notice({ notice, onDismiss }: { notice: ActionResult | null; onDismiss: () => void }) {
  return (
    <div role="status" className="sticky top-20 z-10">
      {notice && (
        <div
          className={`mb-4 flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm shadow-sm ${notice.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}
        >
          <p>{notice.message}</p>
          <button type="button" onClick={onDismiss} className={`inline-flex min-h-11 items-center rounded-md px-2 underline underline-offset-2 ${ring}`}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// Who asked, what for, and anything they added. Long emails and item names have no
// spaces to break at, so they wrap anywhere rather than push the page wider than a phone.
function RequestDetails({ request, badges }: { request: ItemRequest; badges?: ReactNode }) {
  const name = nameOf(request.requester, "Hacker");
  const email = request.requester?.email;
  return (
    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{name}</h2>
        {badges}
      </div>
      <p className="text-sm text-neutral-600">
        {email && email !== name && `${email} · `}Ticket #{request.queue_number} · Sent {formatDateTime(request.created_at)}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Items">
        {request.items.map((item, i) => (
          <li key={i} className="inline-flex items-baseline gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-sm">
            <span className="font-semibold tabular-nums">{item.quantity}×</span>
            {item.name}
            <span className="text-xs text-neutral-500">{item.category}</span>
          </li>
        ))}
      </ul>
      {(request.team_members.length > 0 || request.details) && (
        <dl className="mt-3 space-y-1 text-sm">
          {request.team_members.length > 0 && (
            <div>
              <dt className="inline font-medium">Team: </dt>
              <dd className="inline text-neutral-700">{request.team_members.join(", ")}</dd>
            </div>
          )}
          {request.details && (
            <div>
              <dt className="inline font-medium">Notes: </dt>
              <dd className="inline text-neutral-700">{request.details}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

// Only the front of the queue gets buttons; the rest are shown so admins can see what's coming.
function NextRequest({ request, notify }: { request: ItemRequest; notify: (result: ActionResult) => void }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const name = nameOf(request.requester, "the hacker");

  const review = (decision: "accepted" | "rejected") =>
    startTransition(async () => {
      try {
        const result = await reviewItemRequest(request.id, decision, note);
        notify(result.ok ? { ok: true, message: `${result.message} An email is on its way to ${name}.` } : result);
      } catch {
        notify({ ok: false, message: "That didn't save. Refresh the page and try again." });
      }
    });

  return (
    <section aria-label="Next up" className="rounded-lg border border-amber-300 bg-amber-50/40 p-5">
      <p className="mb-3 text-xs font-semibold tracking-wide text-amber-800 uppercase">Next up</p>
      <RequestDetails request={request} />
      <label className="mt-4 block text-sm font-medium">
        Note to the hacker <span className="font-normal text-neutral-500">(optional, included in the email)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="e.g. Pick it up at the help desk, or why it was rejected"
          className={`mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base font-normal sm:text-sm ${ring}`}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => review("accepted")}
          className={`${button} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700`}
        >
          Accept
        </button>
        <button type="button" disabled={pending} onClick={() => review("rejected")} className={`${button} border-red-300 bg-white text-red-700 hover:bg-red-50`}>
          Reject
        </button>
        {pending && <span className="text-sm text-neutral-600">Saving…</span>}
      </div>
    </section>
  );
}

export function RequestQueue({ requests }: { requests: ItemRequest[] }) {
  // Lives above the list, so the confirmation stays after the request leaves it.
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [next, ...waiting] = requests;

  return (
    <>
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {!next ? (
        <p className={emptyState}>No pending requests. The queue is empty.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <NextRequest key={next.id} request={next} notify={setNotice} />
          {waiting.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-neutral-600">
                Waiting <span className="tabular-nums opacity-70">{waiting.length}</span>
              </h2>
              <ol className="divide-y divide-neutral-200 border-y border-neutral-200">
                {waiting.map((request, i) => (
                  <li key={request.id} className="flex gap-3 py-4">
                    <span className="w-6 shrink-0 pt-0.5 text-sm font-semibold text-neutral-400 tabular-nums" aria-label={`Place ${i + 2}`}>
                      {i + 2}
                    </span>
                    <RequestDetails request={request} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </>
  );
}

// The history's order: most recently reviewed first (unreviewed last), then by id.
// Matches loadRequestHistory, whose cursor is the last request shown.
function historyOrder(a: ItemRequest, b: ItemRequest) {
  if (a.reviewed_at !== b.reviewed_at) {
    if (a.reviewed_at === null) return 1;
    if (b.reviewed_at === null) return -1;
    return Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at);
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// Adds `incoming` to `rows`, replacing any already there, in history order.
function mergeRows(rows: ItemRequest[], incoming: ItemRequest[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort(historyOrder);
}

// Every accepted and rejected request, most recently reviewed first, a page at a
// time. Everything loaded is kept: when the page refreshes after a review or a
// delete, its new first page is merged in rather than replacing what's shown, so a
// request pushed off the first page doesn't fall into the gap before the next one.
export function RequestHistory({ firstPage, firstPageHasMore }: { firstPage: ItemRequest[]; firstPageHasMore: boolean }) {
  const [requests, setRequests] = useState(firstPage);
  const [hasMore, setHasMore] = useState(firstPageHasMore);
  const [seenFirstPage, setSeenFirstPage] = useState(firstPage);
  const [message, setMessage] = useState("");
  const [loading, startLoading] = useTransition();

  if (firstPage !== seenFirstPage) {
    setSeenFirstPage(firstPage);
    setRequests((rows) => mergeRows(rows, firstPage));
    setHasMore((more) => more || firstPageHasMore);
  }

  const loadMore = () => {
    const last = requests.at(-1);
    if (!last) return;
    setMessage("");
    startLoading(async () => {
      const page = await loadRequestHistory({ reviewedAt: last.reviewed_at, id: last.id });
      if (!page.ok) return setMessage(page.message);
      setRequests((rows) => mergeRows(rows, page.requests));
      setHasMore(page.hasMore);
    });
  };

  // Drops them here too, including from pages loaded with "Load more",
  // which the page refreshing after the delete doesn't cover.
  const remove = async (ids: string[]) => {
    const result = await deleteItemRequests(ids);
    const deleted = new Set(result.deleted);
    setRequests((rows) => rows.filter((row) => !deleted.has(row.id)));
    return result;
  };

  return (
    <section aria-label="Reviewed requests">
      {!requests.length ? (
        <p className={emptyState}>Nothing reviewed yet.</p>
      ) : (
        <Selection items={requests.map((request) => ({ id: request.id, label: `Request #${request.queue_number}` }))} onDelete={remove}>
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {requests.map((request) => (
              <li key={request.id} className="flex gap-3 py-4 has-[[data-select]:checked]:bg-amber-50/60">
                <SelectBox id={request.id} label={`request #${request.queue_number}`} />
                <div className="min-w-0 flex-1">
                  <RequestDetails request={request} badges={<StatusPill status={request.status} />} />
                  <p className="mt-3 text-sm text-neutral-600 [overflow-wrap:anywhere]">
                    {STATUS[request.status].label} by {nameOf(request.reviewer, "an admin")}
                    {request.reviewed_at && <> · {formatDateTime(request.reviewed_at)}</>}
                  </p>
                  {request.admin_note && (
                    <p className="mt-1 text-sm [overflow-wrap:anywhere]">
                      <span className="font-medium">Note sent:</span> {request.admin_note}
                    </p>
                  )}
                </div>
                <DeleteButton id={request.id} label={`request #${request.queue_number}`} />
              </li>
            ))}
          </ul>
        </Selection>
      )}
      {hasMore && (
        <button type="button" disabled={loading} onClick={loadMore} className={`${button} mt-4 border-neutral-300 hover:bg-neutral-100`}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-red-700">
          Could not load more: {message}
        </p>
      )}
    </section>
  );
}
