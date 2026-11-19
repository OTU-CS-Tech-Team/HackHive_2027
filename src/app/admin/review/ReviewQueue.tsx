"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState, useTransition, type ReactNode } from "react";
import { TIERS, TIER_EMOJI, TIER_LABELS, type Tier } from "@/lib/hive/tier";
import { VOTE_LABELS, formatApplicantNo, type Vote } from "@/lib/review/pools";
import { addNote, castVote, loadNotes, moveTier, type NoteView, type ReviewResult } from "./actions";

// One applicant at a time. Knows them only by number; the server looks up the
// rest. After a vote the page re-renders with the next applicant, and the one
// you just voted on stays here so you can read and add notes.

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const base = `inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ring}`;
const field = `min-h-11 rounded-md border border-hive-line bg-white px-3 py-2 text-base lg:text-sm ${ring}`;
const quiet = "border-hive-line bg-white text-hive-ink hover:bg-hive-panel";
const kbd = "ml-2 hidden rounded border px-1.5 text-xs font-semibold lg:inline";

/** Y and N vote from the keyboard, unless you're typing somewhere. */
const KEYS: Record<string, Vote> = { y: "yes", n: "no" };
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

type Voted = { applicantNo: number; vote: Vote };

export function ReviewQueue({
  tier,
  applicantNo,
  facts,
  children,
}: {
  tier: Tier;
  applicantNo: number | null;
  /** Number, scores and flags, shown in the side rail. */
  facts: ReactNode;
  /** The answers and resume. */
  children: ReactNode;
}) {
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

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const choice = KEYS[event.key.toLowerCase()];
    // event.repeat: a held key must never vote again on the next applicant before they've been seen.
    if (!choice || event.repeat || pending || applicantNo === null || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    event.preventDefault();
    vote(choice);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

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
        <div className="rounded-xl bg-hive-panel p-8 text-center ring-1 ring-hive-line">
          <p className="font-display text-lg font-semibold text-hive-ink">You&apos;re all caught up in this tier.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-hive-muted">
            Everyone left in {TIER_EMOJI[tier]} {TIER_LABELS[tier]} is decided, already has your vote, or is open for another admin
            right now. Try another tier.
          </p>
          <Link href="/admin/review" className={`mt-5 ${base} ${quiet}`}>
            Back to Reviews
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12 lg:pb-0">
          <aside aria-label="Applicant summary" className="lg:order-2">
            <div className="space-y-4 lg:sticky lg:top-6">
              <div className="rounded-xl bg-white p-5 ring-1 ring-hive-line">{facts}</div>

              {/* Pinned to the bottom on phones; part of the rail on wide screens. */}
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hive-line bg-white/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => vote("yes")}
                    className={`${base} border-green-800 bg-green-700 text-white hover:bg-green-800`}
                  >
                    Yes<kbd className={`${kbd} border-white/40`}>Y</kbd>
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => vote("no")}
                    className={`${base} border-red-300 bg-white text-red-700 hover:bg-red-50`}
                  >
                    No<kbd className={`${kbd} border-red-200`}>N</kbd>
                  </button>
                  <button type="button" disabled={pending} onClick={() => vote("skip")} className={`col-span-2 ${base} ${quiet}`}>
                    I know this person
                  </button>
                </div>
              </div>

              <MoveTier key={applicantNo} applicantNo={applicantNo} tier={tier} pending={pending} run={run} />
              <p className="px-1 text-xs leading-relaxed text-hive-muted">
                Other admins&apos; notes stay hidden until you vote, so they can&apos;t sway you.
              </p>
            </div>
          </aside>

          <div className={`lg:order-1 ${pending ? "opacity-60 transition-opacity motion-reduce:transition-none" : ""}`}>{children}</div>
        </div>
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
    <details className="rounded-xl bg-white ring-1 ring-hive-line">
      <summary className={`flex min-h-11 cursor-pointer items-center rounded-xl px-4 text-sm font-medium text-hive-ink ${ring}`}>
        Move to a different tier
      </summary>
      <form
        className="flex flex-col gap-3 border-t border-hive-line p-4"
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
        <label className="flex flex-col gap-1 text-sm font-medium">
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
        <button type="submit" disabled={pending || !target || !reason.trim()} className={`${base} ${quiet}`}>
          Move tier
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
      className="rounded-xl bg-hive-honey-soft ring-1 ring-hive-honey/40"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open && notes === null) refresh();
      }}
    >
      <summary className={`flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 rounded-xl px-4 text-sm text-hive-ink ${ring}`}>
        <span>
          You voted <strong>{VOTE_LABELS[voted.vote]}</strong> on {formatApplicantNo(voted.applicantNo)}.
        </span>
        <span className="font-medium underline underline-offset-2">Read or add notes</span>
      </summary>
      <div className="space-y-3 border-t border-hive-honey/40 p-4">
        {notes === null ? (
          <p className="text-sm text-hive-muted">{pending ? "Loading notes…" : message}</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-hive-muted">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="text-sm">
                <p className="break-words whitespace-pre-wrap">{note.body}</p>
                <p className="text-xs text-hive-muted">
                  {note.author}, {note.at}
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
            <button type="submit" disabled={pending || !draft.trim()} className={`${base} ${quiet}`}>
              Save note
            </button>
          </div>
        </form>
        {notes !== null && message && <p className="text-sm text-red-800">{message}</p>}
      </div>
    </details>
  );
}
