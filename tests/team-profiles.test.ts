import { describe, expect, it } from 'vitest';
import { filterTeammates, matchReasons, tags, teamProfile } from '@/lib/team/profiles';
import { teammateProfileSchema, recruitingTeamSchema, profileInput } from '@/lib/team/schema';

const row = {
  id: '00000000-0000-4000-8000-000000000001', full_name: 'Alex Builder', school: 'Ontario Tech',
  avatar_url: null, github_url: 'https://github.com/example', linkedin_url: null, instagram_url: null,
  slack_url: 'https://workspace.slack.com/team/U123ABC', email: 'must-not-leak@example.test',
};

describe('richer teammate profiles', () => {
  it('keeps emails out of client data, including legacy profiles', () => {
    const profile = teamProfile(row);
    expect(profile).not.toHaveProperty('email');
    expect(JSON.stringify(profile)).not.toContain('must-not-leak');
    expect(profile.roles).toEqual([]);
    expect(profile.goal).toBeNull();
    expect(profile.confirmedAt).toBeNull();
  });
  it('removes unsafe profile and Slack URLs at the server/client boundary', () => {
    const profile = teamProfile({ ...row, github_url: 'javascript:alert(1)', linkedin_url: 'https://name:password@example.com', slack_url: 'https://slack.com.evil.test/team/U123ABC' });
    expect(profile.githubUrl).toBeNull(); expect(profile.linkedinUrl).toBeNull(); expect(profile.slackUrl).toBeNull();
  });
  it('explains genuine role, interest, and goal overlap without invented percentages', () => {
    const own = { ...teamProfile(row), roles: ['Frontend'], seeking: ['Backend'], interests: ['Accessibility'], goal: 'learn' as const };
    const other = { ...teamProfile(row), roles: ['Backend'], seeking: ['Frontend'], interests: ['accessibility'], goal: 'learn' as const };
    expect(matchReasons(own, other)).toEqual([
      "Offers Backend — roles you're looking for", 'Looking for your Frontend skills', 'Shared interest: accessibility', 'Shared goal: Learn & ship',
    ]);
    expect(matchReasons(teamProfile(row), teamProfile(row))).toEqual([]);
  });
  it('searches roles, skills, ideas and interests as well as names and schools', () => {
    const profile = { ...teamProfile(row), bio: 'A better campus map', roles: ['Frontend'], skills: ['React'], interests: ['Accessibility'] };
    expect(filterTeammates([profile], 'react accessibility', '', false)).toHaveLength(1);
    expect(filterTeammates([profile], 'campus frontend', '', false)).toHaveLength(1);
    expect(filterTeammates([profile], 'React Toronto', '', false)).toHaveLength(0);
  });
  it('normalizes freeform tags without duplicates', () => {
    expect(tags(' React, Python, react , , Figma ')).toEqual(['react', 'Python', 'Figma']);
  });
  it('validates profile fields, Slack formats, tags and roles on the server', () => {
    const form = new FormData();
    form.set('full_name', 'Alex'); form.set('team_roles', 'Frontend'); form.set('team_skills', 'React, react');
    form.set('slack_url', 'https://workspace.slack.com/team/U123ABC');
    const valid = teammateProfileSchema.parse(profileInput(form));
    expect(valid.team_skills).toEqual(['react']); expect(valid.team_goal).toBeNull();
    expect(teammateProfileSchema.safeParse({ ...valid, team_roles: ['Unexpected role'] }).success).toBe(false);
    expect(teammateProfileSchema.safeParse({ ...valid, github_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(teammateProfileSchema.safeParse({ ...valid, team_bio: 'x'.repeat(281) }).success).toBe(false);
    expect(teammateProfileSchema.safeParse({ ...valid, team_skills: Array.from({ length: 11 }, (_, index) => String(index)) }).success).toBe(false);
  });
  it('limits team size to the registration limit of four', () => {
    const input = { name: 'A real idea', pitch: 'An accessible campus guide', roles_needed: ['Backend'], interests: ['Accessibility'], goal: 'learn', capacity: 4, status: 'recruiting', slack_url:'https://demo.slack.com/team/U123ABC' };
    expect(recruitingTeamSchema.safeParse(input).success).toBe(true);
    expect(recruitingTeamSchema.safeParse({ ...input, capacity: 5 }).success).toBe(false);
    expect(recruitingTeamSchema.safeParse({ ...input, pitch: '' }).success).toBe(false);
    expect(recruitingTeamSchema.safeParse({ ...input, slack_url: '' }).success).toBe(false);
    expect(recruitingTeamSchema.safeParse({ ...input, slack_url: 'https://slack.com.evil.test/team/U123ABC' }).success).toBe(false);
    expect(recruitingTeamSchema.parse({ ...input, slack_url:'https://demo.slack.com/team/U123ABC?source=profile#details' }).slack_url).toBe('https://demo.slack.com/team/U123ABC');
  });
  it('allows incomplete drafts but requires useful, contactable published profiles', () => {
    const draft = profileInput(new FormData());
    draft.full_name = 'Alex';
    expect(teammateProfileSchema.safeParse(draft).success).toBe(true);
    const published = { ...draft, looking_for_team: true, team_bio: 'A campus accessibility guide',
      team_skills: ['Figma'], team_goal: 'learn', slack_url: row.slack_url };
    expect(teammateProfileSchema.safeParse(published).success).toBe(true);
    expect(teammateProfileSchema.safeParse({ ...published, team_skills: [], team_roles: ['Design'] }).success).toBe(true);
    for (const incomplete of [
      { full_name: '  ' }, { team_bio: '' }, { team_bio: '   short   ' },
      { team_skills: [], team_roles: [] }, { team_skills: ['  '], team_roles: [] },
      { team_goal: null }, { slack_url: '' },
    ]) expect(teammateProfileSchema.safeParse({ ...published, ...incomplete }).success).toBe(false);
    expect(teammateProfileSchema.safeParse({ ...published, team_interests: [], team_seeking: [], team_experience: null }).success).toBe(true);
  });
});
