import { describe, expect, it } from "vitest";
import { summarizeApplications, type StatsApplication } from "../src/lib/admin/stats";

const now = new Date("2026-10-22T16:00:00Z");
const applicant = (overrides: Partial<StatsApplication> = {}): StatsApplication => ({
  status: "submitted", submitted_at: now.toISOString(), university: "Ontario Tech",
  hackathons_count: 1, team_status: "looking", tshirt_size: "M",
  needs_travel_help: false, dietary: null, accessibility: null, ...overrides,
});

describe("admin application stats", () => {
  it("handles an empty hackathon without invalid totals", () => {
    expect(summarizeApplications([], now)).toMatchObject({
      total: 0, submitted: 0, drafts: 0, lastSevenDays: 0, firstTime: 0, schools: [], shirts: [],
    });
  });

  it("excludes draft responses from community and logistics counts", () => {
    const stats = summarizeApplications([
      applicant(), applicant({ status: "draft", university: "Draft school", needs_travel_help: true, dietary: "Vegetarian", accessibility: "Step-free access" }),
    ], now);
    expect(stats).toMatchObject({ total: 2, submitted: 1, drafts: 1, firstTime: 1, travelHelp: 0, dietaryRequests: 0, accessibilityRequests: 0 });
    expect(stats.schools).toEqual([{ label: "Ontario Tech", count: 1 }]);
  });

  it("counts decisions only for submitted applications and treats missing decisions as pending", () => {
    const stats = summarizeApplications([
      applicant({ decision: "accepted" }), applicant({ decision: "waitlisted" }),
      applicant({ decision: "rejected" }), applicant({ decision: null }), applicant(),
      applicant({ status: "draft", decision: "accepted" }),
    ], now);
    expect(stats).toMatchObject({ approved: 1, waitlisted: 1, rejected: 1, pending: 2, submitted: 5, drafts: 1 });
    expect(stats.approved + stats.pending + stats.waitlisted + stats.rejected).toBe(stats.submitted);
  });

  it("uses a rolling seven-day window and ignores missing, invalid, and future timestamps", () => {
    const dates = ["2026-10-15T16:00:00Z", "2026-10-15T15:59:59Z", now.toISOString(), "2026-10-23T00:00:00Z", null, "invalid"];
    expect(summarizeApplications(dates.map(submitted_at => applicant({ submitted_at })), now).lastSevenDays).toBe(2);
  });

  it("counts first-timers using the form's including-this-event definition", () => {
    const stats = summarizeApplications([1, 2, 0, null].map(hackathons_count => applicant({ hackathons_count })), now);
    expect(stats.firstTime).toBe(1);
    expect(stats.experienceUnknown).toBe(2);
  });

  it("normalizes school and shirt responses without losing missing answers", () => {
    const stats = summarizeApplications([
      applicant(), applicant({ university: " ontario TECH ", tshirt_size: " m " }),
      applicant({ university: " ", tshirt_size: null }), applicant({ university: null, tshirt_size: "L" }),
    ], now);
    expect(stats.schools).toEqual([{ label: "Not provided", count: 2 }, { label: "Ontario Tech", count: 2 }]);
    expect(stats.shirts).toContainEqual({ label: "M", count: 2 });
    expect(stats.shirts.reduce((sum, row) => sum + row.count, 0)).toBe(stats.submitted);
  });

  it("separates team preferences and counts only nonblank support responses", () => {
    const stats = summarizeApplications([
      applicant({ needs_travel_help: true, dietary: "Vegetarian", accessibility: "Step-free access" }),
      applicant({ team_status: "has_team", dietary: " ", accessibility: "" }),
      applicant({ team_status: "solo" }), applicant({ team_status: null }),
    ], now);
    expect(stats).toMatchObject({ lookingForTeam: 1, hasTeam: 1, solo: 1, travelHelp: 1, dietaryRequests: 1, accessibilityRequests: 1 });
  });
});
