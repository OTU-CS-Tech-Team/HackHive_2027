// Server only: decision-email imports "server-only".
import { sendDecisionEmail, type Decision } from "@/lib/application/decision-email";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** `saved`: the decision is on the application now (whether or not this call changed it or the email went out). */
export type DecisionResult = { ok: boolean; message: string; saved: boolean };

export const DECISIONS: readonly string[] = ["accepted", "waitlisted", "rejected"];

/**
 * Sets an application's decision and emails the applicant. Shared by a single
 * decision on the Applicants page and a release wave from blind review.
 * null = back to "applied", which emails nobody. The caller checks the admin
 * and revalidates.
 */
export async function applyDecision(supabase: Supabase, id: string, decision: Decision | null): Promise<DecisionResult> {
  // Only a real change matches a row, so a double click can't send two emails.
  const change = supabase.from("applications").update({ decision }).eq("id", id).eq("status", "submitted");
  const { data, error } = await (decision ? change.or(`decision.is.null,decision.neq.${decision}`) : change.not("decision", "is", null))
    .select("email, first_name");
  if (error) return { ok: false, message: error.message, saved: false };

  const applicant = data[0];
  if (!applicant) {
    // Either it already had this decision, or the application isn't submitted any more.
    const { data: current } = await supabase.from("applications").select("decision").eq("id", id).eq("status", "submitted").maybeSingle();
    const saved = !!current && current.decision === decision;
    return saved ? { ok: true, message: "Already saved. No email sent.", saved } : { ok: false, message: "Applicant not found.", saved };
  }
  if (!decision) return { ok: true, message: "Moved back to pending. No email sent.", saved: true };
  const { sent, error: emailError } = await sendDecisionEmail({ to: applicant.email, firstName: applicant.first_name, decision });
  return sent
    ? { ok: true, message: `Saved as ${decision} and emailed ${applicant.email}.`, saved: true }
    : {
        ok: false,
        message: `Saved as ${decision}, but the email to ${applicant.email} failed (${emailError}). Use Resend email to try again.`,
        saved: true,
      };
}
