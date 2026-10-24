import "server-only";

import { requireTeamAccess } from "./access";
import { teamProfile, type TeamProfileRow } from "./profiles";

const COLUMNS = "id,full_name,school,avatar_url,github_url,linkedin_url,instagram_url,slack_url";
const PAGE_SIZE = 500;

export async function loadTeamDirectory() {
  const access = await requireTeamAccess();
  if (!access.ok) return { ok: false as const };
  const { session, user } = access;
  const { data: own, error: ownError } = await session.from("profiles")
    .select(`${COLUMNS},looking_for_team`).eq("id", user.id).maybeSingle();
  if (ownError || !own) return { ok: false as const };

  const profiles: TeamProfileRow[] = [];
  for (let offset = 0; ;) {
    // RLS controls which opted-in profiles this hacker is allowed to see.
    const { data, count, error } = await session.from("profiles").select(COLUMNS, { count: "exact" })
      .eq("looking_for_team", true).neq("id", user.id).order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data || count === null) return { ok: false as const };
    profiles.push(...data as TeamProfileRow[]);
    offset += data.length;
    if (offset >= count) break;
    if (!data.length) return { ok: false as const };
  }
  return {
    ok: true as const, own: teamProfile(own as TeamProfileRow),
    listed: own.looking_for_team === true, profiles: profiles.map(teamProfile),
  };
}
