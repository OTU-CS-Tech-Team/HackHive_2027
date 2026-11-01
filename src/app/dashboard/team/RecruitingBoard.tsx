'use client';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TEAM_GOALS, TEAM_ROLES, safeSlackProfileUrl, type TeamDirectoryData, type RecruitingTeam } from '@/lib/team/profiles';
import { saveRecruitingTeam, leaveTeam, type TeamActionResult } from './actions';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { SelectControl } from './SelectControl';
import { updateTeamQuery } from './team-query';
import styles from './team.module.css';

export function RecruitingBoard({ data, mine }: { data: TeamDirectoryData; mine: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<TeamActionResult | null>(null);
  const [editor, setEditor] = useState<RecruitingTeam | null | undefined>(undefined);
  const membership = data.members.find(member => member.user_id === data.own.id);
  const myTeam = data.teams.find(team => team.owner_id === data.own.id);
  const legacyTeam = data.teams.find(team => team.id === membership?.team_id);
  const q = params.get('tq') ?? '', role = params.get('trole') ?? '', goal = params.get('tgoal') ?? '';
  const teams = data.teams.filter(team => team.status === 'recruiting' &&
    (!role || team.roles_needed.includes(role)) && (!goal || team.goal === goal) &&
    `${team.name} ${team.pitch} ${team.roles_needed.join(' ')} ${team.interests.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()));
  const act = (work: () => Promise<TeamActionResult>, onSuccess?: () => void) => {
    setFeedback(null);
    startTransition(async () => {
      try { const result = await work(); setFeedback(result); if (result.ok) { onSuccess?.(); router.refresh(); } }
      catch { setFeedback({ ok: false, message: 'Your change could not be saved. Try again.' }); }
    });
  };
  const start = () => { setFeedback(null); setEditor(null); };
  const renderFeedback = () => feedback && <p role={feedback.ok ? 'status' : 'alert'} className={styles.feedback}>{feedback.message}</p>;
  return <section aria-labelledby="recruiting-heading">
    <div className={styles.sectionHead}><div><h2 id="recruiting-heading">{mine ? 'Your team post' : 'Teams recruiting'}</h2><p className={styles.small}>{mine ? 'Keep your open roles and Slack contact up to date.' : 'Find an idea you like. Message the team directly on Slack.'}</p></div>
      {!membership && !myTeam && <button type="button" className={styles.primary} disabled={!data.recruitingReady} onClick={start}>Post your team</button>}
      {!mine && myTeam && <button type="button" className={styles.secondary} onClick={() => updateTeamQuery({view:'mine'})}>Edit your post</button>}
    </div>
    {!data.recruitingReady && <p className={styles.notice}>Team contact links are being updated. Hacker profiles and saved profiles are still available.</p>}
    {editor === undefined && renderFeedback()}
    {mine ? <>
      {myTeam ? <>
        <div className={styles.singleCard}><TeamCard team={myTeam} /></div>
        <div className={`${styles.inlineActions} mt-4`}>
          <button type="button" className={styles.secondary} disabled={pending || !data.recruitingReady} onClick={() => { setFeedback(null); setEditor(myTeam); }}>Edit team post</button>
          <button type="button" className={styles.danger} disabled={pending} onClick={() => { if (window.confirm('Remove this recruitment post from the directory?')) act(() => leaveTeam(myTeam.id, true)); }}>Remove post</button>
        </div>
        <p className={`${styles.small} mt-4`}>When you have your teammates, edit the post and close recruitment.</p>
      </> : legacyTeam ? <div className={styles.empty}><h3>You&apos;re on {legacyTeam.name}</h3><p>You can contact other teams on Slack. Leave your existing roster here if you want to publish a new team post.</p><button type="button" className={styles.secondary} disabled={pending} onClick={() => act(() => leaveTeam(legacyTeam.id))}>Leave existing roster</button></div> : <div className={styles.empty}><h3>Looking for people to join your idea?</h3><p>Post your project and the roles you need. Interested hackers will contact you on Slack.</p><button type="button" className={styles.primary} disabled={!data.recruitingReady} onClick={start}>Post your team</button></div>}
    </> : <>
      <div className={`${styles.searchRow} ${styles.teamFilters}`}>
        <label className={styles.search}><Icon name="search" /><span className={styles.srOnly}>Search recruiting teams</span><input type="search" maxLength={100} placeholder="Search projects, interests, or roles" value={q} onChange={e => updateTeamQuery({tq:e.target.value || null})} /></label>
        <div className={styles.sort}><SelectControl label="Open role" value={role} onValueChange={value => updateTeamQuery({trole:value || null})} options={[{value:'',label:'Any open role'},...TEAM_ROLES.map(value=>({value,label:value}))]} /></div>
        <div className={styles.sort}><SelectControl label="Team goal" value={goal} onValueChange={value => updateTeamQuery({tgoal:value || null})} options={[{value:'',label:'Any goal'},...Object.entries(TEAM_GOALS).map(([value,label])=>({value,label}))]} /></div>
      </div>
      <p className={`${styles.small} mb-4`} role="status">{teams.length} {teams.length === 1 ? 'team' : 'teams'} recruiting</p>
      {teams.length ? <div className={styles.grid}>{teams.map(team => <TeamCard key={team.id} team={team} />)}</div> : <div className={styles.empty}><h3>{q || role || goal ? 'No teams match these filters' : 'No teams are recruiting yet'}</h3><p>{q || role || goal ? 'Try a different role or broaden your search.' : 'Start with your idea and let other hackers find you.'}</p>
        {(q || role || goal) && <button type="button" className={styles.secondary} onClick={() => updateTeamQuery({tq:null,trole:null,tgoal:null})}>Clear filters</button>}
      </div>}
    </>}
    {editor !== undefined && <Modal title={editor ? 'Edit team post' : 'Post your team'} onClose={() => setEditor(undefined)}>
      <p className={`${styles.small} mb-4`}>Share your idea and open roles. Arrange your team on Slack, then close the post when you&apos;re ready.</p>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); act(() => saveRecruitingTeam(form), () => { setEditor(undefined); updateTeamQuery({view:'mine'}); }); }}>
        {editor && <input type="hidden" name="id" value={editor.id} />}
        <label>Team name<input name="name" required minLength={2} maxLength={60} defaultValue={editor?.name ?? ''} /></label>
        <label>Project idea<textarea name="pitch" required minLength={10} maxLength={500} defaultValue={editor?.pitch ?? ''} placeholder="What are you building, and who would you like to build it with?" /></label>
        <fieldset><legend>Roles you&apos;re looking for</legend><div className={styles.chipGroup}>{TEAM_ROLES.map(value => <label className={styles.choice} key={value}><input type="checkbox" name="roles_needed" value={value} defaultChecked={editor?.roles_needed.includes(value) ?? false} />{value}</label>)}</div></fieldset>
        <label>Project interests<input name="interests" maxLength={329} defaultValue={editor?.interests.join(', ') ?? ''} placeholder="Accessibility, games, climate" /><span className={styles.small}>Up to 10 interests, separated by commas.</span></label>
        <label>Slack member profile<input type="url" name="slack_url" required maxLength={500} defaultValue={editor?.slack_url ?? data.own.slackUrl ?? ''} placeholder="https://workspace.slack.com/team/U123ABC" /><span className={styles.small}>Interested hackers will use this link to contact your team.</span></label>
        <div className={styles.formGrid}>
          <label>Team goal<SelectControl label="Team goal" name="goal" defaultValue={editor?.goal ?? 'both'} options={Object.entries(TEAM_GOALS).map(([value,label])=>({value,label}))} /></label>
          <label>Team size limit<SelectControl label="Team size limit" name="capacity" defaultValue={String(editor?.capacity ?? 4)} options={[2,3,4].map(size=>({value:String(size),label:`Up to ${size} people`}))} /></label>
        </div>
        <label>Recruitment<SelectControl label="Recruitment" name="status" defaultValue={editor?.status ?? 'recruiting'} options={[{value:'recruiting',label:'Open to teammates'},{value:'closed',label:'Closed — team complete'}]} /></label>
        {renderFeedback()}<button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Saving…' : editor ? 'Save changes' : 'Publish team post'}</button>
      </form>
    </Modal>}
  </section>;
}

function TeamCard({team}: {team: RecruitingTeam}) {
  const slack = safeSlackProfileUrl(team.slack_url ?? null);
  return <article className={styles.card}>
    <div className={styles.cardMeta}><span className={`${styles.badge} ${team.status === 'closed' ? styles.badgeHidden : ''}`}>{team.status === 'recruiting' ? 'Recruiting' : 'Recruitment closed'}</span><span className={styles.small}>Up to {team.capacity} people</span></div>
    <h3 className={styles.teamTitle}>{team.name}</h3><p className={styles.bio}>{team.pitch}</p>
    <span className={styles.label}>Looking for</span><div className={styles.chipGroup}>{team.roles_needed.length ? team.roles_needed.map(role => <span className={`${styles.chip} ${styles.role}`} key={role}>{role}</span>) : <span className={styles.small}>Open to different strengths</span>}</div>
    <span className={styles.label}>Interests & goal</span><div className={styles.chipGroup}>{team.interests.map(value => <span className={styles.chip} key={value}>{value}</span>)}<span className={styles.chip}>{TEAM_GOALS[team.goal]}</span></div>
    <div className={styles.cardFooter}>{slack ? <a href={slack} target="_blank" rel="noopener noreferrer" className={`${styles.primary} ${styles.full}`} aria-label={`Message ${team.name} on Slack (opens in a new tab)`}>Message on Slack</a> : <p className={styles.contactMissing}>Slack contact not added</p>}</div>
  </article>;
}
