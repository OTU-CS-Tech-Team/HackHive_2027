import "server-only";

import { requireAdmin } from "./require-admin";
import { summarizeEvents, type Events } from "./events";

const PAGE_SIZE = 500;
const COLUMNS = "title, description, category, starts_at, ends_at, points";

export async function loadAdminStats() {
  const session = await requireAdmin("/admin/events");
  try {
    const events: Events[] = [];
    for (let offset = 0; ;) {
      const { data, count, error } = await session.from("events").select(COLUMNS, { count: "exact" })
        .order("id").range(offset, offset + PAGE_SIZE - 1);
      if (error || !data || count === null) throw new Error("Events query failed");
      events.push(...data as unknown as Events[]);
      offset += data.length;
      if (offset >= count) break;
      if (data.length === 0) throw new Error("Incomplete events response");
    }
    return { ok: true as const, stats: summarizeEvents(events), updatedAt: new Date().toISOString() };
  } catch {
    return { ok: false as const };
  }
}
