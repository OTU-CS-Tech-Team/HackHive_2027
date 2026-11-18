"use client";

import { useState, useTransition } from "react";
import { minorNote } from "@/lib/hive/flags";
import { MAX_TOTAL, TIERS, TIER_EMOJI, TIER_LABELS, type Tier } from "@/lib/hive/tier";
import { scoreTotal, type HiveScore } from "@/lib/hive/view";
import { overrideTier, rescoreApplicant, type ActionResult } from "../actions";

export type HistoryEntry = { id: number; from: Tier | null; to: Tier | null; reason: string | null; by: string; at: string };

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const button = `inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;
const field = `min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-base lg:text-sm ${ring}`;

const CHECKS = [
  ["built_it", "Built it themselves"],
  ["shipped", "Finished or shipped"],
  ["impact", "Real impact"],
  ["beyond_tutorial", "Beyond a tutorial"],
] as const;

const tierName = (tier: Tier | null) => (tier ? `${TIER_EMOJI[tier]} ${TIER_LABELS[tier]}` : "Unscored");

export function HivePanel({
  id,
  age,
  score,
  history,
  scoredAt,
  scoring,
}: {
  id: string;
  age: number | null;
  score: HiveScore | undefined;
  history: HistoryEntry[];
  scoredAt: string | null; // formatted on the server, so it matches the rest of the page
  scoring: boolean; // a grading is running now (worked out on the server)
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionResult | null>(null);
  // The page remounts this panel when the score changes, so this never goes stale.
  // No score yet → no preselected tier: the admin has to pick one.
  const [tier, setTier] = useState<Tier | "">(score?.tier_override ?? score?.suggested_tier ?? "");
  const [reason, setReason] = useState("");

  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(result);
        if (result.ok) after?.();
      } catch {
        setNotice({ ok: false, message: "That didn't save. Refresh the page and try again." });
      }
    });

  const scored = score?.status === "scored";

  return (
    <section aria-label="Hive Mind" className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <h3 className="font-semibold">
        Hive Mind <span className="text-sm font-normal text-neutral-600">(suggestion only: the decision is yours)</span>
      </h3>

      {age !== null && age < 18 && (
        <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">⚠ {minorNote(age)}</p>
      )}

      {scoring ? (
        <p className="mt-2 text-sm text-neutral-600">Scoring…</p>
      ) : (
        <>
          {!score && <p className="mt-2 text-sm text-neutral-600">Not scored yet.</p>}
          {score?.status === "pending" && <p className="mt-2 text-sm text-neutral-600">Scoring didn&apos;t finish. Re-score to try again.</p>}
          {score?.status === "failed" && (
            <p className="mt-2 text-sm text-red-800">
              Scoring failed {score.attempts} {score.attempts === 1 ? "time" : "times"} in a row: {score.error}
              {score.attempts >= 5 && " “Score now” skips them from here on; use Re-score."}
            </p>
          )}
        </>
      )}
      {scored && score?.error && (
        <p className="mt-2 text-sm text-red-800">Last re-score failed ({score.error}). Showing the earlier score.</p>
      )}

      {scored && score && (
        <>
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {CHECKS.map(([key, label]) => (
              <li key={key} className="flex items-center gap-2">
                <span aria-hidden className={score[key] ? "text-green-700" : "text-neutral-400"}>
                  {score[key] ? "✓" : "✗"}
                </span>
                <span className={score[key] ? "" : "text-neutral-600"}>
                  {label}
                  <span className="sr-only">: {score[key] ? "yes" : "no"}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <strong>Total {scoreTotal(score)}/{MAX_TOTAL}</strong> · Experience {score.experience}/5 · Creativity {score.creativity}/5 · Quality {score.quality}/5 · Suggested{" "}
            {tierName(score.suggested_tier)}
          </p>
          {score.rationale && <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-sm text-neutral-800">{score.rationale}</blockquote>}
          <p className="mt-2 text-xs text-neutral-600">
            Scored by {score.model}
            {scoredAt && ` · ${scoredAt}`}
          </p>
        </>
      )}

      <div className="mt-3">
        <button type="button" disabled={pending || scoring} onClick={() => run(() => rescoreApplicant(id))} className={button}>
          {score ? "Re-score" : "Score now"}
        </button>
      </div>

      {score && (
        <form
          className="mt-4 flex flex-col gap-2 border-t border-amber-200 pt-4 lg:flex-row lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (tier) run(() => overrideTier(id, tier, reason), () => setReason(""));
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            Move tier
            <select value={tier} onChange={(event) => setTier(event.target.value as Tier | "")} className={field}>
              <option value="" disabled>
                Pick a tier…
              </option>
              {TIERS.map((option) => (
                <option key={option} value={option}>
                  {TIER_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Reason (required)
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={500}
              placeholder="e.g. Resume shows two shipped apps"
              className={field}
            />
          </label>
          <button type="submit" disabled={pending || !tier || !reason.trim()} className={button}>
            Save
          </button>
          {score.tier_override && (
            <button type="button" disabled={pending} onClick={() => run(() => overrideTier(id, null, ""))} className={button}>
              Reset to suggested
            </button>
          )}
        </form>
      )}

      <p role="status" className={`mt-2 text-sm ${notice?.ok ? "text-green-800" : "text-red-800"}`}>
        {notice?.message}
      </p>

      {history.length > 0 && (
        <div className="mt-3 border-t border-amber-200 pt-3">
          <h4 className="text-sm font-semibold">Tier changes</h4>
          <ul className="mt-1 space-y-1 text-sm text-neutral-700">
            {history.map((entry) => (
              <li key={entry.id}>
                {entry.at} · {tierName(entry.from)} → {tierName(entry.to)}
                {entry.reason && <> · “{entry.reason}”</>} · {entry.by}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
