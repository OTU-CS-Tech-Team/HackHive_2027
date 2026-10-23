"use client";

/* eslint-disable @next/next/no-img-element -- profile avatars come from Storage / OAuth providers */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { contactHref, filterTeammates, teamSchools, type TeamProfile } from "@/lib/team/profiles";

const PAGE_SIZE = 12;

export function TeamDirectory({ profiles }: { profiles: TeamProfile[] }) {
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [githubOnly, setGithubOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const schools = useMemo(() => teamSchools(profiles), [profiles]);
  const filtered = useMemo(() => filterTeammates(profiles, search, school, githubOnly), [profiles, search, school, githubOnly]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const clearFilters = () => { setSearch(""); setSchool(""); setGithubOnly(false); setPage(1); };

  return <section aria-labelledby="directory-heading">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="directory-heading" className="text-xl font-semibold">Meet your next teammates</h2>
        <p className="mt-1 text-sm text-neutral-600">{profiles.length.toLocaleString("en-US")} {profiles.length === 1 ? "hacker is" : "hackers are"} looking. Your own profile is shown above.</p>
      </div>
      <button type="button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}
        className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50">
        {refreshing ? "Refreshing…" : "Refresh directory"}
      </button>
    </div>

    <div className="mb-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          Search hackers
          <input type="search" value={search} maxLength={100} placeholder="Name or school" onChange={event => { setSearch(event.target.value); setPage(1); }}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          School
          <select value={school} onChange={event => { setSchool(event.target.value); setPage(1); }} className="w-full rounded border border-neutral-300 bg-white px-3 py-2">
            <option value="">All schools</option>
            {schools.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={githubOnly} onChange={event => { setGithubOnly(event.target.checked); setPage(1); }} />
          Has a GitHub profile
        </label>
        {(search || school || githubOnly) && <button type="button" onClick={clearFilters} className="text-sm underline underline-offset-4">Clear filters</button>}
      </div>
    </div>

    <p role="status" aria-live="polite" className="mb-4 text-sm text-neutral-600">
      {filtered.length ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} hackers` : "No matching hackers"}
    </p>
    {visible.length ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map(profile => {
        const email = contactHref(profile);
        const links = [["Connect on Slack", profile.slackUrl], ["View GitHub", profile.githubUrl], ["Connect on LinkedIn", profile.linkedinUrl], ["View Instagram", profile.instagramUrl]];
        return <li key={profile.id} className="flex min-w-0 flex-col rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-3">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-12 shrink-0 rounded-full object-cover" />
              : <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-semibold text-amber-900">{Array.from(profile.name)[0]?.toUpperCase()}</span>}
            <div className="min-w-0">
              <h3 className="break-words font-semibold">{profile.name}</h3>
              <p className="mt-0.5 break-words text-sm text-neutral-600">{profile.school || "School not added"}</p>
            </div>
          </div>
          <span className="mt-4 self-start rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Looking for teammates</span>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {links.filter(([, href]) => href).map(([label, href]) => <a key={label} href={href!} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center justify-between gap-2 rounded border px-3 py-2 font-medium ${label === "Connect on Slack" ? "border-amber-300 bg-amber-50 hover:bg-amber-100" : "border-neutral-300 hover:bg-neutral-50"}`}
              aria-label={`${label}: ${profile.name} (opens in a new tab)`}>{label}<span aria-hidden="true">↗</span></a>)}
          </div>
          <div className="mt-auto pt-5">
            {email ? <a href={email} className="inline-flex w-full items-center justify-center rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700" aria-label={`Email ${profile.name} to connect`}>Email to connect</a>
              : <p className="text-sm text-neutral-500">{links.some(([, href]) => href) ? "Connect through a profile link above." : "No contact links added yet."}</p>}
          </div>
        </li>;
      })}
    </ul> : <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
      <h3 className="text-lg font-semibold">{profiles.length ? "Try a wider search" : "The next great team could start with you"}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-600">{profiles.length ? "Clear a filter or try another name or school. You can team up across schools." : "No other hackers are listed yet. Make yourself discoverable above, then check back as more hackers join."}</p>
      {profiles.length > 0 && <button type="button" onClick={clearFilters} className="mt-4 text-sm underline underline-offset-4">Show all hackers</button>}
    </div>}

    {pageCount > 1 && <nav aria-label="Teammate directory pages" className="mt-6 flex items-center justify-between gap-3 text-sm">
      <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded border px-4 py-2 disabled:opacity-40">← Previous</button>
      <span className="text-neutral-600">{currentPage} / {pageCount}</span>
      <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded border px-4 py-2 disabled:opacity-40">Next →</button>
    </nav>}
  </section>;
}
