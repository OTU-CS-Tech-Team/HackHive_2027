import "server-only";
import { requireTeamAccess } from './access';
import { teamProfile, safeSlackProfileUrl, type TeamProfileRow, type TeamDirectoryData, type Bookmark, type RecruitingTeam, type TeamMember } from './profiles';

const LEGACY_COLUMNS = 'id,full_name,school,avatar_url,github_url,linkedin_url,instagram_url,slack_url';
export const PROFILE_COLUMNS = `${LEGACY_COLUMNS},team_bio,team_skills,team_roles,team_seeking,team_interests,team_goal,team_experience,team_found,team_confirmed_at`;
const PAGE_SIZE = 500;
type PageResult = { data: unknown[] | null; count: number | null; error: unknown };
async function allPages<T>(query: (offset: number) => PromiseLike<PageResult>): Promise<T[] | null> {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    const { data, count, error } = await query(offset);
    if (error || !data || count === null) return null;
    rows.push(...data as T[]);
    offset += data.length;
    if (offset >= count) return rows;
    if (!data.length) return null;
  }
}
export async function loadTeamDirectory(): Promise<({ ok: true } & TeamDirectoryData) | { ok: false }> {
  const access = await requireTeamAccess();
  if (!access.ok) return { ok: false };
  const { session, user } = access;
  let columns = PROFILE_COLUMNS;
  let ownResult = await session.from('profiles').select(`${columns},looking_for_team`).eq('id', user.id).maybeSingle();
  let upgraded = true;
  if (ownResult.error?.code === '42703' || ownResult.error?.code === 'PGRST204') {
    // The existing directory remains usable until the additive migration is applied.
    columns = LEGACY_COLUMNS; upgraded = false;
    ownResult = await session.from('profiles').select(`${columns},looking_for_team`).eq('id', user.id).maybeSingle();
  }
  if (ownResult.error || !ownResult.data) return { ok: false };
  const own = ownResult.data as unknown as TeamProfileRow;
  const profiles = await allPages<TeamProfileRow>(offset => session.from('profiles').select(columns, { count: 'exact' })
    .eq('looking_for_team', true).neq('id', user.id).order('id').range(offset, offset + PAGE_SIZE - 1));
  if (!profiles) return { ok: false };
  let bookmarks: Bookmark[] = [], teams: RecruitingTeam[] = [], members: TeamMember[] = [];
  let recruitingReady = upgraded;
  if (upgraded) {
    const results = await Promise.all([
      allPages<Bookmark>(offset => session.from('teammate_bookmarks').select('id,target_id,saved', { count: 'exact' }).eq('owner_id', user.id).order('id').range(offset, offset + PAGE_SIZE - 1)),
      allPages<RecruitingTeam>(async offset => {
        const columns = 'id,owner_id,name,pitch,roles_needed,interests,goal,capacity,status,created_at';
        const query = (includeContact: boolean) => session.from('recruiting_teams').select(columns + (includeContact ? ',slack_url' : ''), { count: 'exact' }).order('id').range(offset, offset + PAGE_SIZE - 1);
        const result = await query(recruitingReady);
        if (['42703', 'PGRST204'].includes(result.error?.code ?? '')) { recruitingReady = false; return query(false); }
        return result;
      }),
      allPages<TeamMember>(offset => session.from('team_memberships').select('id,team_id,user_id,display_name', { count: 'exact' }).eq('user_id', user.id).order('id').range(offset, offset + PAGE_SIZE - 1)),
    ]);
    if (results.some(result => result === null)) return { ok: false };
    bookmarks = results[0]!; teams = results[1]!.map(team => ({ ...team, slack_url: safeSlackProfileUrl(team.slack_url ?? null) })); members = results[2]!;
  }
  return { ok: true, own: teamProfile(own), listed: own.looking_for_team === true, found: own.team_found === true,
    upgraded, profiles: profiles.map(teamProfile), bookmarks, teams, members, recruitingReady };
}
