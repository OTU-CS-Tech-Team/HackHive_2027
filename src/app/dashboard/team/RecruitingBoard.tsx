'use client';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TEAM_GOALS, TEAM_ROLES, type TeamDirectoryData, type RecruitingTeam, type TeamMember } from '@/lib/team/profiles';
import { saveRecruitingTeam, requestToJoin, reviewJoinRequest, withdrawJoinRequest, leaveTeam, type TeamActionResult } from './actions';
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
  const [join, setJoin] = useState<{ team: RecruitingTeam; message: string } | null>(null);
  const membership = data.members.find(member => member.user_id === data.own.id);
  const myTeam = data.teams.find(team => team.id === membership?.team_id);
  const ownTeam = data.teams.find(team => team.owner_id === data.own.id);
  const outgoing = data.requests.filter(request => request.applicant_id === data.own.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const incoming = data.requests.filter(request => request.team_id === ownTeam?.id && request.status === 'pending');
  const q = params.get('tq') ?? '', role = params.get('trole') ?? '', goal = params.get('tgoal') ?? '';
  const roster = (team: RecruitingTeam) => data.members.filter(member => member.team_id === team.id);
  const openTeams = data.teams.filter(team => team.status === 'recruiting' && roster(team).length < team.capacity &&
    (!role || team.roles_needed.includes(role)) && (!goal || team.goal === goal) &&
    `${team.name} ${team.pitch} ${team.roles_needed.join(' ')} ${team.interests.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()));
  const act = (work: () => Promise<TeamActionResult>, onSuccess?: () => void) => {
    setFeedback(null);
    startTransition(async () => {
      try { const response = await work(); setFeedback(response); if (response.ok) { onSuccess?.(); router.refresh(); } }
      catch { setFeedback({ ok: false, message: 'This change could not be saved. Refresh and try again.' }); }
    });
  };
  const startTeam = () => { setFeedback(null); setEditor(null); };
  const renderFeedback = () => feedback && <p role={feedback.ok ? 'status' : 'alert'} className={styles.feedback}>{feedback.message}</p>;

  return <section aria-labelledby="recruiting-heading">
    <div className={styles.sectionHead}><div><h2 id="recruiting-heading">{mine ? 'Your team' : 'Teams with open spots'}</h2><p className={styles.small}>{mine ? 'Manage your roster and join requests.' : 'Find an open role or start a team with your own idea.'}</p></div>
      {!membership && <button type="button" className={styles.primary} onClick={startTeam}>+ Start a team</button>}
      {!mine && membership && <button className={styles.secondary} type="button" onClick={() => updateTeamQuery({ view: 'mine' })}>My team →</button>}
    </div>
    {editor === undefined && !join && renderFeedback()}
    {mine ? <>
      {myTeam ? <div className="mb-6"><TeamCard team={myTeam} members={roster(myTeam)} />
        <div className={`${styles.inlineActions} mt-4`}>
          {myTeam.owner_id === data.own.id ? <>
            <button className={styles.secondary} type="button" disabled={pending} onClick={() => { setFeedback(null); setEditor(myTeam); }}>Edit team & recruitment</button>
            <button className={styles.danger} type="button" disabled={pending} onClick={() => { if (window.confirm('Disband this team? Its roster and join requests will be removed. Everyone can choose to list themselves again.')) act(() => leaveTeam(myTeam.id, true)); }}>Disband team</button>
          </> : <button className={styles.danger} type="button" disabled={pending} onClick={() => { if (window.confirm('Leave this team? Your individual listing will stay hidden until you choose to be discoverable again.')) act(() => leaveTeam(myTeam.id)); }}>Leave team</button>}
        </div>
      </div> : <div className={styles.empty}><h3>Your team is still out there.</h3><p>Ask to join a project you believe in, or bring your own idea and invite people to build it with you.</p><div className="flex flex-wrap justify-center gap-3"><button className={styles.primary} type="button" onClick={() => updateTeamQuery({ view: 'teams' })}>Explore recruiting teams</button><button className={styles.secondary} type="button" onClick={startTeam}>Start my own team</button></div></div>}
      {ownTeam && <section className="mt-8" aria-label="Incoming join requests"><div className={styles.sectionHead}><div><h2>People who want to build with you</h2><p className={styles.small}>A request is an introduction. Accepting adds this hacker to your roster.</p></div><span className={styles.badge}>{incoming.length} pending</span></div>
        {!incoming.length && <p className={styles.small}>No pending introductions yet. Keep your open roles and project idea up to date.</p>}
        {incoming.map(request => <article key={request.id} className={styles.request}><h3 className="font-semibold">{request.applicant_name}</h3><blockquote>{request.message}</blockquote><div className={styles.inlineActions}>
          <button className={styles.primary} type="button" disabled={pending || ownTeam.status !== 'recruiting' || roster(ownTeam).length >= ownTeam.capacity} onClick={() => act(() => reviewJoinRequest(request.id, true))}>Accept teammate</button>
          <button className={styles.secondary} type="button" disabled={pending} onClick={() => act(() => reviewJoinRequest(request.id, false))}>Decline</button>
        </div>{ownTeam.status !== 'recruiting' && <p className={styles.small}>Reopen recruitment before accepting someone.</p>}{roster(ownTeam).length >= ownTeam.capacity && <p className={styles.small}>Your team is full. No additional requests can be accepted.</p>}</article>)}
      </section>}
      <section className="mt-8" aria-label="Your join requests"><div className={styles.sectionHead}><div><h2>Your introductions</h2><p className={styles.small}>Only you and each team owner can read your request.</p></div></div>
        {!outgoing.length && <p className={styles.small}>Your team requests will appear here.</p>}
        {outgoing.map(request => <article key={request.id} className={styles.request}><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{data.teams.find(team => team.id === request.team_id)?.name ?? 'Team unavailable'}</h3><span className={`${styles.badge} ${request.status !== 'accepted' ? styles.badgeHidden : ''}`}>{request.status}</span></div><blockquote>{request.message}</blockquote>
          {request.status === 'pending' && <div><button type="button" className={styles.secondary} disabled={pending} onClick={() => act(() => withdrawJoinRequest(request.id))}>Withdraw request</button></div>}
        </article>)}
      </section>
    </> : <>
      <div className={`${styles.searchRow} ${styles.teamFilters}`}>
        <label className={styles.search}><Icon name="search" /><span className={styles.srOnly}>Search recruiting teams</span><input type="search" maxLength={100} placeholder="Find a project you believe in…" value={q} onChange={e => updateTeamQuery({ tq: e.target.value || null })} /></label>
        <div className={styles.sort}><SelectControl label="Open role" className={styles.quickSelect} value={role} onValueChange={value => updateTeamQuery({ trole: value || null })} options={[{value:'',label:'Any open role'},...TEAM_ROLES.map(value=>({value,label:value}))]} /></div>
        <div className={styles.sort}><SelectControl label="Team goal" className={styles.quickSelect} value={goal} onValueChange={value => updateTeamQuery({ tgoal: value || null })} options={[{value:'',label:'Any goal'},...Object.entries(TEAM_GOALS).map(([value,label])=>({value,label}))]} /></div>
      </div>
      <p className={`${styles.small} mb-4`} role="status" aria-live="polite">{openTeams.length} {openTeams.length === 1 ? 'team' : 'teams'} with room to build together</p>
      {openTeams.length ? <div className={styles.grid}>{openTeams.map(team => {
        const request = outgoing.find(value => value.team_id === team.id);
        const isOwn = team.owner_id === data.own.id;
        return <TeamCard key={team.id} team={team} members={roster(team)}><div className="mt-4">
          {isOwn ? <button className={`${styles.secondary} ${styles.full}`} type="button" onClick={() => updateTeamQuery({ view: 'mine' })}>Manage your team →</button> : <button className={`${styles.primary} ${styles.full}`} type="button" disabled={pending || !!membership || request?.status === 'pending'} onClick={() => {
            setFeedback(null); setJoin({ team, message: `Hi ${team.name}! I'm ${data.own.name}.${data.own.roles.length ? ` I can help with ${data.own.roles.join(', ')}.` : ''} ${data.own.bio || "I'd love to hear more about your idea and see how I can contribute."}`.slice(0, 500) });
          }}>{membership ? 'You already have a team' : request?.status === 'pending' ? 'Request pending' : 'Ask to join →'}</button>}
        </div></TeamCard>;
      })}</div> : <div className={styles.empty}><h3>{q || role || goal ? 'Widen the possibilities.' : 'Someone has to start the next great team.'}</h3><p>{q || role || goal ? 'Try another role or project idea. Great collaborations can happen across interests.' : 'No teams are recruiting right now. Publish your idea and let people find you.'}</p>
        {q || role || goal ? <button className={styles.secondary} type="button" onClick={() => updateTeamQuery({ tq: null, trole: null, tgoal: null })}>Clear team filters</button> : !membership && <button className={styles.primary} type="button" onClick={startTeam}>Start a team</button>}
      </div>}
    </>}
    {editor !== undefined && <Modal title={editor ? 'Make room for your next teammate' : 'Start something together'} onClose={() => setEditor(undefined)}>
      <p className={`${styles.small} mb-4`}>A clear idea and a little curiosity go a long way. Starting a team hides your individual listing; you&apos;ll manage recruitment here instead.</p>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); act(() => saveRecruitingTeam(form), () => { setEditor(undefined); updateTeamQuery({ view: 'mine' }); }); }}>
        {editor && <input type="hidden" name="id" value={editor.id} />}
        <label>Team name<input name="name" required minLength={2} maxLength={60} defaultValue={editor?.name ?? ''} placeholder="Something worth building" /></label>
        <label>What do you want to build?<textarea name="pitch" required minLength={10} maxLength={500} defaultValue={editor?.pitch ?? ''} placeholder="Tell potential teammates about the problem, your idea, and what makes you excited to build it." /></label>
        <fieldset><legend>We could use help with</legend><div className={styles.chipGroup}>{TEAM_ROLES.map(value => <label className={styles.choice} key={value}><input type="checkbox" name="roles_needed" value={value} defaultChecked={editor?.roles_needed.includes(value) ?? false} />{value}</label>)}</div></fieldset>
        <label>Project interests<input name="interests" maxLength={329} defaultValue={editor?.interests.join(', ') ?? ''} placeholder="Accessibility, games, climate…" /><span className={styles.small}>Use commas to separate up to 10 interests.</span></label>
        <div className={styles.formGrid}>
          <label>Our goal<SelectControl label="Our goal" name="goal" defaultValue={editor?.goal ?? 'both'} options={Object.entries(TEAM_GOALS).map(([value,label])=>({value,label}))} /></label>
          <label>Total team size<SelectControl label="Total team size" name="capacity" defaultValue={String(editor?.capacity ?? 4)} options={[2,3,4].map(size=>({value:String(size),label:`${size} hackers, including you`}))} /></label>
        </div>
        <label>Recruitment<SelectControl label="Recruitment" name="status" defaultValue={editor?.status ?? 'recruiting'} options={[{value:'recruiting',label:'Open to new teammates'},{value:'closed',label:'Closed — we have our people'}]} /></label>
        {renderFeedback()}<button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Saving…' : editor ? 'Save team' : 'Publish my team'}</button>
      </form>
    </Modal>}
    {join && <Modal title={`Build with ${join.team.name}`} onClose={() => setJoin(null)}>
      <p className={`${styles.small} mb-4`}>Tell the owner what excites you and how you&apos;d like to help. Your request stays private between you and the owner.</p>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); act(() => requestToJoin(join.team.id, join.message), () => setJoin(null)); }}>
        <label>Your introduction<textarea required minLength={10} maxLength={500} value={join.message} onChange={event => setJoin(current => current && ({ ...current, message: event.target.value }))} /><span className={styles.small}>{join.message.length}/500 characters</span></label>
        {renderFeedback()}<button className={styles.primary} type="submit" disabled={pending}>{pending ? 'Sending request…' : 'Send join request'}</button>
      </form>
    </Modal>}
  </section>;
}

