export type TeamProfileRow = {
  id: string; full_name: string | null; school: string | null; avatar_url: string | null;
  email: string | null; github_url: string | null; linkedin_url: string | null; instagram_url: string | null;
  looking_for_team?: boolean;
  slack_url?: string | null;
};

export type TeamProfile = {
  id: string; name: string; school: string; avatarUrl: string | null; email: string | null;
  githubUrl: string | null; linkedinUrl: string | null; instagramUrl: string | null;
  slackUrl: string | null;
};

export function safeWebUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function teamProfile(row: TeamProfileRow): TeamProfile {
  const email = row.email?.trim() ?? "";
  return {
    id: row.id, name: row.full_name?.trim() || "Hacker", school: row.school?.trim() || "",
    avatarUrl: safeWebUrl(row.avatar_url), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    githubUrl: safeWebUrl(row.github_url), linkedinUrl: safeWebUrl(row.linkedin_url), instagramUrl: safeWebUrl(row.instagram_url),
    slackUrl: safeSlackProfileUrl(row.slack_url ?? null),
  };
}

// Slack's documented workspace and Enterprise member-profile URL formats.
export function safeSlackProfileUrl(value: string | null): string | null {
  const web = safeWebUrl(value);
  if (!web || web.length > 500) return null;
  const url = new URL(web);
  if (url.protocol !== "https:" || url.port || !/^([a-z0-9-]+\.)+slack\.com$/i.test(url.hostname)
    || !/^\/(team\/[uw][a-z0-9]+|user\/@[uw][a-z0-9]+)\/?$/i.test(url.pathname)) return null;
  url.search = "";
  url.hash = "";
  return url.href;
}

export function parseSlackProfileUrl(value: string): string | null {
  if (!value.trim()) return null;
  const url = safeSlackProfileUrl(value);
  if (!url) throw new Error("Use an HTTPS Slack member-profile link, such as https://your-workspace.slack.com/team/U123ABC.");
  return url;
}

const normalized = (value: string) => value.trim().toLocaleLowerCase("en-US");

export function teamSchools(profiles: TeamProfile[]) {
  const schools = new Map<string, string>();
  for (const { school } of profiles) if (school && !schools.has(normalized(school))) schools.set(normalized(school), school);
  return [...schools].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "en"));
}

export function filterTeammates(profiles: TeamProfile[], search: string, school: string, githubOnly: boolean) {
  const words = normalized(search).split(/\s+/).filter(Boolean);
  return profiles.filter(profile => {
    const text = normalized(`${profile.name} ${profile.school}`);
    return words.every(word => text.includes(word))
      && (!school || normalized(profile.school) === school)
      && (!githubOnly || !!profile.githubUrl);
  }).sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
}

export function contactHref(profile: TeamProfile) {
  return profile.email ? `mailto:${encodeURIComponent(profile.email)}?subject=${encodeURIComponent("HackHive 2027: team up?")}` : null;
}
