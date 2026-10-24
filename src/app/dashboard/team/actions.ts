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
  if (error?.code === '23505') return { ok: false, message: 'That change conflicts with an existing team or request. Refresh to see the latest status.' };
  if (error?.code === '23514') return { ok: false, message: 'Check your profile fields and team size, then try again.' };
  if (['42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')) return { ok: false, message: 'These teammate tools are temporarily unavailable. Try again later.' };
  return { ok: false, message: error?.code === 'P0001' ? error.message ?? 'This change could not be saved.' : 'This change could not be saved. Refresh and try again.' };
}

export async function setTeamListing(listed: boolean, found = false): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || typeof listed !== 'boolean' || typeof found !== 'boolean') return failure(null);
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
  if (profile.looking_for_team && ![profile.slack_url, profile.github_url, profile.linkedin_url, profile.instagram_url].some(Boolean)) {
    return { ok: false, message: 'Add a Slack or social profile link so teammates can reach you.' };
  }
  const { error, data } = await access.session.from('profiles').update({ ...profile,
    slack_url: safeSlackProfileUrl(profile.slack_url), github_url: safeWebUrl(profile.github_url),
    linkedin_url: safeWebUrl(profile.linkedin_url), instagram_url: safeWebUrl(profile.instagram_url),
  }).eq('id', access.user.id).select('id').maybeSingle();
  return error || !data ? failure(error) : done('Your teammate profile is saved.');
}

export async function updateBookmark(targetId: string, kind: 'saved' | 'reached_out', enabled: boolean): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || !uuid.safeParse(targetId).success || !['saved', 'reached_out'].includes(kind) || typeof enabled !== 'boolean') return failure(null);
  const { error } = await access.session.rpc('set_teammate_bookmark', {
    p_target: targetId, ...(kind === 'saved' ? { p_saved: enabled } : { p_reached_out: enabled }),
  });
  return error ? failure(error) : done(kind === 'saved' ? enabled ? 'Profile saved privately.' : 'Profile removed from saved.' : enabled ? 'Marked as reached out. Only you can see this.' : 'Outreach mark removed.');
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
  return error || !data ? failure(error) : done(id ? 'Team updated.' : 'Your team is published. Your individual listing is now hidden.');
}

export async function requestToJoin(teamId: string, message: string): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || !uuid.safeParse(teamId).success || typeof message !== 'string' || message.trim().length < 10 || message.length > 500) {
    return { ok: false, message: 'Introduce yourself in 10–500 characters.' };
  }
  const { error } = await access.session.rpc('request_team_join', { p_team: teamId, p_message: message.trim() });
  return error ? failure(error) : done('Request sent. The team owner can review your introduction.');
}

export async function reviewJoinRequest(requestId: string, accept: boolean): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || !uuid.safeParse(requestId).success || typeof accept !== 'boolean') return failure(null);
  const { error } = await access.session.rpc('review_team_join', { p_request: requestId, p_accept: accept });
  return error ? failure(error) : done(accept ? 'Teammate added. Their other pending requests and individual listing are closed.' : 'Request declined.');
}

export async function withdrawJoinRequest(requestId: string): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || !uuid.safeParse(requestId).success) return failure(null);
  const { error, data } = await access.session.from('team_join_requests').update({ status: 'withdrawn' })
    .eq('id', requestId).eq('applicant_id', access.user.id).eq('status', 'pending').select('id').maybeSingle();
  return error || !data ? failure(error) : done('Request withdrawn.');
}

export async function leaveTeam(teamId: string, disband = false): Promise<TeamActionResult> {
  const access = await requireTeamAccess();
  if (!access.ok || !uuid.safeParse(teamId).success || typeof disband !== 'boolean') return failure(null);
  const query = disband ? access.session.from('recruiting_teams').delete().eq('id', teamId).eq('owner_id', access.user.id)
    : access.session.from('team_memberships').delete().eq('team_id', teamId).eq('user_id', access.user.id);
  const { error, data } = await query.select('id').maybeSingle();
  return error || !data ? failure(error) : done(disband ? 'Team disbanded. Members can choose whether to list themselves again.' : 'You left the team. Reconfirm your availability to appear in the directory again.');
}
