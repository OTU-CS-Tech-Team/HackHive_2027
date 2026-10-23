import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { loadAdminStats } from "../src/lib/admin/load-stats";

function session(user: { id: string } | null, admin: object | null, error: object | null = null, applications: object = {}) {
  const builder = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: admin, error }) };
  const from = vi.fn((table: string) => table === "admin_users" ? builder : applications);
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, from });
  return from;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
});

describe("stats authorization and loading", () => {
  it("redirects signed-out visitors before querying applications", async () => {
    const from = session(null, null);
    await expect(loadAdminStats()).rejects.toThrow("redirect:/auth/login?next=/admin/stats");
    expect(from).not.toHaveBeenCalled();
  });

  it.each([null, { message: "permission error" }])("fails closed for missing or failed admin membership (%s)", async error => {
    const from = session({ id: "ordinary-user" }, null, error);
    await expect(loadAdminStats()).rejects.toThrow("redirect:/");
    expect(from.mock.calls.map(([table]) => table)).toEqual(["admin_users"]);
  });

  it("loads beyond the API row cap and returns aggregates without personal records", async () => {
    const row = { status: "submitted", submitted_at: null, university: null, hackathons_count: null, team_status: null, tshirt_size: null, needs_travel_help: null, dietary: null, accessibility: null };
    const range = vi.fn()
      .mockResolvedValueOnce({ data: Array(500).fill(row), count: 1001, error: null })
      .mockResolvedValueOnce({ data: Array(500).fill(row), count: 1001, error: null })
      .mockResolvedValueOnce({ data: [row], count: 1001, error: null });
    const select = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ range }) });
    session({ id: "admin" }, { user_id: "admin" }, null, { select });
    const result = await loadAdminStats();
    expect(result.ok && result.stats.submitted).toBe(1001);
    expect(range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(select.mock.calls[0][0]).not.toMatch(/email|first_name|phone|resume/);
    expect(result).not.toHaveProperty("applications");
  });

  it("keeps paging if the database config caps responses below the requested page size", async () => {
    const row = { status: "draft" };
    const range = vi.fn()
      .mockResolvedValueOnce({ data: [row, row], count: 3, error: null })
      .mockResolvedValueOnce({ data: [row], count: 3, error: null });
    session({ id: "admin" }, { user_id: "admin" }, null, { select: () => ({ order: () => ({ range }) }) });
    const result = await loadAdminStats();
    expect(result.ok && result.stats.total).toBe(3);
    expect(range.mock.calls).toEqual([[0, 499], [2, 501]]);
  });

  it("shows an unavailable state on a failed page instead of a partial count", async () => {
    session({ id: "admin" }, { user_id: "admin" }, null, { select: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: "offline" } }) }) }) });
    expect(await loadAdminStats()).toEqual({ ok: false });
  });
});
