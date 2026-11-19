"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { isTier, type Tier } from "@/lib/hive/tier";
import { applicationIdFor } from "@/lib/review/blind";
import { formatApplicantNo, isVote, type Vote } from "@/lib/review/pools";
import { formatDateTime } from "@/lib/time";
import { overrideTier } from "../actions";

// Blind review. The queue pages only know an applicant by their number, never
// the application id (which would open the full application), so these look
// the id up on the server. Results-page actions take ids: names are shown there.
// Nothing here sets applications.decision or emails anyone: that's the
// Decisions page.

export type ReviewResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Session = Awaited<ReturnType<typeof requireAdmin>>;

async function currentUserId(session: Session) {
  const {
    data: { user },
  } = await session.auth.getUser();
  return user?.id ?? null;
}

async function hasVoted(session: Session, applicationId: string, userId: string) {
  const { data } = await session
    .from("review_votes")
    .select("vote")
    .eq("application_id", applicationId)
    .eq("admin_id", userId)
    .maybeSingle();
  return !!data;
}

const VOTE_MESSAGES: Record<string, string> = {
  skipped: "Skipped. Someone else will review them.",
  pending: "Vote saved. They need another vote.",
  accepted: "Vote saved. That's 2 Yes: they're placed in a pool, ready for the Decisions page.",
  waitlisted: "Vote saved. That's 2 Yes, but the pools they fit are full: waitlisted.",
  rejected: "Vote saved. That's 2 No: not accepted.",
  decided: "Someone already decided this one. Here's your next applicant.",
  own_application: "That's your own application, so it's been taken out of your queue.",
  not_claimed: "This applicant was handed to someone else after 15 minutes. Here's your next one.",
  already_voted: "You already voted on this one. Here's your next applicant.",
};

export async function castVote(applicantNo: number, vote: Vote): Promise<ReviewResult> {
  const session = await requireAdmin("/admin/review");
  if (!isVote(vote)) return { ok: false, message: "Pick Yes, No or I know this person." };
  const id = await applicationIdFor(session, applicantNo);
  if (!id) return { ok: false, message: "Applicant not found. Refresh the page." };

  // The pool (school and year) is worked out in SQL, so the card never needs them.
  const { data, error } = await session.rpc("cast_review_vote", { p_application_id: id, p_vote: vote });
  revalidatePath("/admin/review", "layout");
  if (error) return { ok: false, message: error.message };
  const result = (data as { result: string }[] | null)?.[0]?.result ?? "";
  const counted = ["skipped", "pending", "accepted", "waitlisted", "rejected"].includes(result);
  return { ok: counted, message: VOTE_MESSAGES[result] ?? "Vote saved." };
}

export type NoteView = { id: number; author: string; body: string; at: string };
export type NotesResult = { ok: true; notes: NoteView[] } | { ok: false; message: string };

/** Notes on an applicant, only once you've voted on them so they can't sway your vote. */
export async function loadNotes(applicantNo: number): Promise<NotesResult> {
  const session = await requireAdmin("/admin/review");
  const [id, userId] = await Promise.all([applicationIdFor(session, applicantNo), currentUserId(session)]);
  if (!id || !userId) return { ok: false, message: "Applicant not found." };
  if (!(await hasVoted(session, id, userId))) return { ok: false, message: "Notes show once you've voted." };

  const { data: notes, error } = await session
    .from("review_notes")
    .select("id, author_id, body, created_at")
    .eq("application_id", id)
    .order("created_at");
  if (error) return { ok: false, message: error.message };
  const authorIds = [...new Set(notes.map((note) => note.author_id).filter((author): author is string => !!author))];
  const { data: authors } = authorIds.length
    ? await session.from("profiles").select("id, full_name, email").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const name = new Map((authors ?? []).map((author) => [author.id, author.full_name || author.email || "Admin"]));
  return {
    ok: true,
    notes: notes.map((note) => ({
      id: note.id,
      author: note.author_id === userId ? "You" : (note.author_id && name.get(note.author_id)) || "Admin",
      body: note.body,
      at: formatDateTime(note.created_at),
    })),
  };
}

export async function addNote(applicantNo: number, body: string): Promise<ReviewResult> {
  const session = await requireAdmin("/admin/review");
  const text = typeof body === "string" ? body.trim().slice(0, 2000) : "";
  if (!text) return { ok: false, message: "Write a note first." };
  const [id, userId] = await Promise.all([applicationIdFor(session, applicantNo), currentUserId(session)]);
  if (!id || !userId) return { ok: false, message: "Applicant not found." };
  if (!(await hasVoted(session, id, userId))) return { ok: false, message: "Vote first, then add a note." };

  const { error } = await session.from("review_notes").insert({ application_id: id, author_id: userId, body: text });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review", "layout");
  return { ok: true, message: "Note added." };
}

/** "Move tier" on the queue card: the same override (and log) as the Hive Mind page. */
export async function moveTier(applicantNo: number, tier: Tier, reason: string): Promise<ReviewResult> {
  const session = await requireAdmin("/admin/review");
  if (!isTier(tier)) return { ok: false, message: "Pick a tier." };
  const id = await applicationIdFor(session, applicantNo);
  if (!id) return { ok: false, message: "Applicant not found. Refresh the page." };
  const result = await overrideTier(id, tier, reason);
  if (!result.ok) return result;
  revalidatePath("/admin/review", "layout");
  return { ok: true, message: `${formatApplicantNo(applicantNo)}: ${result.message} Here's your next applicant.` };
}

/** Clears an outcome and its Yes/No votes (freeing the seat) so the applicant is reviewed again. Skips stay. */
export async function reopenOutcome(id: string): Promise<ReviewResult> {
  const session = await requireAdmin("/admin/review/results");
  if (!UUID.test(id)) return { ok: false, message: "Applicant not found." };
  const { data, error } = await session.rpc("reopen_review", { p_application_id: id });
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Can't reopen: a decision has already been set or staged for them. Change it from the Decisions or Applicants page instead." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Reopened. They're back in the queue." };
}
