"use client";

import { useState, useTransition } from "react";
import { formatDateTime } from "@/lib/time";
import { deleteItemRequest, reviewItemRequest } from "../actions";

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

function RequestDetails({ request }: { request: ItemRequest }) {
  return (
    <>
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
    </>
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

function DeleteRequest({ request }: { request: ItemRequest }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!confirm(`Delete request #${request.queue_number}? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteItemRequest(request.id);
      if (!result.ok) setMessage(result.message);
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

// Every accepted and rejected request, most recently reviewed first.
export function RequestHistory({ requests }: { requests: ItemRequest[] }) {
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
                <p className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
                  {accepted ? "Accepted" : "Rejected"} by {nameOf(request.reviewer, "an admin")}
                  {request.reviewed_at && <> · {formatDateTime(request.reviewed_at)}</>}
                </p>
                {request.admin_note && (
                  <p className="text-sm">
                    <span className="font-medium">Admin note:</span> {request.admin_note}
                  </p>
                )}
                <DeleteRequest request={request} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
