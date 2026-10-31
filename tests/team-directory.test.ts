import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/team/access', () => ({ requireTeamAccess: vi.fn() }));
import { requireTeamAccess } from '@/lib/team/access';
import { loadTeamDirectory } from '@/lib/team/load-directory';

function row(index: number) {
  return { id: `person-${index}`, full_name: `Hacker ${index}`, school: 'Ontario Tech',
    avatar_url: null, github_url: null, linkedin_url: null, instagram_url: null, slack_url: 'https://demo.slack.com/team/U123ABC',
    team_bio: 'Building an accessible campus map', team_skills: ['Figma'], team_roles: [], team_goal: 'learn' as const,
    email: `private-${index}@example.test`, looking_for_team: true };
}
function setup(legacy: boolean, missingContact = false, incomplete = false) {
  const selections: string[] = [], ranges: number[][] = [], tables: string[] = [];
  const profiles = Array.from({ length: 1013 }, (_, index) => row(index));
  if (incomplete) {
    profiles[0].team_bio = '   ';
    profiles[500].team_skills = [];
    profiles[1012].slack_url = 'https://example.test/not-slack';
  }
  const legacyRow = (index: number) => ({ ...row(index), team_bio: undefined, team_skills: undefined, team_roles: undefined, team_goal: undefined });
  const session = { from: vi.fn((table: string) => {
    tables.push(table); let columns = '';
    const query = {
      select: vi.fn((value: string) => { selections.push(value); columns = value; return query; }),
      eq: vi.fn(() => query), neq: vi.fn(() => query), order: vi.fn(() => query),
      maybeSingle: vi.fn(async () => legacy && columns.includes('team_bio') ? { data: null, error: { code: '42703' } } : { data: legacy ? legacyRow(-1) : row(-1), error: null }),
      range: vi.fn(async (start: number, end: number) => {
        if (table === 'recruiting_teams' && missingContact && columns.includes('slack_url')) return { data:null,count:null,error:{code:'42703'} };
        if (table === 'profiles') { ranges.push([start, end]); return { data: legacy ? profiles.slice(start, end + 1).map((_, index) => legacyRow(start + index)) : profiles.slice(start, end + 1), count: profiles.length, error: null }; }
        return { data: [], count: 0, error: null };
      }),
    };
    return query;
  }) };
  vi.mocked(requireTeamAccess).mockResolvedValue({ ok: true, session, user: { id: 'self' } } as unknown as Awaited<ReturnType<typeof requireTeamAccess>>);
  return { selections, ranges, tables };
}
describe('teammate data loading', () => {
  it('loads all 1,013 authorized profiles without selecting or serializing emails', async () => {
    const { selections, ranges, tables } = setup(false);
    const result = await loadTeamDirectory();
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Unexpected failure');
    expect(result.profiles).toHaveLength(1013);
    expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(selections.every(columns => !columns.split(',').includes('email'))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('@example.test');
    expect(result.upgraded).toBe(true);
    expect(tables).not.toContain('team_join_requests');
    expect(result).not.toHaveProperty('requests');
  });
  it('keeps the existing directory functional before the new migration is applied', async () => {
    const { tables } = setup(true);
    const result = await loadTeamDirectory();
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Unexpected failure');
    expect(result.upgraded).toBe(false); expect(result.profiles).toHaveLength(0);
    expect(result.listed).toBe(false);
    expect(tables.every(table => table === 'profiles')).toBe(true);
  });
  it('keeps posts readable before the separate team-contact migration is applied', async () => {
    const { tables } = setup(false, true);
    const result = await loadTeamDirectory();
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Unexpected failure');
    expect(result.upgraded).toBe(true); expect(result.recruitingReady).toBe(false);
    expect(tables).not.toContain('team_join_requests');
  });
  it('omits incomplete and uncontactable listings before sending any directory pages to the client', async () => {
    const { ranges } = setup(false, false, true);
    const result = await loadTeamDirectory();
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Unexpected failure');
    expect(result.profiles).toHaveLength(1010);
    expect(result.profiles.some(profile => ['person-0', 'person-500', 'person-1012'].includes(profile.id))).toBe(false);
    expect(ranges).toHaveLength(3);
  });
});
