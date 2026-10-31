"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import type { Decision } from "@/lib/application/decision-email";
import { resendDecisionEmail, setDecision, type ActionResult } from "../actions";

const button = "inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";
const quietButton = "inline-flex min-h-11 items-center rounded-md px-2 text-sm underline underline-offset-2 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";

const ACTIONS: { decision: Decision; label: string; className: string }[] = [
  { decision: "accepted", label: "Accept", className: "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700" },
  { decision: "waitlisted", label: "Waitlist", className: "border-neutral-300 hover:bg-neutral-100" },
  { decision: "rejected", label: "Reject", className: "border-red-300 text-red-700 hover:bg-red-50" },
];

const NoticeContext = createContext<(result: ActionResult) => void>(() => {});

// Lives above the list: a decided applicant leaves the Pending filter straight
// away, and an "email failed" warning can't disappear along with their row.
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

export function DecisionControls({ id, name, decision }: { id: string; name: string; decision: Decision | null }) {
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

  return (
    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
      {ACTIONS.filter((action) => action.decision !== decision).map((action) => (
        <button
          key={action.decision}
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`${action.label} ${name}? This emails them right away.`)) {
              run(() => setDecision(id, action.decision));
            }
          }}
          className={`${button} ${action.className}`}
        >
          {action.label}
        </button>
      ))}
      {decision && (
        <>
          <button type="button" disabled={pending} onClick={() => run(() => setDecision(id, null))} className={quietButton}>
            Move to pending
          </button>
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
        </>
      )}
    </div>
  );
}
