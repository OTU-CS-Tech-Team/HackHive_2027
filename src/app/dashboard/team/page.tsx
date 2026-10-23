import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadTeamDirectory } from "@/lib/team/load-directory";
import { ListingControl } from "./ListingControl";
import { secondaryButton } from "./styles";
import { TeamDirectory } from "./TeamDirectory";

export const metadata: Metadata = { title: "Find a team | HackHive 2027" };

export default function TeamPage() {
  return <main className="mx-auto max-w-6xl px-4 pt-20 pb-8">
    <header className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find your team</h1>

        <Link href="/dashboard" className={secondaryButton}>← Hacker hub</Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">Meet fellow hackers, compare ideas, and connect on Slack.</p>
    </header>
    <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Finding fellow hackers…</p>}>
      <TeamContent />
    </Suspense>
  </main>;
}

async function TeamContent() {
  const result = await loadTeamDirectory();
  if (!result.ok) return <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
    <h2 className="font-semibold">The teammate directory couldn&apos;t be loaded</h2>
    <p className="mt-2 text-sm">Reload to try again.</p>
    <a href="/dashboard/team" className={`${secondaryButton} mt-3`}>Reload directory</a>
  </div>;
  return <div className="space-y-4">
    <ListingControl listed={result.listed} name={result.own.name} school={result.own.school} />
    <TeamDirectory profiles={result.profiles} />
  </div>;
}
