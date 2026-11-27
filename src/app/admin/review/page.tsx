import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { Tier } from "@/lib/hive/tier";
import { loadOutcomes, loadPoolCounts, loadTierProgress, poolStats } from "@/lib/review/summary";
import { TierBadge } from "../hive/TierBadge";
import { PoolBars, ReviewHeader } from "./ReviewChrome";

export const metadata: Metadata = { title: "Reviews | HackHive 2027" };

// Work through all three tiers side by side: pools fill in the order reviews
// finish, so a tier reviewed last competes for the fewest seats.
const ORDER: Tier[] = ["queen", "worker", "larva"];

export default function ReviewPage() {
  return (
    <main className="mx-auto max-w-5xl mt-6">
      <ReviewHeader
        description="Two admins vote on each applicant without seeing who they are. 2 Yes places them in a seat pool, 2 No declines them, and a split goes to a third admin. This only places people: stage and release them from the Decisions page."
      />
      <Suspense fallback={<p role="status" className="rounded-lg border border-neutral-200 p-5">Loading reviews…</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}

async function Overview() {
  const session = await requireAdmin("/admin/review");
  const [pools, outcomes] = await Promise.all([loadPoolCounts(session), loadOutcomes(session)]);
  const progress = outcomes.data ? await loadTierProgress(session, outcomes.data) : null;
  if (!outcomes.data || !progress || !pools) {
    return (
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">Reviews couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again. If it keeps failing, check the blind_review migration has been applied.</p>
      </div>
    );
  }

  return (
    <>
      <PoolBars stats={poolStats(pools, outcomes.data)} />

      <section aria-label="Tiers" className="grid gap-4 md:grid-cols-3">
        {ORDER.map((tier) => {
          const { needVotes, done } = progress.progress[tier];
          return (
            <div key={tier} className="flex flex-col rounded-lg border border-neutral-200 p-5">
              <TierBadge tier={tier} />
              <p className="mt-4 text-sm text-neutral-700 tabular-nums">
                <span className="text-3xl font-bold text-neutral-900">{needVotes}</span> need votes · {done} done
              </p>
              <Link
                href={`/admin/review/${tier}`}
                // Opening the queue claims an applicant, so don't do it on hover.
                prefetch={false}
                aria-disabled={needVotes === 0 || undefined}
                className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                  needVotes === 0 ? "border-neutral-200 text-neutral-500" : "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700"
                }`}
              >
                Start reviewing
              </Link>
            </div>
          );
        })}
      </section>

      {progress.unscored > 0 && (
        <p className="mt-4 text-sm text-neutral-600">
          <span className="tabular-nums">{progress.unscored}</span> waiting for the Hive Mind. They can be reviewed once they&apos;re scored (
          <Link href="/admin/hive?tier=unscored" className="underline underline-offset-2">
            Hive Mind
          </Link>
          ).
        </p>
      )}
    </>
  );
}
