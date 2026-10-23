import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadTeamDirectory } from "@/lib/team/load-directory";
import { ListingControl } from "./ListingControl";
import { TeamDirectory } from "./TeamDirectory";

export const metadata: Metadata = { title: "Find a team | HackHive 2027" };

export default function TeamPage() {
  return <main className="mx-auto max-w-6xl px-4 pt-24 pb-16">
    <Link href="/dashboard" className="text-sm text-neutral-600 underline">← Hacker hub</Link>
    <header className="mt-5 mb-8">
      <p className="mb-2 text-sm font-medium text-amber-700">HackHive 2027 · Better together</p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find your people. Build something great.</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">Coming solo? Still looking for one more teammate? Meet other hackers, compare ideas, and find people you&apos;d enjoy building with.</p>
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
    <p className="mt-2 text-sm">Your listing hasn&apos;t changed. Reload the page to try again.</p>
    <a href="/dashboard/team" className="mt-4 inline-block text-sm underline">Reload directory</a>
  </div>;
  return <div className="space-y-8">
    <ListingControl listed={result.listed} name={result.own.name} school={result.own.school} />
    <aside aria-label="Team formation tips" className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5 sm:grid-cols-3">
      {[
        ["01", "Find a shared idea", "Talk about what excites you, even if you haven't picked a project yet."],
        ["02", "Mix your strengths", "Discuss coding, design, research, and pitching. Every role helps."],
        ["03", "Agree on a plan", "Compare goals and availability, then decide what you can build together."],
      ].map(([step, title, detail]) => <div key={step}>
        <p className="text-xs font-semibold text-amber-700">{step}</p>
        <h2 className="mt-1 font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{detail}</p>
      </div>)}
    </aside>
    <TeamDirectory profiles={result.profiles} />
  </div>;
}
