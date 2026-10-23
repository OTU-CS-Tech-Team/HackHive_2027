"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshStats({ label = "Refresh stats" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} aria-live="polite"
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
      {pending ? "Refreshing…" : label}
    </button>
  );
}
