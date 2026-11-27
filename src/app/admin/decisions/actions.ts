"use server";

import { revalidatePath } from "next/cache";
import { loadAllByKeyset } from "@/lib/admin/applicants";
import { sendDecisionEmail, type Decision } from "@/lib/application/decision-email";
import { loadStagedDecisions } from "@/lib/decisions/staged";
import { compareForReview, displayTier, type HiveScore } from "@/lib/hive/view";
import { loadOutcomes } from "@/lib/review/summary";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

// Decisions are staged first and only reach applicants when a wave is released.
// Staging emails nobody; release_wave() (SQL) is the only thing that changes
// applications.decision from here, and sendWaveEmails sends what a wave owes.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS: readonly string[] = ["accepted", "waitlisted", "rejected"];
const LABELS: Record<Decision, string> = { accepted: "Accept", waitlisted: "Waitlist", rejected: "Reject" };

// RLS (is_admin) is what actually guards these; this just gives a clear error.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!user || !data) throw new Error("Admins only");
  return { supabase, user };
}

/** Stages a decision for the next wave, or unstages with null. Emails nobody. */
export async function stageDecision(id: string, decision: Decision | null): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (typeof id !== "string" || !UUID.test(id) || (decision !== null && !DECISIONS.includes(decision))) {
    return { ok: false, message: "Pick a decision." };
  }
  const unstage = () => supabase.from("staged_decisions").delete().eq("application_id", id);

  if (decision === null) {
    const { error } = await unstage();
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Unstaged. Nothing was sent." };
  }

  const { data: applicant, error: lookupError } = await supabase.from("applications").select("status, decision").eq("id", id).maybeSingle();
  if (lookupError) return { ok: false, message: lookupError.message };
  if (applicant?.status !== "submitted") return { ok: false, message: "Only submitted applications can get a decision." };

  if (applicant.decision === decision) {
    const { error } = await unstage();
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin", "layout");
    return { ok: true, message: "They already have that decision. Nothing is staged." };
  }

  const { error } = await supabase
    .from("staged_decisions")
    // staged_at is stamped by the database (one clock for the release cutoff).
    .upsert({ application_id: id, decision, staged_by: user.id }, { onConflict: "application_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Staged: ${LABELS[decision]}. It goes out with the next wave.` };
}

export type ReleaseResult = ActionResult & { waveId?: number; released?: number };

/**
 * Releases the staged decisions (rejections only on the final wave) as one wave.
 * `stagedBefore` is the newest staged_at the admin saw when they confirmed, so
 * anything staged or changed after that waits for the next wave instead of
 * being emailed unseen. Emails go out with sendWaveEmails.
 */
export async function releaseWave(includeRejections: boolean, stagedBefore: string): Promise<ReleaseResult> {
  const { supabase } = await requireAdmin();
  if (typeof includeRejections !== "boolean") return { ok: false, message: "Choose whether this is the final wave." };
  if (typeof stagedBefore !== "string" || Number.isNaN(Date.parse(stagedBefore))) {
    return { ok: false, message: "Refresh the page and try again." };
  }

  const { data, error } = await supabase.rpc("release_wave", { p_include_rejections: includeRejections, p_staged_before: stagedBefore });
  if (error) {
    if (error.message.includes("Nothing to release")) return { ok: false, message: "Nothing is staged to release." };
    if (error.message.includes("Emails are still sending")) {
      return { ok: false, message: "Emails from an earlier wave are still sending. Try again in a minute. Nothing was changed." };
    }
    if (error.message.includes("Admins only")) return { ok: false, message: "Admins only." };
    return { ok: false, message: `The wave wasn't released (${error.message}). Nothing was changed.` };
  }
  revalidatePath("/admin", "layout");
  const row = (Array.isArray(data) ? data[0] : data) as { wave_id: number; released: number } | null;
  if (!row) return { ok: false, message: "The wave wasn't released. Refresh the page and try again." };
  return { ok: true, message: "Wave released. Sending emails…", waveId: Number(row.wave_id), released: Number(row.released) };
}

export type SendResult = ActionResult & { sent: number; failed: number; remaining: number };

// Resend's default limit is 2 requests a second; each send can take up to 10s
// (its timeout), so stop starting new ones well before the page's 60s limit.
const BATCH = 25;
const SPACING_MS = 550;
const DEADLINE_MS = 40_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sends the next batch of a wave's unsent emails. The page calls it until nothing is left. */
export async function sendWaveEmails(waveId: number): Promise<SendResult> {
  const { supabase } = await requireAdmin();
  if (!Number.isSafeInteger(waveId) || waveId <= 0) return { ok: false, message: "Unknown wave.", sent: 0, failed: 0, remaining: 0 };

  const started = Date.now();
  const { data, error } = await supabase.rpc("claim_wave_emails", { p_wave_id: waveId, p_limit: BATCH });
  if (error) return { ok: false, message: `Couldn't start sending (${error.message}).`, sent: 0, failed: 0, remaining: -1 };
  const claimed = (data ?? []) as { application_id: string; decision: Decision; email: string; first_name: string | null }[];

  let sent = 0;
  let failed = 0;
  const reasons = new Set<string>();
  let lastStart = 0;
  const record = (applicationId: string, fields: Record<string, string | null>) =>
    supabase.from("wave_emails").update(fields).eq("wave_id", waveId).eq("application_id", applicationId).select("application_id");
  for (const row of claimed) {
    if (Date.now() - started > DEADLINE_MS) {
      // Out of time: hand the rest back for the next batch.
      await record(row.application_id, { claimed_at: null });
      continue;
    }
    await sleep(Math.max(0, lastStart + SPACING_MS - Date.now()));
    lastStart = Date.now();
    // Same key for every try at this wave's email to this applicant, so if the
    // send went through but recording it didn't, a retry is dropped by Resend
    // (keys last 24 hours) instead of emailing them twice.
    const result = await sendDecisionEmail({
      to: row.email,
      firstName: row.first_name,
      decision: row.decision,
      idempotencyKey: `wave-${waveId}-${row.application_id}`,
    });
    if (result.sent) sent++;
    else {
      failed++;
      reasons.add(result.error ?? "Send failed");
    }
    const { data: saved, error: saveError } = await record(
      row.application_id,
      result.sent ? { sent_at: new Date().toISOString(), error: null, claimed_at: null } : { error: result.error ?? "Send failed", claimed_at: null },
    );
    if (saveError) reasons.add(`Couldn't record a result (${saveError.message}).`);
    else if (!saved?.length) reasons.add(`The email to ${row.email} was no longer due when its result was saved.`);
  }

  const { count, error: countError } = await supabase
    .from("wave_emails")
    .select("application_id", { count: "exact", head: true })
    .eq("wave_id", waveId)
    .is("sent_at", null);
  const remaining = countError ? -1 : (count ?? 0);
  const why = reasons.size ? ` ${[...reasons].join(" ")}` : "";
  return { ok: failed === 0 && !countError, message: `Sent ${sent}${failed ? `, ${failed} failed` : ""}.${why}`, sent, failed, remaining };
}

type WaitlistRow = { id: string; submitted_at: string | null; hackathons_count: number | null };
const PAGE_SIZE = 1000;

/**
 * Stages accepts for the top `count` waitlisted applicants (anyone already
 * staged is skipped): blind review's waitlist first, in its order, then
 * everyone else by Hive rank.
 */
export async function promoteFromWaitlist(count: number): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!Number.isInteger(count) || count < 1 || count > 500) return { ok: false, message: "Pick a number from 1 to 500." };

  const [waitlisted, staged, scores, outcomes] = await Promise.all([
    loadAllByKeyset<WaitlistRow>((after) => {
      const query = supabase
        .from("applications")
        .select("id, submitted_at, hackathons_count")
        .eq("status", "submitted")
        .eq("decision", "waitlisted")
        .order("id")
        .limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    loadStagedDecisions(supabase),
    loadAllByKeyset<HiveScore>(
      (after) => {
        const query = supabase.from("hive_scores").select("*").order("application_id").limit(PAGE_SIZE);
        return after ? query.gt("application_id", after) : query;
      },
      { key: "application_id" },
    ),
    loadOutcomes(supabase),
  ]);
  if (!waitlisted.data || !staged.data || !scores.data || !outcomes.data) return { ok: false, message: "Couldn't load the waitlist. Refresh and try again." };

  const stagedIds = new Set(staged.data.map((row) => row.application_id));
  const scoreById = new Map(scores.data.map((score) => [score.application_id, score]));
  const reviewSpot = new Map(
    outcomes.data.filter((row) => row.outcome === "waitlisted" && row.waitlist_position !== null).map((row) => [row.application_id, row.waitlist_position!]),
  );
  const next = waitlisted.data
    .filter((row) => !stagedIds.has(row.id))
    .map((row) => {
      const score = scoreById.get(row.id);
      return { ...row, score, tier: displayTier(score), spot: reviewSpot.get(row.id) ?? null };
    })
    .sort((a, b) => {
      if (a.spot !== null || b.spot !== null) return a.spot === null ? 1 : b.spot === null ? -1 : a.spot - b.spot;
      return compareForReview(a, b);
    })
    .slice(0, count);
  if (!next.length) return { ok: false, message: "Nobody on the waitlist is left to promote." };

  // The database stamps staged_at row by row in this order, so the pool trackers count them in it.
  // ignoreDuplicates: anyone another admin staged in the meantime keeps what was staged for them.
  const rows = next.map((row) => ({ application_id: row.id, decision: "accepted", staged_by: user.id }));
  const { data, error } = await supabase
    .from("staged_decisions")
    .upsert(rows, { onConflict: "application_id", ignoreDuplicates: true })
    .select("application_id");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin", "layout");
  const added = data?.length ?? rows.length;
  const short = next.length < count ? ` (only ${next.length} left on the waitlist)` : "";
  const skipped = added < next.length ? ` ${plural(next.length - added, "person")} had just been staged by someone else, so they were left alone.` : "";
  return { ok: true, message: `Staged ${plural(added, "accept")} from the waitlist${short}. They go out with the next wave.${skipped}` };
}

const OUTCOME_ORDER: Record<Decision, number> = { accepted: 0, waitlisted: 1, rejected: 2 };
const NOUNS: Record<Decision, string> = { accepted: "accept", waitlisted: "waitlist", rejected: "rejection" };
const plural = (n: number, word: string) => `${n} ${word === "person" && n !== 1 ? "people" : `${word}${n === 1 ? "" : "s"}`}`;

/**
 * Stages blind review's outcomes (accepted, waitlisted, not accepted) for
 * everyone with no decision and nothing staged. Never overwrites a decision
 * someone staged by hand. Emails nobody: they go out with the next wave.
 */
export async function stageReviewOutcomes(): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  const [outcomes, apps, staged] = await Promise.all([
    loadOutcomes(supabase),
    loadAllByKeyset<{ id: string; decision: Decision | null }>((after) => {
      const query = supabase.from("applications").select("id, decision").eq("status", "submitted").order("id").limit(PAGE_SIZE);
      return after ? query.gt("id", after) : query;
    }),
    loadStagedDecisions(supabase),
  ]);
  if (!outcomes.data || !apps.data || !staged.data) return { ok: false, message: "Couldn't load the review results. Refresh and try again." };

  const undecided = new Set(apps.data.filter((app) => !app.decision).map((app) => app.id));
  const stagedIds = new Set(staged.data.map((row) => row.application_id));
  const ready = outcomes.data
    .filter((row) => undecided.has(row.application_id) && !stagedIds.has(row.application_id))
    // Accepts in the order review placed them (so the seat trackers agree), then the waitlist in order, then the rest.
    .toSorted(
      (a, b) =>
        OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome] ||
        (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0) ||
        a.decided_at.localeCompare(b.decided_at),
    );
  if (!ready.length) return { ok: false, message: "Every review outcome already has a decision or is staged." };

  // The database stamps staged_at row by row in this order. ignoreDuplicates: anyone
  // staged by hand in the meantime keeps what was staged for them.
  const rows = ready.map((row) => ({ application_id: row.application_id, decision: row.outcome, staged_by: user.id }));
  const { data, error } = await supabase
    .from("staged_decisions")
    .upsert(rows, { onConflict: "application_id", ignoreDuplicates: true })
    .select("application_id, decision");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin", "layout");
  const added = (data as { decision: Decision }[] | null) ?? rows;
  const counts = (["accepted", "waitlisted", "rejected"] as const)
    .map((decision) => plural(added.filter((row) => row.decision === decision).length, NOUNS[decision]))
    .filter((text) => !text.startsWith("0 "));
  if (!counts.length) return { ok: false, message: "Someone else just staged all of them. Nothing changed." };
  return { ok: true, message: `Staged ${counts.join(", ")} from blind review. They go out with the next wave (rejections only on the final one).` };
}
