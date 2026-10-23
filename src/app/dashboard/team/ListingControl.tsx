"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { primaryButton, secondaryButton } from "./styles";
import { setTeamListing } from "./actions";

export function ListingControl({ listed, name, school }: { listed: boolean; name: string; school: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return <section id="your-listing" className="grid gap-x-4 rounded-lg md:grid-cols-[minmax(0,1fr)_auto] border border-neutral-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Your teammate profile</h2>
        <p className="mt-1 text-sm text-neutral-600">{name}{school ? ` · ${school}` : ""}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${listed ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-700"}`}>
        {listed ? "Discoverable" : "Hidden"}
      </span>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 md:col-start-2 md:row-start-1 md:mt-0">
      <button type="button" disabled={pending} onClick={() => {
        setResult(null);
        startTransition(async () => {
          try { setResult(await setTeamListing(!listed)); }
          catch { setResult({ ok: false, message: "Your listing couldn't be saved. Refresh and try again." }); }
        });
      }} className={listed ? secondaryButton : primaryButton}>
        {pending ? "Saving…" : listed ? "Hide my listing" : "Make me discoverable"}
      </button>
      <Link href="/dashboard?tab=profile" className={secondaryButton}>Edit connection links</Link>
    </div>
    {result && <p role={result.ok ? "status" : "alert"} className={`mt-3 text-sm md:col-span-2 ${result.ok ? "text-green-800" : "text-red-700"}`}>{result.message}</p>}
  </section>;
}
