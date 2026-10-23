import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { requireTeamAccess } from "../src/lib/team/access";
import { loadTeamDirectory } from "../src/lib/team/load-directory";
import { setTeamListing } from "../src/app/dashboard/team/actions";
import { saveProfile } from "../src/app/dashboard/actions";

const profile = { id: "self", full_name: "Self", school: "Ontario Tech", email: "self@example.com", avatar_url: null, github_url: null, linkedin_url: null, instagram_url: null, looking_for_team: false };
function session(allowed: boolean | null = true, accessError: object | null = null, signedIn = true) {
  const builder = {
    select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }), range: vi.fn(),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: signedIn ? { id: "self" } : null }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: allowed, error: accessError }), from: vi.fn().mockReturnValue(builder),
  };
  mocks.createClient.mockResolvedValue(client);
  return { client, builder };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
});

describe("team discovery access", () => {
  it("redirects signed-out visitors before reading any profiles", async () => {
    const { client } = session(true, null, false);
    await expect(loadTeamDirectory()).rejects.toThrow("redirect:/auth/login?next=/dashboard/team");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reuses hub access and redirects unaccepted applicants without loading contacts", async () => {
    const { client } = session(false);
    await expect(loadTeamDirectory()).rejects.toThrow("redirect:/dashboard?tab=application");
    expect(client.rpc).toHaveBeenCalledWith("has_hub_access");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("fails closed when eligibility cannot be verified", async () => {
    const { client } = session(null, { message: "offline" });
    expect(await requireTeamAccess()).toEqual({ ok: false });
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("team directory reads", () => {
  it("loads only opted-in profiles, excludes self, and respects a lowered API row cap", async () => {
    const { builder } = session();
    builder.range
      .mockResolvedValueOnce({ data: [{ ...profile, id: "a" }, { ...profile, id: "b" }], count: 3, error: null })
      .mockResolvedValueOnce({ data: [{ ...profile, id: "c" }], count: 3, error: null });
    const result = await loadTeamDirectory();
    expect(result.ok && result.profiles.map(row => row.id)).toEqual(["a", "b", "c"]);
    expect(builder.eq).toHaveBeenCalledWith("looking_for_team", true);
    expect(builder.neq).toHaveBeenCalledWith("id", "self");
    expect(builder.range.mock.calls).toEqual([[0, 499], [2, 501]]);
  });

  it("returns a real empty state after a successful query", async () => {
    const { builder } = session();
    builder.range.mockResolvedValue({ data: [], count: 0, error: null });
    expect(await loadTeamDirectory()).toMatchObject({ ok: true, listed: false, profiles: [] });
  });

  it("returns an error rather than a misleading empty or partial directory", async () => {
    const { builder } = session();
    builder.range.mockResolvedValue({ data: null, count: null, error: { message: "offline" } });
    expect(await loadTeamDirectory()).toEqual({ ok: false });
  });
});

describe("listing controls", () => {
  it("updates only the current hacker's discoverability and refreshes both views", async () => {
    const { builder } = session();
    expect(await setTeamListing(true)).toMatchObject({ ok: true });
    expect(builder.update).toHaveBeenCalledWith({ looking_for_team: true });
    expect(builder.eq).toHaveBeenCalledWith("id", "self");
    expect(mocks.revalidatePath.mock.calls).toEqual([["/dashboard/team"], ["/dashboard"]]);
  });

  it("requires hub access for directly invoked listing mutations", async () => {
    const { builder } = session(false);
    await expect(setTeamListing(true)).rejects.toThrow("redirect:/dashboard?tab=application");
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("rejects nonboolean visibility values", async () => {
    const { builder } = session();
    expect(await setTeamListing("true" as unknown as boolean)).toMatchObject({ ok: false });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("does not report success when the current profile is missing", async () => {
    const { builder } = session();
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await setTeamListing(false)).toMatchObject({ ok: false });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("Slack profile editing", () => {
  it("saves a validated Slack member link alongside the existing profile fields", async () => {
    const { builder } = session();
    const form = new FormData();
    form.set("slack_url", "https://hackhive.slack.com/team/U123ABC?tracking=1");
    expect(await saveProfile(form)).toBe("Saved.");
    expect(builder.update.mock.calls[0][0]).toHaveProperty("slack_url", "https://hackhive.slack.com/team/U123ABC");
    expect(builder.eq).toHaveBeenCalledWith("id", "self");
  });

  it("rejects an invalid Slack link before writing any profile changes", async () => {
    const { builder } = session();
    const form = new FormData(); form.set("slack_url", "https://evil.test");
    expect(await saveProfile(form)).toMatch(/Slack member-profile/);
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("preserves Slack links for older forms that do not submit the new field", async () => {
    const { builder } = session();
    await saveProfile(new FormData());
    expect(builder.update.mock.calls[0][0]).not.toHaveProperty("slack_url");
  });

  it("lets hackers clear their optional Slack link", async () => {
    const { builder } = session();
    const form = new FormData(); form.set("slack_url", "");
    await saveProfile(form);
    expect(builder.update.mock.calls[0][0]).toHaveProperty("slack_url", null);
  });
});
