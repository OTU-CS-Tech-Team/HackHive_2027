"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { TIERS, TIER_EMOJI, TIER_LABELS, type Tier } from "@/lib/hive/tier";
import { VOTE_LABELS, formatApplicantNo, type Vote } from "@/lib/review/pools";
import { addNote, castVote, loadNotes, moveTier, type NoteView, type ReviewResult } from "./actions";

// One applicant at a time. Knows them only by number; the server looks up the
// rest. After a vote the page re-renders with the next applicant, and the one
// you just voted on stays here so you can read and add notes.

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const base = `inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;
const field = `min-h-11 rounded-md border border-neutral-300 px-3 py-2 text-base lg:text-sm ${ring}`;

const VOTE_BUTTONS: { vote: Vote; label: string; className: string }[] = [
  { vote: "yes", label: "Yes", className: "border-green-700 bg-green-700 text-white hover:bg-green-800" },
  { vote: "no", label: "No", className: "border-red-300 bg-white text-red-700 hover:bg-red-50" },
  { vote: "skip", label: "I know this person", className: "border-neutral-300 bg-white hover:bg-neutral-100" },
];

type Voted = { applicantNo: number; vote: Vote };

export function ReviewQueue({ tier, applicantNo, children }: { tier: Tier; applicantNo: number | null; children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ReviewResult | null>(null);
  const [voted, setVoted] = useState<Voted | null>(null);

  const run = (action: () => Promise<ReviewResult>, after?: (result: ReviewResult) => void) =>
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(result);
        after?.(result);
      } catch {
        setNotice({ ok: false, message: "That didn't save. Refresh the page and try again." });
      }
    });

  const vote = (choice: Vote) => {
    if (applicantNo === null) return;
    const current = applicantNo;
    run(
      () => castVote(current, choice),
      (result) => {
        if (result.ok) setVoted({ applicantNo: current, vote: choice });
      },
    );
  };

  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite">
        {notice && (
          <p
            className={`rounded-md border px-4 py-2 text-sm ${notice.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}
          >
            {notice.message}
          </p>
        )}
      </div>

      {voted && <JustVoted key={voted.applicantNo} voted={voted} />}

      {applicantNo === null ? (
        <div className="rounded-lg border border-neutral-200 p-6 text-center">
          <p className="font-semibold">Nothing left here you can review.</p>
          <p className="mt-1 text-sm text-neutral-600">
            Everyone in {TIER_EMOJI[tier]} {TIER_LABELS[tier]} is decided, voted on by you, or open for another admin right now.
          </p>
          <Link href="/admin/review" className={`mt-4 ${base} border-neutral-300 hover:bg-neutral-100`}>
            Back to Reviews
          </Link>
        </div>
      ) : (
        <>
          <div className={pending ? "opacity-60 transition-opacity" : undefined}>{children}</div>
          <MoveTier key={applicantNo} applicantNo={applicantNo} tier={tier} pending={pending} run={run} />
          <section aria-label="Notes" className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">
            Notes from other admins are hidden until you vote, so they can&apos;t sway you.
          </section>
          {/* Stays on screen while scrolling the card. */}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-sm font-medium tabular-nums">{formatApplicantNo(applicantNo)}</span>
              {VOTE_BUTTONS.map((button) => (
                <button
                  key={button.vote}
                  type="button"
                  disabled={pending}
                  onClick={() => vote(button.vote)}
                  className={`${base} ${button.className}`}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MoveTier({
  applicantNo,
  tier,
  pending,
  run,
}: {
  applicantNo: number;
  tier: Tier;
  pending: boolean;
  run: (action: () => Promise<ReviewResult>) => void;
}) {
  const [target, setTarget] = useState<Tier | "">("");
  const [reason, setReason] = useState("");
  return (
    <details className="rounded-lg border border-neutral-200">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">Move tier</summary>
      <form
        className="flex flex-col gap-2 border-t border-neutral-200 p-4 lg:flex-row lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (target) run(() => moveTier(applicantNo, target, reason));
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          New tier
          <select value={target} onChange={(event) => setTarget(event.target.value as Tier | "")} className={field}>
            <option value="" disabled>
              Pick a tier…
            </option>
            {TIERS.filter((option) => option !== tier).map((option) => (
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
        <button type="submit" disabled={pending || !target || !reason.trim()} className={`${base} border-neutral-300 hover:bg-neutral-100`}>
          Move
        </button>
      </form>
    </details>
  );
}

function JustVoted({ voted }: { voted: Voted }) {
  const [notes, setNotes] = useState<NoteView[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = () =>
    startTransition(async () => {
      try {
        const result = await loadNotes(voted.applicantNo);
        if (result.ok) setNotes(result.notes);
        else setMessage(result.message);
      } catch {
        setMessage("Notes couldn't be loaded.");
      }
    });

  const save = () =>
    startTransition(async () => {
      try {
        const result = await addNote(voted.applicantNo, draft);
        setMessage(result.ok ? null : result.message);
        if (!result.ok) return;
        setDraft("");
        const fresh = await loadNotes(voted.applicantNo);
        if (fresh.ok) setNotes(fresh.notes);
      } catch {
        setMessage("That note didn't save. Try again.");
      }
    });

  return (
    <details
      className="rounded-lg border border-neutral-200 bg-neutral-50"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open && notes === null) refresh();
      }}
    >
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
        You voted {VOTE_LABELS[voted.vote]} on {formatApplicantNo(voted.applicantNo)} · Notes
      </summary>
      <div className="space-y-3 border-t border-neutral-200 p-4">
        {notes === null ? (
          <p className="text-sm text-neutral-600">{pending ? "Loading notes…" : message}</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-neutral-600">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="text-sm">
                <p className="break-words whitespace-pre-wrap">{note.body}</p>
                <p className="text-xs text-neutral-600">
                  {note.author} · {note.at}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) save();
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            Add a note
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} className={field} />
          </label>
          <div>
            <button type="submit" disabled={pending || !draft.trim()} className={`${base} border-neutral-300 bg-white hover:bg-neutral-100`}>
              Save note
            </button>
          </div>
        </form>
        {notes !== null && message && <p className="text-sm text-red-800">{message}</p>}
      </div>
    </details>
  );
}
