"use server";

import { revalidatePath } from 'next/cache';
import { requireTeamAccess } from '@/lib/team/access';
import { profileInput, teammateProfileSchema, recruitingInput, recruitingTeamSchema, uuid } from '@/lib/team/schema';
import { safeSlackProfileUrl, safeWebUrl } from '@/lib/team/profiles';

export type TeamActionResult = { ok: boolean; message: string };
function done(message: string): TeamActionResult {
  revalidatePath('/dashboard/team'); revalidatePath('/dashboard/team/profile'); revalidatePath('/dashboard');
  return { ok: true, message };
}
function failure(error: { code?: string; message?: string } | null): TeamActionResult {
  if (error?.code === '23505') return { ok: false, message: 'You already have a team post. Refresh to edit your existing post.' };
  if (error?.code === '23514') return { ok: false, message: 'Check your profile fields and team size, then try again.' };
  if (['42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')) return { ok: false, message: 'These teammate tools are temporarily unavailable. Try again later.' };
  return { ok: false, message: error?.code === 'P0001' ? error.message ?? 'This change could not be saved.' : 'This change could not be saved. Refresh and try again.' };
}

export async function setTeamListing(listed: boolean, found = false): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || typeof listed !== 'boolean' || typeof found !== 'boolean') return failure(null);
  if (listed) {
    const { data: profile, error: profileError } = await access.session.from('profiles').select('slack_url').eq('id', access.user.id).maybeSingle();
    if (profileError) return failure(profileError);
    if (!safeSlackProfileUrl(profile?.slack_url ?? null)) return { ok: false, message: 'Add your Slack member-profile link in Edit profile before making your listing available.' };
  }
  const { error } = await access.session.rpc('confirm_teammate_availability', { p_listed: listed, p_found: found });
  if (error?.code === 'PGRST202') {
    // Keep the pre-migration visibility control functional.
    const legacy = await access.session.from('profiles').update({ looking_for_team: listed }).eq('id', access.user.id).select('id').maybeSingle();
    if (legacy.error || !legacy.data) return failure(legacy.error);
  } else if (error) return failure(error);
  return done(found ? 'Congrats on finding your team! Your listing is hidden.' : listed ? 'Your availability is confirmed. You are discoverable.' : 'Your profile is hidden from the directory.');
}

export async function saveTeammateProfile(form: FormData): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok) return failure(null);
  const parsed = teammateProfileSchema.safeParse(profileInput(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const profile = parsed.data;
  if (profile.looking_for_team && !profile.slack_url) {
    return { ok: false, message: 'Add your Slack member-profile link so teammates can contact you.' };
  }
  const { error, data } = await access.session.from('profiles').update({ ...profile,
    slack_url: safeSlackProfileUrl(profile.slack_url), github_url: safeWebUrl(profile.github_url),
    linkedin_url: safeWebUrl(profile.linkedin_url), instagram_url: safeWebUrl(profile.instagram_url),
  }).eq('id', access.user.id).select('id').maybeSingle();
  return error || !data ? failure(error) : done('Your teammate profile is saved.');
}

export async function updateBookmark(targetId: string, enabled: boolean): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || !uuid.safeParse(targetId).success || typeof enabled !== 'boolean') return failure(null);
  const { error } = await access.session.rpc('set_teammate_bookmark', {
    p_target: targetId, p_saved: enabled,
  });
  return error ? failure(error) : done(enabled ? 'Profile saved privately.' : 'Profile removed from saved.');
}

export async function saveRecruitingTeam(form: FormData): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok) return failure(null);
  const parsed = recruitingTeamSchema.safeParse(recruitingInput(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const id = String(form.get('id') ?? '');
  if (id && !uuid.safeParse(id).success) return failure(null);
  const query = id ? access.session.from('recruiting_teams').update(parsed.data).eq('id', id).eq('owner_id', access.user.id)
    : access.session.from('recruiting_teams').insert({ ...parsed.data, owner_id: access.user.id });
  const { data, error } = await query.select('id').maybeSingle();
  return error || !data ? failure(error) : done(id ? 'Team post updated.' : 'Your team post is published. Hackers can contact you on Slack.');
}

export async function leaveTeam(teamId: string, disband = false): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || !uuid.safeParse(teamId).success || typeof disband !== 'boolean') return failure(null);
  const query = disband ? access.session.from('recruiting_teams').delete().eq('id', teamId).eq('owner_id', access.user.id)
    : access.session.from('team_memberships').delete().eq('team_id', teamId).eq('user_id', access.user.id);
  const { error, data } = await query.select('id').maybeSingle();
  return error || !data ? failure(error) : done(disband ? 'Team post removed. You can make your hacker profile visible again.' : 'You left the existing roster. Reconfirm your availability to appear in the directory again.');
}
