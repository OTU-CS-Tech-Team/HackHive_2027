"use client";

import { useState, useTransition } from "react";
import type { Tier } from "@/lib/hive/tier";
import { POOL_LABELS, type Outcome, type Pool, type Vote } from "@/lib/review/pools";
import { TierBadge } from "../../hive/TierBadge";
import { reopenOutcome, type ReviewResult } from "../actions";

export type ResultRow = {
  id: string;
  name: string;
  email: string;
  school: string | null;
  tier: Tier | null;
  votes: { admin: string; vote: string; raw: Vote }[];
  outcome: Outcome;
  pool: Pool | null;
  waitlistPosition: number | null;
  decidedAt: string;
  /** applications.decision: set once the Decisions page releases them (or someone decides by hand). */
  decision: Outcome | null;
};

type Filter = "waiting" | "decided" | "all";

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const button = `inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;

const OUTCOME_STYLES: Record<Outcome, string> = {
  accepted: "bg-green-100 text-green-800",
  waitlisted: "bg-yellow-100 text-yellow-800",
  rejected: "bg-neutral-200 text-neutral-800",
};

const DECISION_LABELS: Record<Outcome, string> = { accepted: "Accepted", waitlisted: "Waitlisted", rejected: "Not accepted" };

function outcomeLabel(row: ResultRow) {
  if (row.outcome === "accepted") return row.pool ? `Accepted: ${POOL_LABELS[row.pool]}` : "Accepted";
  if (row.outcome === "waitlisted") return `Waitlist #${row.waitlistPosition}`;
  return "Not accepted";
}

const VOTE_STYLES: Record<Vote, string> = { yes: "text-green-800", no: "text-red-800", skip: "text-neutral-500" };

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  const [filter, setFilter] = useState<Filter>("waiting");
  const [notice, setNotice] = useState<ReviewResult | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = rows.filter((row) => filter === "all" || (filter === "decided") === !!row.decision);
  const counts = { waiting: rows.filter((row) => !row.decision).length, decided: rows.filter((row) => row.decision).length, all: rows.length };
  const mismatches = rows.filter((row) => row.decision && row.decision !== row.outcome).length;

  const run = (action: () => Promise<ReviewResult>) =>
    startTransition(async () => {
      try {
        setNotice(await action());
      } catch {
        setNotice({ ok: false, message: "That didn't save. Refresh the page and try again." });
      }
    });

  return (
    <section aria-label="Results">
      <div role="status" aria-live="polite">
        {notice && (
          <p
            className={`mb-4 rounded-md border px-4 py-2 text-sm ${notice.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}
          >
            {notice.message}
          </p>
        )}
      </div>

      {mismatches > 0 && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <strong className="tabular-nums">{mismatches}</strong> {mismatches === 1 ? "applicant has" : "applicants have"} a decision that
          doesn&apos;t match their review outcome (set by hand). They&apos;re marked below.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["waiting", "decided", "all"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={`${button} ${filter === option ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100"}`}
          >
            {option === "waiting" ? "No decision yet" : option === "decided" ? "Decided" : "All"}{" "}
            <span className="ml-1 tabular-nums opacity-75">{counts[option]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 p-5 text-sm text-neutral-600">Nothing here yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold text-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-2">Applicant</th>
                <th scope="col" className="px-3 py-2">Tier</th>
                <th scope="col" className="px-3 py-2">Votes</th>
                <th scope="col" className="px-3 py-2">Review outcome</th>
                <th scope="col" className="px-3 py-2">Decision</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {shown.map((row) => {
                const mismatch = !!row.decision && row.decision !== row.outcome;
                return (
                  <tr key={row.id} className={`align-top ${mismatch ? "bg-amber-50/60" : ""}`}>
                    <td className="px-3 py-3">
                      <p className="font-medium break-words">{row.name}</p>
                      <p className="break-words text-neutral-600">{row.email}</p>
                      {row.school && <p className="break-words text-neutral-600">{row.school}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <TierBadge tier={row.tier} />
                    </td>
                    <td className="px-3 py-3">
                      <ul className="space-y-0.5">
                        {row.votes.map((vote, i) => (
                          <li key={i}>
                            {vote.admin}: <span className={`font-medium ${VOTE_STYLES[vote.raw]}`}>{vote.vote}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${OUTCOME_STYLES[row.outcome]}`}>{outcomeLabel(row)}</span>
                      <p className="mt-1 text-xs text-neutral-600">{row.decidedAt}</p>
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {row.decision ? (
                        <>
                          {DECISION_LABELS[row.decision]}
                          {mismatch && <p className="mt-1 text-xs font-medium text-amber-900">Doesn&apos;t match the review</p>}
                        </>
                      ) : (
                        <span className="text-neutral-500">Not yet</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!row.decision && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Reopen ${row.name}? Their outcome and Yes/No votes are cleared and they go back in the queue.`)) {
                              run(() => reopenOutcome(row.id));
                            }
                          }}
                          className={`${button} border-neutral-300 hover:bg-neutral-100`}
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
