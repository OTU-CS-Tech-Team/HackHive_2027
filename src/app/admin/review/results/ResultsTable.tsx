"use client";

import { useState, useTransition } from "react";
import type { Tier } from "@/lib/hive/tier";
import { POOL_LABELS, WAVE_LIMIT, type Outcome, type Pool, type Vote } from "@/lib/review/pools";
import { TierBadge } from "../../hive/TierBadge";
import { releaseOutcomes, reopenOutcome, type ReviewResult } from "../actions";

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
  releasedAt: string | null;
};

type Filter = "unreleased" | "released" | "all";

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const button = `inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;

const OUTCOME_STYLES: Record<Outcome, string> = {
  accepted: "bg-green-100 text-green-800",
  waitlisted: "bg-yellow-100 text-yellow-800",
  rejected: "bg-neutral-200 text-neutral-800",
};

function outcomeLabel(row: ResultRow) {
  if (row.outcome === "accepted") return `Accepted · ${row.pool ? POOL_LABELS[row.pool] : ""}`;
  if (row.outcome === "waitlisted") return `Waitlist #${row.waitlistPosition}`;
  return "Not accepted";
}

const VOTE_STYLES: Record<Vote, string> = { yes: "text-green-800", no: "text-red-800", skip: "text-neutral-500" };

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  const [filter, setFilter] = useState<Filter>("unreleased");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<ReviewResult | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = rows.filter((row) => filter === "all" || (filter === "released") === !!row.releasedAt);
  const selectable = shown.filter((row) => !row.releasedAt);
  // Rows can be released or reopened by someone else; only count what's still here.
  const chosen = rows.filter((row) => selected.has(row.id) && !row.releasedAt).map((row) => row.id);
  const counts = { unreleased: rows.filter((row) => !row.releasedAt).length, released: rows.filter((row) => row.releasedAt).length, all: rows.length };

  const run = (action: () => Promise<ReviewResult>) =>
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(result);
        setSelected(new Set());
      } catch {
        setNotice({ ok: false, message: "That didn't save. Refresh the page and try again." });
      }
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["unreleased", "released", "all"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={`${button} ${filter === option ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100"}`}
          >
            {option === "unreleased" ? "Not released" : option === "released" ? "Released" : "All"}{" "}
            <span className="ml-1 tabular-nums opacity-75">{counts[option]}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || selectable.length === 0}
            onClick={() => setSelected(new Set(selectable.slice(0, WAVE_LIMIT).map((row) => row.id)))}
            className={`${button} border-neutral-300 hover:bg-neutral-100`}
          >
            Select {Math.min(selectable.length, WAVE_LIMIT)} shown
          </button>
          <button
            type="button"
            disabled={pending || chosen.length === 0 || chosen.length > WAVE_LIMIT}
            onClick={() => {
              if (window.confirm(`Release ${chosen.length} ${chosen.length === 1 ? "outcome" : "outcomes"}? This sets their decision and emails them right away.`)) {
                run(() => releaseOutcomes(chosen));
              }
            }}
            className={`${button} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700`}
          >
            {pending ? "Working…" : `Release selected (${chosen.length})`}
          </button>
        </div>
      </div>
      {chosen.length > WAVE_LIMIT && <p className="mb-3 text-sm text-red-800">Release at most {WAVE_LIMIT} at a time.</p>}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 p-5 text-sm text-neutral-600">Nothing here yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="w-10 px-3 py-2">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="px-3 py-2">Applicant</th>
                <th scope="col" className="px-3 py-2">Tier</th>
                <th scope="col" className="px-3 py-2">Votes</th>
                <th scope="col" className="px-3 py-2">Outcome</th>
                <th scope="col" className="px-3 py-2">Released</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {shown.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-3">
                    {!row.releasedAt && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        aria-label={`Select ${row.name}`}
                        className={`size-5 ${ring}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium break-words">{row.name}</p>
                    <p className="break-words text-neutral-600">
                      {row.email}
                      {row.school && ` · ${row.school}`}
                    </p>
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
                  <td className="px-3 py-3 text-neutral-700">{row.releasedAt ?? "Not yet"}</td>
                  <td className="px-3 py-3">
                    {!row.releasedAt && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Reopen ${row.name}? Their outcome and votes are cleared and they go back in the queue.`)) {
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
