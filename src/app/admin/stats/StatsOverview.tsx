"use client";

import { useState } from "react";
import type { ApplicationStats, Breakdown } from "@/lib/admin/stats";

const card = "rounded-lg border border-neutral-200 bg-white p-4";
const number = (value: number) => value.toLocaleString("en-US");
const views = ["Admissions", "Community", "Logistics"] as const;
type View = typeof views[number];

function Distribution({ title, description, rows, total }: { title: string; description?: string; rows: Breakdown; total: number }) {
  const shown = rows.slice(0, 5);
  const remaining = rows.slice(5).reduce((sum, row) => sum + row.count, 0);
  const display = remaining ? [...shown, { label: "Other responses", count: remaining }] : shown;
  return <section className={card}>
    <h2 className="font-semibold">{title}</h2>
    {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
    {display.length ? <ul className="mt-3 space-y-3">
      {display.map(row => <li key={row.label}>
        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 break-words">{row.label}</span>
          <span className="shrink-0 font-medium tabular-nums">{number(row.count)} <span className="font-normal text-neutral-500">· {total ? Math.round(row.count / total * 100) : 0}%</span></span>
        </div>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${total ? row.count / total * 100 : 0}%` }} />
        </div>
      </li>)}
    </ul> : <p className="text-sm text-neutral-500">No submitted applications yet.</p>}
  </section>;
}

export function StatsOverview({ stats }: { stats: ApplicationStats }) {
  const [view, setView] = useState<View>("Admissions");
  return <div className="space-y-4">
    {stats.total === 0 && <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-600">No applications yet. Counts will appear as hackers apply.</p>}
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {([
        ["Submitted", stats.submitted],
        ["Approved", stats.approved],
        ["Pending review", stats.pending],
        ["Last 7 days", stats.lastSevenDays],
      ] as const).map(([label, value], index) => <div key={label} className={`rounded-lg border p-3 sm:p-4 ${index === 0 ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}>
        <dt className="text-sm font-medium text-neutral-600">{label}</dt>
        <dd className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{number(value)}</dd>
      </div>)}
    </dl>
    <nav aria-label="Statistics views" className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
      {views.map(label => <button key={label} type="button" aria-pressed={view === label} onClick={() => setView(label)}
        className={`min-h-11 min-w-0 flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${view === label ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-200"}`}>{label}</button>)}
    </nav>
    <section aria-label={`${view} statistics`} className="grid items-start gap-4 md:grid-cols-2">
      {view === "Admissions" && <>
        <section className={card}>
          <h2 className="font-semibold">Admissions decisions</h2>
          <p className="mt-1 mb-3 text-xs text-neutral-600">{stats.submitted ? `${Math.round((stats.submitted - stats.pending) / stats.submitted * 100)}% reviewed` : "No submissions yet"}</p>
          <dl className="grid grid-cols-4 gap-2">
            {([ ["pending", "Pending"], ["approved", "Approved"], ["waitlisted", "Waitlisted"], ["rejected", "Rejected"] ] as const).map(([key, label]) => <div key={key} className={`rounded-md px-2 py-2 ${key === "approved" ? "bg-green-50" : key === "pending" ? "bg-amber-50" : "bg-neutral-50"}`}>
              <dt className="text-xs text-neutral-600">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{number(stats[key])}</dd>
            </div>)}
          </dl>
        </section>
        <section className={card}>
          <h2 className="font-semibold">Application progress</h2>
          <p className="mt-3 text-3xl font-bold tabular-nums">{stats.total ? `${Math.round(stats.submitted / stats.total * 100)}%` : "—"} <span className="text-sm font-normal text-neutral-600">submitted</span></p>
          <dl className="mt-3 divide-y divide-neutral-100">
            {[["Applications started", stats.total], ["Submitted", stats.submitted], ["Saved drafts", stats.drafts]].map(([label, count]) => <div key={label} className="flex justify-between gap-3 py-2 text-sm"><dt className="text-neutral-600">{label}</dt><dd className="font-semibold tabular-nums">{number(count as number)}</dd></div>)}
          </dl>
        </section>
      </>}
      {view === "Community" && <>
        <Distribution title="Team formation" description={`${number(stats.firstTime)} first-time hackers.`} total={stats.submitted} rows={stats.submitted ? [
          { label: "Looking for teammates", count: stats.lookingForTeam }, { label: "Already has a team", count: stats.hasTeam }, { label: "Participating solo", count: stats.solo },
          { label: "Not provided", count: stats.submitted - stats.lookingForTeam - stats.hasTeam - stats.solo },
        ] : []} />
        <Distribution title="Schools represented" rows={stats.schools} total={stats.submitted} />
      </>}
      {view === "Logistics" && <>
        <section className={card}>
          <h2 className="font-semibold">Planning & support</h2>
          <dl className="mt-2 divide-y divide-neutral-100">
            {[["Travel help requested", stats.travelHelp], ["Dietary responses", stats.dietaryRequests], ["Accessibility responses", stats.accessibilityRequests], ["Experience not provided", stats.experienceUnknown]].map(([label, count]) => <div key={label} className="flex justify-between gap-3 py-2 text-sm"><dt className="text-neutral-600">{label}</dt><dd className="font-semibold tabular-nums">{number(count as number)}</dd></div>)}
          </dl>
        </section>
        <Distribution title="T-shirt sizes" rows={stats.shirts} total={stats.submitted} />
      </>}
    </section>
  </div>;
}
