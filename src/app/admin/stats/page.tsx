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
    <main className="mx-auto max-w-5xl px-4 pt-20 pb-8">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hackathon stats</h1>
          <Link href="/admin" className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">← Admin</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin#applications" className="inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">Review applications</Link>
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
      <p className="mt-1 text-sm">Refresh to try again.</p>
    </div>
  );
  return <>
    <StatsOverview stats={result.stats} />
    <p className="mt-3 text-xs text-neutral-500">Updated {formatDateTime(result.updatedAt)} (Eastern).</p>
  </>;
}
