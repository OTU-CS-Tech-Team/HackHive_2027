"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setTeamListing } from "./actions";

export function ListingControl({ listed, name, school }: { listed: boolean; name: string; school: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return <section id="your-listing" className="scroll-mt-24 rounded-lg border border-neutral-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">Your teammate profile</h2>
        <p className="mt-1 text-sm text-neutral-600">{name}{school ? ` · ${school}` : ""}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${listed ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-700"}`}>
        {listed ? "Discoverable" : "Hidden"}
      </span>
    </div>
    <p className="mt-4 max-w-2xl text-sm text-neutral-600">
      {listed ? "Hackers with access to the hub can find your profile and contact you. Found your people? Hide your listing when you're done looking."
        : "Make yourself discoverable to share your name, school, profile photo, email, and social links with other hackers who have access to the hub."}
    </p>
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <button type="button" disabled={pending} onClick={() => {
        setResult(null);
        startTransition(async () => {
          try { setResult(await setTeamListing(!listed)); }
          catch { setResult({ ok: false, message: "Your listing couldn't be saved. Refresh and try again." }); }
        });
      }} className={`rounded px-4 py-2 text-sm font-medium disabled:opacity-50 ${listed ? "border border-neutral-300 hover:bg-neutral-50" : "bg-neutral-900 text-white hover:bg-neutral-700"}`}>
        {pending ? "Saving…" : listed ? "Hide my listing" : "Make me discoverable"}
      </button>
      <Link href="/dashboard?tab=profile" className="text-sm underline underline-offset-4">Edit profile & connection links</Link>
    </div>
    {result && <p role={result.ok ? "status" : "alert"} className={`mt-3 text-sm ${result.ok ? "text-green-800" : "text-red-700"}`}>{result.message}</p>}
  </section>;
}
