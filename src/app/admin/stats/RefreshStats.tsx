"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshStats({ label = "Refresh stats" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} aria-live="polite"
      onClick={() => startTransition(() => router.refresh())}
      className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
      {pending ? "Refreshing…" : label}
    </button>
  );
}
