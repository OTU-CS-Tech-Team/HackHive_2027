"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Mail } from "lucide-react";
import { sendDraftReminders, startDraftReminderRun } from "../actions";

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;

// A few per server call, so each call stays short and the progress keeps moving.
const BATCH_SIZE = 10;

type Outcome = { sent: number; skipped: number; failed: { email: string; error: string }[]; stopped?: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The "remind every draft" box on the Drafts tab. Nothing is sent until the admin
// confirms in the dialog; then the drafts go out in small batches with a progress bar.
export function DraftReminder({ ids }: { ids: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const sending = progress !== null;
  const count = ids.length;

  const ask = () => {
    if (!count || sending) return;
    dialog.current!.returnValue = "";
    dialog.current!.showModal();
  };

  const send = async () => {
    // Fixed at confirm time, so drafts started after this aren't emailed mid-run.
    const batches = Array.from({ length: Math.ceil(ids.length / BATCH_SIZE) }, (_, i) => ids.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE));
    const total: Outcome = { sent: 0, skipped: 0, failed: [] };
    setOutcome(null);
    setProgress({ done: 0, total: ids.length });

    let runId: string;
    try {
      const run = await startDraftReminderRun(ids.length);
      if (!run.ok) throw new Error(run.message);
      runId = run.runId;
    } catch (error) {
      setProgress(null);
      setOutcome({ ...total, stopped: `Nothing was sent. ${error instanceof Error ? error.message : "Try again."}` });
      return;
    }

    for (const [i, batch] of batches.entries()) {
      try {
        const result = await sendDraftReminders(batch, runId);
        if (!result.ok) {
          total.stopped = result.message;
          break;
        }
        total.sent += result.sent;
        total.skipped += result.skipped;
        total.failed.push(...result.failed);
      } catch {
        total.stopped = "The connection dropped. Check your internet and try again.";
        break;
      }
      setProgress({ done: Math.min((i + 1) * BATCH_SIZE, ids.length), total: ids.length });
    }
    setProgress(null);
    setOutcome(total);
  };

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  };

  const good = outcome && !outcome.stopped && outcome.failed.length === 0;

  return (
    <section aria-labelledby="draft-reminder-heading" className="mb-4 rounded-lg border border-neutral-200 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="draft-reminder-heading" className="font-semibold">
            Remind unfinished applicants
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Email everyone with a draft a friendly reminder to finish and submit their application.
          </p>
        </div>
        <button type="button" onClick={ask} disabled={!count || sending} className={`${button} shrink-0 bg-neutral-900 text-white hover:bg-neutral-700`}>
          <Mail className="size-4" aria-hidden />
          {count ? `Email ${plural(count, "draft")}` : "No drafts to email"}
        </button>
      </div>

      <div role="status" className="empty:hidden">
        {progress && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span>Sending reminders… keep this page open.</span>
              <span className="tabular-nums text-neutral-600">
                {progress.done} of {progress.total}
              </span>
            </div>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
        {outcome && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${good ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}
          >
            <p>
              Sent {plural(outcome.sent, "reminder")}.
              {outcome.skipped > 0 && ` Skipped ${outcome.skipped} who submitted in the meantime.`}
              {outcome.failed.length > 0 && ` ${plural(outcome.failed.length, "email")} failed.`}
              {outcome.stopped && ` Stopped early: ${outcome.stopped}`}
            </p>
            {outcome.failed.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer underline underline-offset-2">Show failed emails</summary>
                <ul className="mt-2 list-disc pl-5 [overflow-wrap:anywhere]">
                  {outcome.failed.map((failure) => (
                    <li key={failure.email}>
                      {failure.email}: {failure.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Cancel comes first, so it has focus and Enter backs out. */}
      <dialog
        ref={dialog}
        onClick={closeOnBackdrop}
        onClose={() => dialog.current?.returnValue === "confirm" && void send()}
        aria-labelledby="draft-reminder-confirm"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-neutral-950/40"
      >
        <form method="dialog" className="flex flex-col gap-3 p-6">
          <h2 id="draft-reminder-confirm" className="text-lg font-semibold">
            Email all {plural(count, "applicant")} with a draft?
          </h2>
          <p className="text-sm text-neutral-600">
            Each of them gets an email saying: &ldquo;We noticed you haven&apos;t submitted your HackHive 2027 application yet. This is
            just a friendly reminder to finish it!&rdquo; with a link back to their application.
          </p>
          <p className="text-sm text-neutral-600">Emails can&apos;t be unsent.</p>
          <div className="mt-2 flex justify-end gap-2">
            <button value="cancel" className={`${button} border border-neutral-300 hover:bg-neutral-100`}>
              Cancel
            </button>
            <button value="confirm" className={`${button} bg-neutral-900 text-white hover:bg-neutral-700`}>
              Confirm and send
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
