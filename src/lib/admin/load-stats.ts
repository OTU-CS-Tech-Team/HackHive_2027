import "server-only";

import { requireAdmin } from "./require-admin";
import { summarizeApplications, type StatsApplication } from "./stats";

const PAGE_SIZE = 500;
const STATS_COLUMNS = "status,decision,submitted_at,university,hackathons_count,team_status,tshirt_size,needs_travel_help,dietary,accessibility,country";

type Session = Awaited<ReturnType<typeof requireAdmin>>;

async function fetchRows(session: Session, columns: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ;) {
    const { data, count, error } = await session.from("applications").select(columns, { count: "exact" })
      .order("id").range(offset, offset + PAGE_SIZE - 1);
    if (error || !data || count === null) throw new Error("Applications query failed");
    rows.push(...(data as unknown as Record<string, unknown>[]));
    offset += data.length;
    if (offset >= count) break;
    if (data.length === 0) throw new Error("Incomplete applications response");
  }
  return rows;
}

export async function loadAdminStats() {
  const session = await requireAdmin("/admin/stats");
  try {
    const applications = (await fetchRows(session, STATS_COLUMNS)) as unknown as StatsApplication[];
    return { ok: true as const, stats: summarizeApplications(applications), updatedAt: new Date().toISOString() };
  } catch {
    return { ok: false as const };
  }
}

// Every column, submitted applications only. Returns null if the query fails.
export async function loadSubmittedApplications() {
  const session = await requireAdmin("/admin/stats");
  try {
    const rows = await fetchRows(session, "*");
    return rows.filter(row => row.status === "submitted");
  } catch {
    return null;
  }
}