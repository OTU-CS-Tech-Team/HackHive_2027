"use client";

import { useState, useTransition } from "react";
import { scoreHiveBacklog } from "../actions";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";

// Scores in small batches (each a separate request, so none hits the time limit)
// until nothing is left, a whole batch fails (e.g. OpenAI is down), or OpenAI
// is out of credits.
export function ScoreBacklog({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      let scored = 0;
      let failed = 0;
      setProgress(`Scoring… 0 of ${count}`);
      try {
        for (;;) {
          const result = await scoreHiveBacklog();
          if (result.remaining < 0 || result.quota) {
            setProgress(result.message);
            return;
          }
          scored += result.scored;
          failed += result.failed;
          if (result.remaining === 0 || result.scored === 0) {
            setProgress(
              result.remaining === 0
                ? `Done: scored ${scored}.`
                : `Scored ${scored}; ${result.remaining} still failing. Check the errors below and try again later.`,
            );
            return;
          }
          setProgress(`Scoring… ${scored} done, ${result.remaining} left${failed ? `, ${failed} failed so far` : ""}`);
        }
      } catch {
        setProgress(`Stopped after ${scored}. Refresh and try again.`);
      }
    });

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={run} disabled={pending || count === 0} className={button}>
        {count === 0 ? "All scored" : pending ? "Scoring…" : `Score ${count} now`}
      </button>
      <p role="status" className="text-sm text-neutral-600">
        {progress}
      </p>
    </div>
  );
}
