import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/team/access', () => ({ requireTeamAccess: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
import { requireTeamAccess } from '@/lib/team/access';
import { createClient } from '@/lib/supabase/server';
import { saveTeammateProfile, setTeamListing } from '@/app/dashboard/team/actions';
import { saveProfile } from '@/app/dashboard/actions';

const complete = { full_name: 'Alex Builder', team_bio: 'An accessible campus guide', team_skills: ['Figma'],
  team_roles: [], team_goal: 'learn', slack_url: 'https://demo.slack.com/team/U123ABC' };

function setup(profile: object | null = complete) {
  let updating = false;
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query),
    update: vi.fn(() => { updating = true; return query; }),
    maybeSingle: vi.fn(async () => ({ data: updating ? { id: 'self' } : profile, error: null })),
    then: (resolve: (result: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  const session = { from: vi.fn(() => query), rpc: vi.fn(async () => ({ error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'self' } } })) } };
  vi.mocked(requireTeamAccess).mockResolvedValue({ ok: true, session, user: { id: 'self' } } as unknown as Awaited<ReturnType<typeof requireTeamAccess>>);
  vi.mocked(createClient).mockResolvedValue(session as unknown as Awaited<ReturnType<typeof createClient>>);
  return { session, query };
}

function form(listed = true) {
  const data = new FormData();
  for (const [key, value] of Object.entries(complete)) {
    if (Array.isArray(value)) value.forEach(item => data.append(key, item));
    else data.set(key, value);
  }
  if (listed) data.set('looking_for_team', 'on');
  return data;
}

beforeEach(() => vi.clearAllMocks());

describe('teammate publishing entry points', () => {
  it('rejects a sparse editor submission on the server without writing it', async () => {
    const { query } = setup();
    const data = form(); data.set('team_bio', '   ');
    expect(await saveTeammateProfile(data)).toMatchObject({ ok: false, message: expect.stringContaining('10 characters') });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('saves unfinished hidden drafts and complete discoverable profiles', async () => {
    const { query } = setup();
    const draft = form(false); draft.delete('team_bio'); draft.delete('team_skills'); draft.delete('team_goal'); draft.delete('slack_url');
    expect(await saveTeammateProfile(draft)).toMatchObject({ ok: true });
    expect(query.update).toHaveBeenLastCalledWith(expect.objectContaining({ looking_for_team: false, team_bio: '' }));
    expect(await saveTeammateProfile(form())).toMatchObject({ ok: true });
    expect(query.update).toHaveBeenLastCalledWith(expect.objectContaining({ looking_for_team: true }));
  });

  it.each([
    { full_name: '   ' }, { team_bio: '  ' }, { team_skills: ['  '], team_roles: [] },
    { team_goal: null }, { slack_url: null },
  ])('prevents availability controls bypassing completion: %j', async missing => {
    const { session } = setup({ ...complete, ...missing });
    expect(await setTeamListing(true)).toMatchObject({ ok: false });
    expect(session.rpc).not.toHaveBeenCalled();
  });

  it('allows reconfirming complete cards and hiding incomplete cards', async () => {
    const { session } = setup();
    expect(await setTeamListing(true)).toMatchObject({ ok: true });
    expect(session.rpc).toHaveBeenCalledWith('confirm_teammate_availability', { p_listed: true, p_found: false });
    const hidden = setup(null);
    expect(await setTeamListing(false)).toMatchObject({ ok: true });
    expect(hidden.session.from).not.toHaveBeenCalled();
  });

  it('blocks the dashboard checkbox from publishing an incomplete stored card', async () => {
    const { query } = setup({ ...complete, team_bio: '' });
    expect(await saveProfile(form())).toContain('10 characters');
    expect(query.update).not.toHaveBeenCalled();
  });

  it('checks effective dashboard edits instead of only the stored name and Slack link', async () => {
    const { query } = setup();
    const data = form(); data.set('slack_url', '');
    expect(await saveProfile(data)).toContain('Slack');
    data.set('slack_url', complete.slack_url); data.set('full_name', ' ');
    expect(await saveProfile(data)).toContain('name');
    expect(query.update).not.toHaveBeenCalled();
  });

  it('still allows ordinary dashboard edits while a profile is hidden', async () => {
    const { query } = setup(null);
    expect(await saveProfile(form(false))).toBe('Saved.');
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ looking_for_team: false }));
  });
});
