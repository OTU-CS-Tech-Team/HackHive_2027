import { z } from 'zod';
import { safeWebUrl, safeSlackProfileUrl, tags, TEAM_ROLES } from './profiles';

const tagArray = z.array(z.string().trim().min(1).max(32)).max(10, 'Use at most 10 tags.');
const roleArray = z.array(z.enum(TEAM_ROLES)).max(8);
const goal = z.enum(['learn', 'compete', 'both']);
const link = z.string().max(500).refine(value => !value || !!safeWebUrl(value), 'Use a valid HTTP or HTTPS profile URL without a username or password.');
const slack = z.string().max(500).refine(value => !value || !!safeSlackProfileUrl(value), 'Use an HTTPS Slack member-profile link, such as https://workspace.slack.com/team/U123ABC.').transform(value => safeSlackProfileUrl(value) ?? '');
export const uuid = z.uuid();
export const teammateProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'Add your name.').max(100), school: z.string().trim().max(100),
  team_bio: z.string().trim().max(280), team_skills: tagArray, team_roles: roleArray,
  team_seeking: roleArray, team_interests: tagArray, team_goal: goal.nullable(),
  team_experience: z.enum(['first', 'returning']).nullable(),
  github_url: link, linkedin_url: link, instagram_url: link, slack_url: slack, looking_for_team: z.boolean(),
});
export const recruitingTeamSchema = z.object({
  name: z.string().trim().min(2, 'Give your team a name.').max(60),
  pitch: z.string().trim().min(10, 'Describe your idea in at least 10 characters.').max(500),
  roles_needed: roleArray, interests: tagArray, goal, capacity: z.coerce.number().int().min(2).max(4),
  status: z.enum(['recruiting', 'closed']),
  slack_url: slack.refine(value => !!value, 'Add a Slack member-profile link so hackers can contact you.'),
});

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export function profileInput(form: FormData) {
  return {
    full_name: value(form, 'full_name'), school: value(form, 'school'), team_bio: value(form, 'team_bio'),
    team_skills: tags(value(form, 'team_skills')), team_roles: form.getAll('team_roles'),
    team_seeking: form.getAll('team_seeking'), team_interests: tags(value(form, 'team_interests')),
    team_goal: value(form, 'team_goal') || null, team_experience: value(form, 'team_experience') || null,
    github_url: value(form, 'github_url'), linkedin_url: value(form, 'linkedin_url'),
    instagram_url: value(form, 'instagram_url'), slack_url: value(form, 'slack_url'),
    looking_for_team: form.get('looking_for_team') === 'on',
  };
}
export function recruitingInput(form: FormData) {
  return {
    name: value(form, 'name'), pitch: value(form, 'pitch'), roles_needed: form.getAll('roles_needed'),
    interests: tags(value(form, 'interests')), goal: value(form, 'goal'),
    capacity: value(form, 'capacity'), status: value(form, 'status'), slack_url: value(form, 'slack_url'),
  };
}
