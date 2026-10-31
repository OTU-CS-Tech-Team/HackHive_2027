"use client";

import { useState, useTransition } from "react";
import { formatDateTime } from "@/lib/time";
import { deleteItemRequest, loadRequestHistory, reviewItemRequest } from "../actions";

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

const card = "rounded-lg border border-neutral-200 p-5";

// Long emails and item names have no spaces to break at, so let them wrap anywhere
// rather than push the page wider than a phone.
function RequestDetails({ request }: { request: ItemRequest }) {
  return (
    <div className="[overflow-wrap:anywhere]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          #{request.queue_number} · {nameOf(request.requester, "Hacker")}
        </h2>
        <span className="text-sm text-neutral-500">{formatDateTime(request.created_at)}</span>
      </div>
      <ul className="mb-3 list-disc pl-5">
        {request.items.map((item, i) => (
          <li key={i}>
            {item.quantity} × {item.name} <span className="text-sm text-neutral-500">({item.category})</span>
          </li>
        ))}
      </ul>
      {request.team_members.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">Team:</span> {request.team_members.join(", ")}
        </p>
      )}
      {request.details && (
        <p className="text-sm">
          <span className="font-medium">Notes:</span> {request.details}
        </p>
      )}
    </div>
  );
}

// Only the front of the queue gets buttons; the rest are shown so admins can see what's coming.
function NextRequest({ request }: { request: ItemRequest }) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const review = (decision: "accepted" | "rejected") =>
    startTransition(async () => {
      const result = await reviewItemRequest(request.id, decision, note);
      if (!result.ok) setMessage(result.message);
    });

  return (
    <li className={`${card} border-neutral-900`}>
      <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Next up</p>
      <RequestDetails request={request} />
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="Note for the record (optional), e.g. why it was rejected"
        className="mt-4 w-full rounded border border-neutral-300 px-3 py-2"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={pending} onClick={() => review("accepted")} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          Accept
        </button>
        <button disabled={pending} onClick={() => review("rejected")} className="rounded border border-neutral-300 px-4 py-2 disabled:opacity-50">
          Reject
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </li>
  );
}

export function RequestQueue({ requests }: { requests: ItemRequest[] }) {
  if (!requests.length) return <p className="text-neutral-600">No pending requests. The queue is empty.</p>;

  const [next, ...waiting] = requests;
  return (
    <ol className="flex flex-col gap-4">
      <NextRequest key={next.id} request={next} />
      {waiting.map((request) => (
        <li key={request.id} className={`${card} opacity-70`}>
          <RequestDetails request={request} />
        </li>
      ))}
    </ol>
  );
}

// `onDeleted` takes it out of the history straight away, including from pages
// loaded with "Load more", which the page refreshing after the delete doesn't cover.
function DeleteRequest({ request, onDeleted }: { request: ItemRequest; onDeleted: () => void }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!confirm(`Delete request #${request.queue_number}? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteItemRequest(request.id);
      if (!result.ok) setMessage(result.message);
      else onDeleted();
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button disabled={pending} onClick={remove} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-50">
        Delete
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
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

  const removed = (id: string) => setRequests((rows) => rows.filter((row) => row.id !== id));

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">History</h2>
      {!requests.length ? (
        <p className="text-neutral-600">Nothing reviewed yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((request) => {
            const accepted = request.status === "accepted";
            return (
              <li key={request.id} className={card}>
                <span
                  className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                    accepted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {accepted ? "Accepted" : "Rejected"}
                </span>
                <RequestDetails request={request} />
                <p className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600 [overflow-wrap:anywhere]">
                  {accepted ? "Accepted" : "Rejected"} by {nameOf(request.reviewer, "an admin")}
                  {request.reviewed_at && <> · {formatDateTime(request.reviewed_at)}</>}
                </p>
                {request.admin_note && (
                  <p className="text-sm [overflow-wrap:anywhere]">
                    <span className="font-medium">Admin note:</span> {request.admin_note}
                  </p>
                )}
                <DeleteRequest request={request} onDeleted={() => removed(request.id)} />
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <button
          disabled={loading}
          onClick={loadMore}
          className="mt-4 rounded border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50"
        >
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
