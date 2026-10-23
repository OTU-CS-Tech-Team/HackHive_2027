import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadAdminStats } from "@/lib/admin/load-stats";
import { formatDateTime } from "@/lib/time";
import { RefreshStats } from "./RefreshStats";
import { StatsOverview } from "./StatsOverview";

export const metadata: Metadata = { title: "Stats | HackHive 2027" };

export default function StatsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-24 pb-16">
      <Link href="/admin" className="text-sm text-neutral-600 underline">← Admin dashboard</Link>
      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-amber-700">HackHive 2027</p>
          <h1 className="text-3xl font-bold tracking-tight">Hackathon stats</h1>
          <p className="mt-2 text-neutral-600">Applications, hacker community, and event planning at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin#applications" className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">Review applications</Link>
          <RefreshStats />
        </div>
      </header>
      <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Loading hackathon stats…</p>}>
        <StatsContent />
      </Suspense>
    </main>
  );
}

async function StatsContent() {
  const result = await loadAdminStats();
  if (!result.ok) return (
    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h2 className="font-semibold">Stats couldn&apos;t be loaded</h2>
      <p className="mt-1 text-sm">Refresh to try again. If this continues, ask the site maintainer to check stats setup.</p>
    </div>
  );
  return <>
    <StatsOverview stats={result.stats} />
    <p className="mt-6 text-xs text-neutral-500">Updated {formatDateTime(result.updatedAt)} (Eastern). Refresh to load the latest numbers.</p>
  </>;
}
