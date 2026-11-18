import type { SupabaseClient } from "@supabase/supabase-js";
import { codeFlags } from "./flags";
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

export type ScoreResult = { ok: true; tier: Tier } | { ok: false; error: string };

type PhoneRow = { id: string; phone: string | null };

const APP_COLUMNS = "id, status, age, phone, hackathons_count, q_proud, q_hack, q_anything_else";
const PAGE = 1000;

/** Every submitted application's phone, for the duplicate flag. */
export async function loadSubmittedPhones(db: SupabaseClient): Promise<PhoneRow[]> {
  const rows: PhoneRow[] = [];
  for (let after: string | null = null; ;) {
    let query = db.from("applications").select("id, phone").eq("status", "submitted").order("id").limit(PAGE);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...(data as PhoneRow[]));
    after = data[data.length - 1].id;
  }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

export async function scoreApplication(
  id: string,
  deps: HiveDeps,
  options: { phones?: PhoneRow[] } = {},
): Promise<ScoreResult> {
  const { db, grade, model } = deps;
  const now = () => (deps.now ?? (() => new Date()))().toISOString();

  const { data: app, error: appError } = await db.from("applications").select(APP_COLUMNS).eq("id", id).maybeSingle();
  if (appError) return { ok: false, error: appError.message };
  if (!app || app.status !== "submitted") return { ok: false, error: "Only submitted applications are scored." };

  const { data: existing } = await db.from("hive_scores").select("attempts").eq("application_id", id).maybeSingle();
  const { error: queueError } = await db
    .from("hive_scores")
    .upsert(
      { application_id: id, status: "pending", attempts: (existing?.attempts ?? 0) + 1, updated_at: now() },
      { onConflict: "application_id" },
    );
  if (queueError) return { ok: false, error: queueError.message };

  // Code flags first, so a minor is noted even if the AI call fails.
  let flags: string[] = [];
  try {
    flags = codeFlags(app, options.phones ?? (await loadSubmittedPhones(db)));
  } catch {
    flags = codeFlags(app, []);
  }

  try {
    const raw = await grade(buildHiveInput(app));
    const graded = HiveGradeSchema.parse(JSON.parse(raw));
    const experience = experienceScore({
      builtIt: graded.built_it,
      shipped: graded.shipped,
      impact: graded.impact,
      beyondTutorial: graded.beyond_tutorial,
    });
    const tier = suggestTier(experience, app.hackathons_count);
    const { error } = await db
      .from("hive_scores")
      .update({
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
        error: null,
        scored_at: now(),
        updated_at: now(),
      })
      .eq("application_id", id);
    if (error) throw new Error(error.message);
    return { ok: true, tier };
  } catch (error) {
    const message = errorText(error);
    await db
      .from("hive_scores")
      .update({ status: "failed", error: message, flags, model, updated_at: now() })
      .eq("application_id", id);
    return { ok: false, error: message };
  }
}

type Backlog = { id: string; submitted_at: string | null };

/** Submitted applications not yet scored with the current prompt (unscored, failed, stuck or outdated), oldest first. */
export async function findUnscored(db: SupabaseClient): Promise<string[]> {
  const apps: Backlog[] = [];
  for (let after: string | null = null; ;) {
    let query = db.from("applications").select("id, submitted_at").eq("status", "submitted").order("id").limit(PAGE);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    apps.push(...(data as Backlog[]));
    after = data[data.length - 1].id;
  }

  const done = new Set<string>();
  for (let after: string | null = null; ;) {
    let query = db.from("hive_scores").select("application_id, status, prompt_version").order("application_id").limit(PAGE);
    if (after) query = query.gt("application_id", after);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) if (row.status === "scored" && row.prompt_version === PROMPT_VERSION) done.add(row.application_id);
    after = data[data.length - 1].application_id;
  }

  return apps
    .filter((app) => !done.has(app.id))
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") || a.id.localeCompare(b.id))
    .map((app) => app.id);
}

/** Scores up to `limit` of the backlog, `concurrency` at a time. Safe to call repeatedly. */
export async function scoreUnscored(deps: HiveDeps, { limit = 10, concurrency = 5 } = {}) {
  const backlog = await findUnscored(deps.db);
  const batch = backlog.slice(0, limit);
  const phones = batch.length ? await loadSubmittedPhones(deps.db) : [];
  let scored = 0;
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < batch.length) {
      const result = await scoreApplication(batch[next++], deps, { phones });
      if (result.ok) scored++;
      else failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
  return { scored, failed, remaining: backlog.length - scored };
}
