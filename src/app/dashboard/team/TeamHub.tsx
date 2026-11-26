'use client';
import { useSearchParams } from 'next/navigation';
import { type TeamDirectoryData } from '@/lib/team/profiles';
import { TeamDirectory } from './TeamDirectory';
import { ListingControl } from './ListingControl';
import { RecruitingBoard } from './RecruitingBoard';
import { updateTeamQuery } from './team-query';
import styles from './team.module.css';

export function TeamHub({ data }: { data: TeamDirectoryData }) {
  const params = useSearchParams();
  const selected = params.get('view') ?? 'people';
  const view = data.upgraded && ['teams', 'saved', 'mine'].includes(selected) ? selected : 'people';
  const hasTeam = data.members.some(member => member.user_id === data.own.id);
  const openTeams = data.teams.filter(team => team.status === 'recruiting').length;
  const visibleProfiles = new Set(data.profiles.map(profile => profile.id));
  const tabs = [{ id: 'people', label: 'Hackers', count: data.profiles.length }, ...(data.upgraded ? [
    { id: 'teams', label: 'Teams', count: openTeams },
    { id: 'saved', label: 'Saved', count: data.bookmarks.filter(mark => mark.saved && visibleProfiles.has(mark.target_id)).length },
    { id: 'mine', label: 'Your team', count: 0 },
  ] : [])];
  const returnTo = '/dashboard/team' + (params.toString() ? `?${params.toString()}` : '');
  return <>
    <ListingControl profile={data.own} listed={data.listed} found={data.found} upgraded={data.upgraded} hasTeam={hasTeam}
      editorHref={`/dashboard/team/profile?returnTo=${encodeURIComponent(returnTo)}`} />
    {!data.upgraded && <p className={styles.notice}>Richer profiles and team recruitment are coming soon. You can still browse hackers and manage your listing.</p>}
    <nav className={styles.tabs} aria-label="Teammate finder views">{tabs.map(tab => {
      const query = new URLSearchParams(params.toString()); query.set('view', tab.id); query.delete('shown');
      return <a key={tab.id} href={`?${query}`} className={styles.tab} aria-current={view === tab.id ? 'page' : undefined}
        onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); updateTeamQuery({ view: tab.id === 'people' ? null : tab.id }); }}>{tab.label}{tab.count > 0 && <span className={styles.count}>{tab.count.toLocaleString('en-US')}</span>}</a>;
    })}</nav>
    {view === 'people' || view === 'saved' ? <TeamDirectory profiles={data.profiles} own={data.own} bookmarks={data.bookmarks} upgraded={data.upgraded} savedOnly={view === 'saved'} /> : <RecruitingBoard data={data} mine={view === 'mine'} />}
  </>;
}
