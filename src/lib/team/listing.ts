import { safeSlackProfileUrl, TEAM_GOALS, TEAM_ROLES, type TeamProfileRow } from './profiles';

export const LISTING_COLUMNS = 'full_name,team_bio,team_skills,team_roles,team_goal,slack_url';
type ListingProfile = Pick<TeamProfileRow, 'full_name' | 'team_bio' | 'team_skills' | 'team_roles' | 'team_goal' | 'slack_url'>;

// Only publishing needs a complete card. Hidden drafts can be saved at any stage.
export function teammateListingIssue(profile: ListingProfile): string | null {
  if (!profile.full_name?.trim()) return 'Add your name before making your profile discoverable.';
  if ((profile.team_bio?.trim().length ?? 0) < 10) return 'Describe what you would like to build in at least 10 characters before making your profile discoverable.';
  const hasSkill = profile.team_skills?.some(skill => skill.trim().length > 0);
  const hasRole = profile.team_roles?.some(role => TEAM_ROLES.some(option => option === role));
  if (!hasSkill && !hasRole) return 'Add at least one skill or choose a role you can help with before making your profile discoverable.';
  if (!profile.team_goal || !Object.hasOwn(TEAM_GOALS, profile.team_goal)) return 'Choose your hackathon goal before making your profile discoverable.';
  if (!safeSlackProfileUrl(profile.slack_url ?? null)) return 'Add your Slack member-profile link so teammates can contact you.';
  return null;
}
