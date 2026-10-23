import { describe, expect, it } from "vitest";
import { contactHref, filterTeammates, parseSlackProfileUrl, safeSlackProfileUrl, safeWebUrl, teamProfile, teamSchools, type TeamProfileRow } from "../src/lib/team/profiles";

const row = (overrides: Partial<TeamProfileRow> = {}): TeamProfileRow => ({
  id: "hacker-1", full_name: "Alex Chen", school: "Ontario Tech", email: "alex@example.com",
  avatar_url: null, github_url: "https://github.com/alex", linkedin_url: null, instagram_url: null, ...overrides,
});

describe("teammate profile links and search", () => {
  it("accepts workspace and Enterprise Slack member profiles, with optional blank values", () => {
    expect(parseSlackProfileUrl(" ")).toBeNull();
    expect(safeSlackProfileUrl("https://hackhive.slack.com/team/U123ABC?tracking=1#profile")).toBe("https://hackhive.slack.com/team/U123ABC");
    expect(safeSlackProfileUrl("https://hackhive.enterprise.slack.com/user/@W123ABC")).toBe("https://hackhive.enterprise.slack.com/user/@W123ABC");
    expect(teamProfile(row({ slack_url: "https://hackhive.slack.com/team/U123ABC" })).slackUrl).toBe("https://hackhive.slack.com/team/U123ABC");
  });

  it.each(["https://hackhive.slack.com.evil.test/team/U123ABC", "https://evil.test/team/U123ABC", "http://hackhive.slack.com/team/U123ABC", "https://hackhive.slack.com/archives/C123ABC", "https://hackhive.slack.com", "javascript:alert(1)"])("rejects a non-profile Slack destination: %s", value => {
    expect(safeSlackProfileUrl(value)).toBeNull();
    expect(() => parseSlackProfileUrl(value)).toThrow(/Slack member-profile/);
  });

  it.each(["javascript:alert(1)", "data:text/html,hello", "file:///private/file", "not a url", "https://user:pass@example.com"])("suppresses unsafe or invalid web links: %s", value => {
    expect(safeWebUrl(value)).toBeNull();
  });

  it("preserves valid web links and handles missing profile fields", () => {
    expect(safeWebUrl(" https://github.com/alex ")).toBe("https://github.com/alex");
    expect(teamProfile(row({ full_name: " ", school: null, email: "bad\r\nemail", github_url: "javascript:alert(1)" }))).toMatchObject({ name: "Hacker", school: "", email: null, githubUrl: null });
  });

  it("creates an email contact link without placing untrusted text into headers", () => {
    const href = contactHref(teamProfile(row()));
    expect(href).toBe("mailto:alex%40example.com?subject=HackHive%202027%3A%20team%20up%3F");
    expect(contactHref(teamProfile(row({ email: null })))).toBeNull();
  });

  it("combines name/school words with school and project-link filters", () => {
    const profiles = [teamProfile(row()), teamProfile(row({ id: "hacker-2", full_name: "Sam", school: "Waterloo", github_url: null }))];
    expect(filterTeammates(profiles, " ALEX tech ", "ontario tech", true).map(profile => profile.id)).toEqual(["hacker-1"]);
    expect(filterTeammates(profiles, "Sam", "", true)).toEqual([]);
    expect(filterTeammates(profiles, "", "waterloo", false).map(profile => profile.name)).toEqual(["Sam"]);
  });

  it("deduplicates schools across casing and surrounding spaces", () => {
    const profiles = [teamProfile(row()), teamProfile(row({ school: " ontario TECH " })), teamProfile(row({ school: null }))];
    expect(teamSchools(profiles)).toEqual([{ value: "ontario tech", label: "Ontario Tech" }]);
  });

  it("sorts results deterministically and returns no matches for unrelated terms", () => {
    const profiles = [teamProfile(row({ id: "b", full_name: "Sam" })), teamProfile(row({ id: "a", full_name: "Alex" }))];
    expect(filterTeammates(profiles, "", "", false).map(profile => profile.id)).toEqual(["a", "b"]);
    expect(filterTeammates(profiles, "no such hacker", "", false)).toEqual([]);
  });
});
