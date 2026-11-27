import "server-only";

import { createServiceClient, type createClient } from "@/lib/supabase/server";
import { isTier, type Tier } from "@/lib/hive/tier";
import { scoreTotal, type HiveScore } from "@/lib/hive/view";
import { RESUME_CLEANER_VERSION, cleanResumeText, extractPdfPages, type ResumeIdentity, type ResumeSections } from "./resume-text";

// The blind review card: the short answers, Hive Mind scores and the resume's
// Experience and Projects sections. The name and email are read here only to
// drop resume lines that would identify the applicant; they never go into the
// card, and school, year and contact details aren't loaded at all. Pages
// must pass only a BlindCard (and the applicant number) to client components,
// never the application id, which would open the full application.

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Flags a reviewer may see. Not "minor" or "needs_visa_letter": they hint at age and where someone's from. */
export const SAFE_FLAGS = ["possible_duplicate", "off_topic", "nonsense", "prompt_injection"] as const;

export type BlindResume = ({ status: "ok" } & ResumeSections) | { status: "failed"; reason: string } | { status: "none" };

export type BlindCard = {
  applicantNo: number;
  tier: Tier;
  movedTier: boolean;
  answers: { question: string; text: string }[];
  hackathons: number | null;
  scores: { experience: number; creativity: number; quality: number; total: number } | null;
  rationale: string;
  flags: string[];
  resume: BlindResume;
};

const QUESTIONS = [
  ["q_proud", "The project or work they're most proud of"],
  ["q_hack", "A time they hacked something to their advantage"],
  ["q_anything_else", "Anything else"],
] as const;

const APP_COLUMNS = "id, applicant_no, first_name, last_name, preferred_name, email, resume_path, q_proud, q_hack, q_anything_else, hackathons_count";

type BlindSource = {
  id: string;
  applicant_no: number;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string;
  resume_path: string | null;
  q_proud: string | null;
  q_hack: string | null;
  q_anything_else: string | null;
  hackathons_count: number | null;
};

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

type Cached = { status: "ok" | "failed"; experience?: string[][]; projects?: string[][]; reason?: string };

/** pdfjs errors that mean the file itself can't be read, however often it's tried. */
const BROKEN_PDF = new Set(["InvalidPDFException", "PasswordException", "FormatError"]);

/**
 * Cleaned once per resume file and cached (review_resume_cache, service role
 * only), so re-renders of the queue don't download and parse the PDF again.
 */
async function readResume(path: string | null, identity: ResumeIdentity): Promise<BlindResume> {
  if (!path) return { status: "none" };
  // Admins can't read the bucket or the cache directly (see redirectToResume), hence the service role.
  const service = createServiceClient();
  const { data: hit } = await service
    .from("review_resume_cache")
    .select("result")
    .eq("resume_path", path)
    .eq("version", RESUME_CLEANER_VERSION)
    .maybeSingle<{ result: Cached }>();
  if (hit?.result.status === "ok") return { status: "ok", experience: hit.result.experience ?? [], projects: hit.result.projects ?? [] };
  if (hit?.result.status === "failed") return { status: "failed", reason: hit.result.reason ?? "The resume couldn't be read." };

  let result: BlindResume;
  try {
    const { data, error } = await service.storage.from("resumes").download(path);
    if (error || !data) return { status: "failed", reason: "The resume couldn't be downloaded." }; // not cached: may be temporary
    if (data.size > MAX_RESUME_BYTES) {
      result = { status: "failed", reason: "The resume file is too big to read." };
    } else {
      const cleaned = cleanResumeText(await extractPdfPages(new Uint8Array(await data.arrayBuffer())), identity);
      result = cleaned.ok
        ? { status: "ok", experience: cleaned.experience, projects: cleaned.projects }
        : { status: "failed", reason: cleaned.reason };
    }
  } catch (error) {
    const reason = "The resume couldn't be read (it may be locked or broken).";
    // Only a broken or locked PDF is cached. Anything else (a timeout, running
    // out of memory, a bad deploy) may be temporary, so it's tried again next time.
    if (!(error instanceof Error && BROKEN_PDF.has(error.name))) return { status: "failed", reason };
    result = { status: "failed", reason };
  }
  // Best effort: a failed write just means it's cleaned again next time.
  await service
    .from("review_resume_cache")
    .upsert({ resume_path: path, version: RESUME_CLEANER_VERSION, result, created_at: new Date().toISOString() });
  return result;
}

/** The card for one applicant, or null if they're gone or not scored. */
export async function loadBlindCard(session: Supabase, applicationId: string): Promise<BlindCard | null> {
  const [{ data: app }, { data: score }] = await Promise.all([
    session.from("applications").select(APP_COLUMNS).eq("id", applicationId).maybeSingle<BlindSource>(),
    session.from("hive_scores").select("*").eq("application_id", applicationId).maybeSingle<HiveScore>(),
  ]);
  if (!app || !score || !isTier(score.tier)) return null;

  const total = scoreTotal(score);
  return {
    applicantNo: app.applicant_no,
    tier: score.tier,
    movedTier: !!score.tier_override,
    answers: QUESTIONS.map(([key, question]) => ({ question, text: app[key]?.trim() ?? "" })),
    hackathons: app.hackathons_count,
    scores:
      total === null
        ? null
        : { experience: score.experience!, creativity: score.creativity!, quality: score.quality!, total },
    rationale: score.rationale ?? "",
    flags: score.flags.filter((flag) => (SAFE_FLAGS as readonly string[]).includes(flag)),
    resume: await readResume(app.resume_path, {
      firstNames: [app.first_name, app.preferred_name],
      lastName: app.last_name,
      email: app.email,
    }),
  };
}

/** Your next applicant in a tier (the same one again if you already have one open), or null when none are left. */
export async function claimNextReview(session: Supabase, tier: Tier) {
  const { data, error } = await session.rpc("claim_next_review", { p_tier: tier });
  if (error) throw new Error(error.message);
  const row = (data as { application_id: string; applicant_no: number }[] | null)?.[0];
  return row ? { applicationId: row.application_id, applicantNo: row.applicant_no } : null;
}

/** The application id behind an applicant number. Server side only. */
export async function applicationIdFor(session: Supabase, applicantNo: unknown): Promise<string | null> {
  if (typeof applicantNo !== "number" || !Number.isSafeInteger(applicantNo) || applicantNo <= 0) return null;
  const { data } = await session.from("applications").select("id").eq("applicant_no", applicantNo).maybeSingle();
  return data?.id ?? null;
}
