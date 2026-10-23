import "server-only";

import { requireAdmin } from "./require-admin";
import { summarizeApplications, type StatsApplication } from "./stats";

const PAGE_SIZE = 500;
const COLUMNS = "status,decision,submitted_at,university,hackathons_count,team_status,tshirt_size,needs_travel_help,dietary,accessibility";

export async function loadAdminStats() {
  const session = await requireAdmin("/admin/stats");
  try {
    const applications: StatsApplication[] = [];
    for (let offset = 0; ;) {
      const { data, count, error } = await session.from("applications").select(COLUMNS, { count: "exact" })
        .order("id").range(offset, offset + PAGE_SIZE - 1);
      if (error || !data || count === null) throw new Error("Applications query failed");
      applications.push(...data as unknown as StatsApplication[]);
      offset += data.length;
      if (offset >= count) break;
      if (data.length === 0) throw new Error("Incomplete applications response");
    }
    return { ok: true as const, stats: summarizeApplications(applications), updatedAt: new Date().toISOString() };
  } catch {
    return { ok: false as const };
  }
}
