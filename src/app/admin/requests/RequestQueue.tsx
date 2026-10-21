"use client";

import { useState, useTransition } from "react";
import { formatDateTime } from "@/lib/time";
import { reviewItemRequest } from "../actions";

export type ItemRequest = {
  id: string;
  queue_number: number;
  items: { category: string; name: string; quantity: number }[];
  team_members: string[];
  details: string | null;
  created_at: string;
  requester: { full_name: string | null; email: string | null } | null;
};

const card = "rounded-lg border border-neutral-200 p-5";

function RequestDetails({ request }: { request: ItemRequest }) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          #{request.queue_number} · {request.requester?.full_name || request.requester?.email || "Hacker"}
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
