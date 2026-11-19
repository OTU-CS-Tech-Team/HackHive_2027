import { loadAllByKeyset } from "@/lib/admin/applicants";
import type { Decision } from "@/lib/application/decision-email";
import type { createClient } from "@/lib/supabase/server";

type Session = Awaited<ReturnType<typeof createClient>>;

export type StagedDecision = { application_id: string; decision: Decision; staged_by: string | null; staged_at: string };

const PAGE_SIZE = 1000;

/** Every staged (not yet released) decision, in pages. Admins only (RLS). */
export function loadStagedDecisions(session: Session) {
  return loadAllByKeyset<StagedDecision>(
    (after) => {
      const query = session.from("staged_decisions").select("application_id, decision, staged_by, staged_at").order("application_id").limit(PAGE_SIZE);
      return after ? query.gt("application_id", after) : query;
    },
    { key: "application_id" },
  );
}

/**
 * application_id -> staged decision. A failure (e.g. the release_waves migration
 * isn't applied yet) shows nobody as staged rather than just some of them.
 */
export async function loadStagedMap(session: Session): Promise<Map<string, Decision>> {
  const { data } = await loadStagedDecisions(session);
  return new Map((data ?? []).map((row) => [row.application_id, row.decision]));
}
