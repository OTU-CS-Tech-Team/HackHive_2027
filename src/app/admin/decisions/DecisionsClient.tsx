"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useReviewAction } from "../applicants/DecisionControls";
import { promoteFromWaitlist, releaseWave, sendWaveEmails, stageDecision } from "./actions";

const primary =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";
const quiet =
  "inline-flex min-h-11 items-center rounded-md px-2 text-sm underline underline-offset-2 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Sends a wave's unsent emails in batches (each its own request, so none hits
 * the time limit) until none are left or a batch sends nothing (everything left
 * is failing, or someone else is sending them right now).
 */
function useSendLoop() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const send = async (waveId: number, total: number) => {
    setSending(true);
    let sent = 0;
    setProgress(`Sending… 0 of ${total}`);
    try {
      for (;;) {
        const result = await sendWaveEmails(waveId);
        sent += result.sent;
        if (result.remaining < 0) {
          setProgress(`Sent ${sent} of ${total}. Stopped: ${result.message} Press Retry to try again.`);
          return;
        }
        if (result.remaining === 0) {
          setProgress(`Done: sent ${sent} of ${total}.`);
          return;
        }
        if (result.sent === 0) {
          setProgress(
            `Sent ${sent} of ${total}. ${result.remaining} still unsent${result.failed ? ` (${result.message})` : " (another admin may be sending them)"}. Press Retry to try again.`,
          );
          return;
        }
        setProgress(`Sending… ${sent} of ${total}${result.failed ? `, some failed (${result.message})` : ""}`);
      }
    } catch {
      setProgress(`Stopped after ${sent} of ${total}. Refresh and press Retry.`);
    } finally {
      setSending(false);
      router.refresh();
    }
  };

  return { sending, progress, send };
}

export function ReleasePanel({
  nextWave,
  accepts,
  waitlists,
  rejections,
  undecided,
}: {
  nextWave: number;
  accepts: number;
  waitlists: number;
  rejections: number;
  undecided: number;
}) {
  const checkboxId = useId();
  const [final, setFinal] = useState(false);
  const [releasing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { sending, progress, send } = useSendLoop();
  const total = accepts + waitlists + (final ? rejections : 0);
  const busy = releasing || sending;

  const release = () => {
    const parts = [plural(accepts, "accept"), plural(waitlists, "waitlist"), ...(final ? [plural(rejections, "rejection")] : [])];
    const held = !final && rejections ? `\n\n${plural(rejections, "rejection")} stay held until the final wave.` : "";
    if (!window.confirm(`Release wave ${nextWave}?\n\nThis emails ${parts.join(", ")} (${total} in all) right away, and accepted hackers get their dashboard.${held}`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await releaseWave(final);
        if (!result.ok || !result.waveId) {
          setError(result.message);
          return;
        }
        setFinal(false);
        await send(result.waveId, total);
      } catch {
        setError("The wave wasn't released. Refresh the page and try again.");
      }
    });
  };

  return (
    <section aria-labelledby="release-heading" className="rounded-xl border border-neutral-300 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="release-heading" className="text-lg font-semibold">Wave {nextWave}</h2>
      <p className="mt-1 text-base tabular-nums">
        {accepts + waitlists === 0 ? (
          "Nothing ready yet."
        ) : (
          <>
            <strong>{plural(accepts, "accept")}</strong> and <strong>{plural(waitlists, "waitlist")}</strong> ready to send.
          </>
        )}
      </p>
      <p className="text-sm text-neutral-600 tabular-nums">
        {rejections > 0 && `${plural(rejections, "rejection")} held for the final wave. `}
        {undecided} not decided yet.
      </p>
      <div className="mt-4 flex flex-col items-start gap-3">
        <label htmlFor={checkboxId} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            id={checkboxId}
            type="checkbox"
            checked={final}
            onChange={(event) => setFinal(event.target.checked)}
            disabled={busy}
            className="size-5 accent-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          />
          Final wave: include rejections
        </label>
        <button type="button" onClick={release} disabled={busy || total === 0} className={primary}>
          {releasing && !sending ? "Releasing…" : sending ? "Sending…" : `Release wave ${nextWave}`}
        </button>
        {(error || progress) && (
          <p role="status" className={`text-sm ${error ? "text-red-700" : "text-neutral-700"}`}>
            {error ?? progress}
          </p>
        )}
      </div>
    </section>
  );
}

export function RetryUnsent({ waveId, unsent }: { waveId: number; unsent: number }) {
  const { sending, progress, send } = useSendLoop();
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={() => send(waveId, unsent)} disabled={sending || unsent === 0} className={secondary}>
        {sending ? "Sending…" : "Retry"}
      </button>
      {progress && (
        <p role="status" className="text-sm text-neutral-700">
          {progress}
        </p>
      )}
    </div>
  );
}

export function PromoteWaitlist({ waitlisted }: { waitlisted: number }) {
  const inputId = useId();
  const [count, setCount] = useState(Math.min(10, Math.max(1, waitlisted)));
  const { pending, run } = useReviewAction();
  const valid = Number.isInteger(count) && count >= 1 && count <= Math.min(500, waitlisted);

  return (
    <form
      className="flex shrink-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) run(() => promoteFromWaitlist(count));
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        How many to promote
      </label>
      <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.min(500, Math.max(1, waitlisted))}
          value={Number.isNaN(count) ? "" : count}
          onChange={(event) => setCount(event.target.valueAsNumber)}
          disabled={waitlisted === 0}
          className="min-h-11 w-20 rounded-md border border-neutral-300 px-3 py-2 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 sm:text-sm"
        />
      <button type="submit" disabled={pending || !valid} className={secondary}>
        {pending ? "Promoting…" : "Promote"}
      </button>
    </form>
  );
}

export function UndoStaged({ id, name }: { id: string; name: string }) {
  const { pending, run } = useReviewAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => stageDecision(id, null))} className={quiet} aria-label={`Undo staged decision for ${name}`}>
      Undo
    </button>
  );
}
