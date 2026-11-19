"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import type { Decision } from "@/lib/application/decision-email";
import { resendDecisionEmail, type ActionResult } from "../actions";
import { stageDecision } from "../decisions/actions";

const button = "inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";
const quietBase = "inline-flex min-h-11 items-center rounded-md px-2 text-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";
const quietButton = `${quietBase} hover:text-neutral-900`;

const ACTIONS: { decision: Decision; label: string; className: string }[] = [
  { decision: "accepted", label: "Accept", className: "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700" },
  { decision: "waitlisted", label: "Waitlist", className: "border-neutral-300 hover:bg-neutral-100" },
  { decision: "rejected", label: "Reject", className: "border-red-300 text-red-700 hover:bg-red-50" },
];

export const DECISION_LABELS: Record<Decision, string> = { accepted: "Accept", waitlisted: "Waitlist", rejected: "Reject" };

const NoticeContext = createContext<(result: ActionResult) => void>(() => {});

// Lives above the list, so a message stays put when the row it came from moves
// or re-renders.
export function ReviewNotice({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ActionResult | null>(null);
  return (
    <NoticeContext.Provider value={setNotice}>
      <div role="status" className="sticky top-20 z-10">
        {notice && (
          <div className={`mb-4 flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm shadow-sm ${notice.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}>
            <p>{notice.message}</p>
            <button type="button" onClick={() => setNotice(null)} className={quietButton}>
              Dismiss
            </button>
          </div>
        )}
      </div>
      {children}
    </NoticeContext.Provider>
  );
}

export function useReviewAction() {
  const notify = useContext(NoticeContext);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      try {
        notify(await action());
      } catch {
        notify({ ok: false, message: "That didn't save. Refresh the page and try again." });
      }
    });

  return { pending, run, notify };
}

export function StagedPill({ decision }: { decision: Decision }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-medium whitespace-nowrap text-amber-900">
      Staged: {DECISION_LABELS[decision]} · not sent yet
    </span>
  );
}

// Clicking a decision only stages it: nothing reaches the applicant until an
// admin releases a wave on the Decisions page.
export function DecisionControls({
  id,
  name,
  decision,
  staged,
}: {
  id: string;
  name: string;
  decision: Decision | null;
  staged: Decision | null;
}) {
  const { pending, run } = useReviewAction();
  const effective = staged ?? decision;

  return (
    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
      {staged && <StagedPill decision={staged} />}
      {ACTIONS.filter((action) => action.decision !== effective).map((action) => (
        <button
          key={action.decision}
          type="button"
          disabled={pending}
          title="Staged for the next wave. Nothing is emailed yet."
          onClick={() => run(() => stageDecision(id, action.decision))}
          className={`${button} ${action.className}`}
        >
          {action.label}
        </button>
      ))}
      {staged && (
        <button type="button" disabled={pending} onClick={() => run(() => stageDecision(id, null))} className={quietButton}>
          Undo
        </button>
      )}
      {decision && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Email ${name} their ${decision} decision again?`)) run(() => resendDecisionEmail(id));
          }}
          className={quietButton}
        >
          Resend email
        </button>
      )}
    </div>
  );
}