function TeamCard({ team, members, children }: { team: RecruitingTeam; members: TeamMember[]; children?: React.ReactNode }) {
  const slots = Math.max(0, team.capacity - members.length);
  return <article className={styles.card}>
    <div className={styles.cardMeta}><span className={`${styles.badge} ${!slots || team.status === 'closed' ? styles.badgeHidden : ''}`}>{team.status === 'closed' ? 'Recruitment closed' : slots ? `${slots} open ${slots === 1 ? 'spot' : 'spots'}` : 'Full team'}</span><span className={styles.small}>{members.length}/{team.capacity} hackers</span></div>
    <h3 className={styles.teamTitle}>{team.name}</h3><p className={styles.bio}>{team.pitch}</p>
    <div className={styles.chipGroup}><span className={styles.chip}>{TEAM_GOALS[team.goal]}</span>{team.interests.map(interest => <span className={styles.chip} key={interest}>{interest}</span>)}</div>
    <span className={styles.label}>Open roles</span><div className={styles.chipGroup}>{team.roles_needed.length ? team.roles_needed.map(role => <span className={`${styles.chip} ${styles.role}`} key={role}>{role}</span>) : <span className={styles.small}>Open to different strengths</span>}</div>
    <span className={styles.label}>Building together</span><ul className={styles.members}>{members.map(member => <li className={styles.member} key={member.id}><span className={styles.memberDot} aria-hidden="true">{Array.from(member.display_name)[0]}</span>{member.display_name}{member.user_id === team.owner_id && <span className={styles.small}>· owner</span>}</li>)}</ul>
    <div className="mt-auto">{children}</div>
  </article>;
}
