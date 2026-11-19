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
 * application_id -> staged decision. On a failure (e.g. the release_waves
 * migration isn't applied yet) the map is empty and `failed` is set, so pages
 * can say staged decisions aren't showing instead of showing nobody as staged.
 */
export async function loadStagedMap(session: Session): Promise<{ map: Map<string, Decision>; failed: boolean }> {
  const { data } = await loadStagedDecisions(session);
  return { map: new Map((data ?? []).map((row) => [row.application_id, row.decision])), failed: !data };
}

export const STAGED_LOAD_FAILED = "Staged decisions couldn't be loaded, so nobody shows as staged. Refresh before deciding on anyone.";
