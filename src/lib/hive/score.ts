import type { SupabaseClient } from "@supabase/supabase-js";
import { HiveQuotaError } from "./errors";
import { codeFlags, normalizePhone } from "./flags";
import { buildHiveInput } from "./input";
import { HiveGradeSchema, PROMPT_VERSION, type HiveInput } from "./prompt";
import { experienceScore, suggestTier, type Tier } from "./tier";

// Grading writes ONLY to hive_scores. It reads applications but never changes
// them, so it can never accept, waitlist or reject anyone; humans do that.

/** Sends the answers to the model and returns its raw JSON text. */
export type Grader = (input: HiveInput) => Promise<string>;

export type HiveDeps = {
  db: SupabaseClient; // service role: the submitter isn't an admin
  grade: Grader;
  model: string;
  now?: () => Date;
};

export type ScoreResult =
  | { ok: true; tier: Tier }
  // keptScore: a re-score failed, so the earlier score is still shown.
  // quota: OpenAI is out of credits, so retrying now won't help.
  | { ok: false; error: string; keptScore?: boolean; quota?: boolean };

/** After this many failures in a row, the backlog stops retrying (Re-score still works). */
export const MAX_ATTEMPTS = 5;
/** Applicants per "Score now" request, all graded at once: one round fits the 60s limit. */
export const BATCH_SIZE = 5;

const APP_COLUMNS = "id, status, age, phone, hackathons_count, q_proud, q_hack, q_anything_else";

type Claim = { claim_token: string; attempts: number; status: "pending" | "scored" | "failed"; flags: string[] };

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

/** Other submitted applications with the same phone (one indexed lookup on phone_digits). */
async function findDuplicates(db: SupabaseClient, app: { id: string; phone: string | null }): Promise<string[]> {
  const phone = normalizePhone(app.phone);
  if (!phone) return [];
  const { data, error } = await db
    .from("applications")
    .select("id")
    .eq("phone_digits", phone)
    .eq("status", "submitted")
    .neq("id", app.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function scoreApplication(id: string, deps: HiveDeps): Promise<ScoreResult> {
  const { db, grade, model } = deps;
  const now = () => (deps.now ?? (() => new Date()))().toISOString();

  const { data: app, error: appError } = await db.from("applications").select(APP_COLUMNS).eq("id", id).maybeSingle();
  if (appError) return { ok: false, error: appError.message };
  if (!app || app.status !== "submitted") return { ok: false, error: "Only submitted applications are scored." };

  // Locks the row, so a second scoring of the same applicant can't start (or bill OpenAI).
  const { data: claims, error: claimError } = await db.rpc("claim_hive_score", { p_application_id: id });
  if (claimError) return { ok: false, error: claimError.message };
  const claim = (claims as Claim[] | null)?.[0];
  if (!claim) return { ok: false, error: "Already being scored. Try again in a minute." };

  // Only writes while this run still holds the lock, so a late run can't overwrite a newer result.
  const finish = (values: Record<string, unknown>) =>
    db
      .from("hive_scores")
      .update({ ...values, claim_token: null, claimed_at: null, updated_at: now() })
      .eq("application_id", id)
      .eq("claim_token", claim.claim_token)
      .select("application_id");

  // Code flags first, so a minor is noted even if the AI call fails.
  let duplicates: string[] = [];
  try {
    duplicates = await findDuplicates(db, app);
  } catch {
    // Leaves the duplicate flag off; nothing else depends on it.
  }
  const flags = codeFlags(app, duplicates.length > 0);

  let result: ScoreResult;
  try {
    const raw = await grade(buildHiveInput(app));
    const graded = HiveGradeSchema.parse(JSON.parse(raw));
    const experience = experienceScore({
      builtIt: graded.built_it,
      shipped: graded.shipped,
      impact: graded.impact,
      beyondTutorial: graded.beyond_tutorial,
    });
    const tier = suggestTier({ experience, creativity: graded.creativity, quality: graded.quality });
    const { data, error } = await finish({
      status: "scored",
      built_it: graded.built_it,
      shipped: graded.shipped,
      impact: graded.impact,
      beyond_tutorial: graded.beyond_tutorial,
      experience,
      creativity: graded.creativity,
      quality: graded.quality,
      rationale: graded.rationale,
      flags: [...new Set([...flags, ...graded.flags])],
      suggested_tier: tier,
      model,
      prompt_version: PROMPT_VERSION,
      attempts: 0,
      error: null,
      scored_at: now(),
    });
    if (error) throw new Error(error.message);
    result = data?.length ? { ok: true, tier } : { ok: false, error: "Another scoring took over; refresh to see its result." };
  } catch (error) {
    const message = errorText(error);
    const keptScore = claim.status === "scored";
    // A failed re-score keeps the earlier score, tier and AI flags; only the error is noted.
    await finish(keptScore ? { error: message, flags: [...new Set([...claim.flags, ...flags])] } : { status: "failed", error: message, flags, model });
    result = { ok: false, error: message, keptScore, quota: error instanceof HiveQuotaError };
  }

  // Flags the earlier half of a duplicate pair too. Rows not scored yet get it when they are.
  if (duplicates.length) await db.rpc("add_hive_flag", { p_application_ids: duplicates, p_flag: "possible_duplicate" });
  return result;
}

/** The next `limit` submitted applicants to grade (fewest failed tries first, then oldest), and how many are waiting. */
export async function findBacklog(db: SupabaseClient, limit: number): Promise<{ ids: string[]; total: number }> {
  const { data, error } = await db.rpc("hive_backlog", {
    p_prompt_version: PROMPT_VERSION,
    p_limit: limit,
    p_max_attempts: MAX_ATTEMPTS,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { application_id: string; total: number | string }[];
  return { ids: rows.map((row) => row.application_id), total: rows.length ? Number(rows[0].total) : 0 };
}

/** Scores up to `limit` of the backlog, `concurrency` at a time. Stops early if OpenAI is out of credits. Safe to call repeatedly. */
export async function scoreUnscored(deps: HiveDeps, { limit = BATCH_SIZE, concurrency = BATCH_SIZE } = {}) {
  const { ids, total } = await findBacklog(deps.db, limit);
  let scored = 0;
  let failed = 0;
  let quota = false;
  let next = 0;
  const worker = async () => {
    while (!quota && next < ids.length) {
      const result = await scoreApplication(ids[next++], deps);
      if (result.ok) scored++;
      else {
        failed++;
        if (result.quota) quota = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return { scored, failed, remaining: total - scored, quota };
}
