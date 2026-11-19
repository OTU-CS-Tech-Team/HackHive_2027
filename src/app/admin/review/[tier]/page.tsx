import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import { TIERS, TIER_EMOJI, TIER_LABELS, isTier } from "@/lib/hive/tier";
import { claimNextReview, loadBlindCard } from "@/lib/review/blind";
import { BlindCardView } from "../BlindCardView";
import { ReviewQueue } from "../ReviewQueue";

// The blind queue: one applicant at a time. Only the BlindCard (answers, resume sections,
// scores, applicant number) reaches the browser; never the application id.

export const metadata: Metadata = { title: "Blind review | HackHive 2027" };

export function generateStaticParams() {
  return TIERS.map((tier) => ({ tier }));
}

type Params = Promise<{ tier: string }>;

export default function QueuePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/admin/review"
        className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
      >
        ← Reviews
      </Link>
      <Suspense fallback={<p role="status" className="mt-4 rounded-lg border border-neutral-200 p-5">Finding your next applicant…</p>}>
        <Queue params={params} />
      </Suspense>
    </main>
  );
}

async function Queue({ params }: { params: Params }) {
  const { tier } = await params;
  if (!isTier(tier)) notFound();
  const session = await requireAdmin(`/admin/review/${tier}`);

  let claim: Awaited<ReturnType<typeof claimNextReview>>;
  try {
    claim = await claimNextReview(session, tier);
  } catch {
    return (
      <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">The review queue couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again. If it keeps failing, check the blind_review migration has been applied.</p>
      </div>
    );
  }
  const card = claim ? await loadBlindCard(session, claim.applicationId) : null;

  return (
    <>
      <h1 className="mt-2 mb-4 text-2xl font-bold tracking-tight">
        <span aria-hidden>{TIER_EMOJI[tier]}</span> {TIER_LABELS[tier]}
      </h1>
      <ReviewQueue tier={tier} applicantNo={card?.applicantNo ?? null}>
        {card && <BlindCardView card={card} />}
      </ReviewQueue>
    </>
  );
}
