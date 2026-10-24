export type TeamProfileRow = {
  id: string; full_name: string | null; school: string | null; avatar_url: string | null;
  github_url: string | null; linkedin_url: string | null; instagram_url: string | null;
  looking_for_team?: boolean;
  slack_url?: string | null;
  team_bio?: string; team_skills?: string[]; team_roles?: string[]; team_seeking?: string[];
  team_interests?: string[]; team_goal?: TeamGoal | null; team_experience?: 'first' | 'returning' | null;
  team_found?: boolean; team_confirmed_at?: string | null;
};

export type TeamProfile = {
  id: string; name: string; school: string; avatarUrl: string | null;
  githubUrl: string | null; linkedinUrl: string | null; instagramUrl: string | null;
  slackUrl: string | null;
  bio: string; skills: string[]; roles: string[]; seeking: string[]; interests: string[];
  goal: TeamGoal | null; experience: 'first' | 'returning' | null; confirmedAt: string | null;
};

export const TEAM_ROLES = ['Frontend', 'Backend', 'Design', 'AI / ML', 'Hardware', 'Mobile', 'Product', 'Pitching'] as const;
export const TEAM_GOALS = { learn: 'Learn & ship', compete: 'Aim for a prize', both: 'Learn & compete' } as const;
export type TeamGoal = keyof typeof TEAM_GOALS;
export type Bookmark = { id: string; target_id: string; saved: boolean; reached_out: boolean };
export type RecruitingTeam = {
  id: string; owner_id: string; name: string; pitch: string; roles_needed: string[];
  interests: string[]; goal: TeamGoal; capacity: number; status: 'recruiting' | 'closed'; created_at: string;
};
export type TeamMember = { id: string; team_id: string; user_id: string; display_name: string };
export type JoinRequest = {
  id: string; team_id: string; applicant_id: string; applicant_name: string; message: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn'; created_at: string;
};
export type TeamDirectoryData = {
  own: TeamProfile; listed: boolean; found: boolean; upgraded: boolean; profiles: TeamProfile[];
  bookmarks: Bookmark[]; teams: RecruitingTeam[]; members: TeamMember[]; requests: JoinRequest[];
};

export function tags(value: string): string[] {
  return [...new Map(value.split(',').map(item => item.trim()).filter(Boolean).map(item => [item.toLowerCase(), item])).values()];
}

const shared = (a: string[], b: string[]) => a.filter(value => b.some(other => normalized(value) === normalized(other)));
export function matchReasons(own: TeamProfile, profile: TeamProfile): string[] {
  const reasons: string[] = [];
  const offers = shared(profile.roles, own.seeking);
  const needs = shared(profile.seeking, own.roles);
  const interests = shared(profile.interests, own.interests);
  if (offers.length) reasons.push(`Offers ${offers.slice(0, 2).join(' + ')} — roles you're looking for`);
  if (needs.length) reasons.push(`Looking for your ${needs.slice(0, 2).join(' + ')} skills`);
  if (interests.length) reasons.push(`Shared interest: ${interests.slice(0, 2).join(', ')}`);
  if (own.goal && own.goal === profile.goal) reasons.push(`Shared goal: ${TEAM_GOALS[own.goal]}`);
  return reasons;
}

export function introduction(own: TeamProfile, profile: TeamProfile): string {
  const contribution = own.roles.length ? ` I can help with ${own.roles.join(', ')}.` : '';
  const idea = own.bio ? ` ${own.bio}` : '';
  return `Hi ${profile.name.split(' ')[0]}! I'm ${own.name} from HackHive.${contribution}${idea} Are you still looking for teammates? I'd love to hear what you're thinking of building.`;
}

export function safeWebUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function teamProfile(row: TeamProfileRow): TeamProfile {
  return {
    id: row.id, name: row.full_name?.trim() || "Hacker", school: row.school?.trim() || "",
    avatarUrl: safeWebUrl(row.avatar_url),
    githubUrl: safeWebUrl(row.github_url), linkedinUrl: safeWebUrl(row.linkedin_url), instagramUrl: safeWebUrl(row.instagram_url),
    slackUrl: safeSlackProfileUrl(row.slack_url ?? null),
    bio: row.team_bio ?? '', skills: row.team_skills ?? [], roles: row.team_roles ?? [],
    seeking: row.team_seeking ?? [], interests: row.team_interests ?? [], goal: row.team_goal ?? null,
    experience: row.team_experience ?? null, confirmedAt: row.team_confirmed_at ?? null,
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
    const text = normalized(`${profile.name} ${profile.school} ${profile.bio} ${profile.skills.join(' ')} ${profile.roles.join(' ')} ${profile.interests.join(' ')}`);
    return words.every(word => text.includes(word))
      && (!school || normalized(profile.school) === school)
      && (!githubOnly || !!profile.githubUrl);
  }).sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
}
