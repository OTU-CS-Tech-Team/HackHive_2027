"use client";

import { useState, type ReactNode } from "react";
import { TIERS, TIER_EMOJI, TIER_LABELS, type Tier } from "@/lib/hive/tier";
import type { TierFilter } from "@/lib/hive/view";

// Tier and search filtering happen here, in the browser: every row is rendered
// once on the server and only shown or hidden, so switching tiers is instant
// instead of reloading everyone from the database. The URL still tracks the
// filter (replaceState), so a refresh or a shared link opens the same view.

export type BrowserRow = { id: string; tier: Tier | null; text: string; node: ReactNode };

const FILTER_LABELS: Record<TierFilter, string> = {
  all: "All",
  queen: `${TIER_EMOJI.queen} ${TIER_LABELS.queen}`,
  worker: `${TIER_EMOJI.worker} ${TIER_LABELS.worker}`,
  larva: `${TIER_EMOJI.larva} ${TIER_LABELS.larva}`,
  unscored: "Unscored",
};
const FILTERS: TierFilter[] = ["all", ...TIERS.toReversed(), "unscored"];

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const chip = `inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${ring}`;

function syncUrl(filter: TierFilter, search: string) {
  const params = new URLSearchParams(window.location.search);
  if (filter === "all") params.delete("tier");
  else params.set("tier", filter);
  if (search) params.set("q", search);
  else params.delete("q");
  const query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
}

export function HiveBrowser({
  initialFilter,
  initialSearch,
  counts,
  unscoredCard,
  rows,
}: {
  initialFilter: TierFilter;
  initialSearch: string;
  counts: Record<Tier, { total: number; accepted: number }>;
  unscoredCard: ReactNode; // server-rendered, holds the "Score now" button
  rows: BrowserRow[]; // already in review order
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState(initialSearch);

  const choose = (next: TierFilter) => {
    setFilter(next);
    syncUrl(next, search.trim());
  };
  const type = (next: string) => {
    setSearch(next);
    syncUrl(filter, next.trim());
  };

  const query = search.trim().toLowerCase();
  const visible = (row: BrowserRow) =>
    (filter === "all" || (filter === "unscored" ? !row.tier : row.tier === filter)) && (!query || row.text.includes(query));
  const shown = rows.filter(visible).length;

  return (
    <>
      <section aria-label="Tier summary" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.toReversed().map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => choose(tier)}
            aria-pressed={filter === tier}
            className={`rounded-lg border p-4 text-left hover:bg-neutral-50 ${ring} ${filter === tier ? "border-neutral-900" : "border-neutral-200"}`}
          >
            <span className="block text-sm font-medium">
              <span aria-hidden>{TIER_EMOJI[tier]}</span> {TIER_LABELS[tier]}
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums">{counts[tier].total}</span>
            <span className="block text-sm text-neutral-600 tabular-nums">{counts[tier].accepted} accepted</span>
          </button>
        ))}
        {unscoredCard}
      </section>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter by tier" className="flex gap-1 overflow-x-auto">
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              aria-pressed={key === filter}
              className={`${chip} ${key === filter ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
        <form role="search" className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="hive-search">
            Search by name, email or school
          </label>
          <input
            id="hive-search"
            type="search"
            value={search}
            onChange={(event) => type(event.target.value)}
            placeholder="Name, email or school"
            className={`min-h-11 w-full min-w-0 rounded-md border border-neutral-300 px-3 py-2 text-base lg:w-64 lg:text-sm ${ring}`}
          />
        </form>
      </div>

      <p role="status" className="sr-only">
        {shown} shown
      </p>
      {/* Hidden rather than removed, so open details and half-typed reasons survive a tier switch. */}
      <ul className="divide-y divide-neutral-200 border-y border-neutral-200" hidden={!shown}>
        {rows.map((row) => (
          <li key={row.id} className="py-4" hidden={!visible(row)}>
            {row.node}
          </li>
        ))}
      </ul>
      {!shown && (
        <p className="rounded-lg border border-neutral-200 p-5 text-neutral-600">
          {query ? `Nobody in ${FILTER_LABELS[filter]} matches “${search.trim()}”.` : rows.length ? "Nobody in this tier yet." : "Nobody has submitted yet."}
        </p>
      )}
    </>
  );
}
