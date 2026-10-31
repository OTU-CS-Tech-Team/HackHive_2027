'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TEAM_GOALS, TEAM_ROLES, tags, safeWebUrl, safeSlackProfileUrl, type TeamProfile } from '@/lib/team/profiles';
import { ProfileCard } from '../ProfileCard';
import { Modal } from '../Modal';
import { SelectControl } from '../SelectControl';
import { saveTeammateProfile } from '../actions';
import styles from '../team.module.css';

export function ProfileEditor({ own, listed, hasTeam, returnTo }: { own: TeamProfile; listed: boolean; hasTeam: boolean; returnTo: string }) {
  const [draft, setDraft] = useState(own);
  const [visible, setVisible] = useState(listed && !hasTeam);
  const [pending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();
  const set = <K extends keyof TeamProfile>(key: K, value: TeamProfile[K]) => { setDraft(current => ({ ...current, [key]: value })); setResult(null); };
  const toggle = (key: 'roles' | 'seeking', role: string) => set(key, draft[key].includes(role) ? draft[key].filter(value => value !== role) : [...draft[key], role]);
  const preview = { ...draft, name: draft.name || 'Your name', avatarUrl: own.avatarUrl,
    githubUrl: safeWebUrl(draft.githubUrl), linkedinUrl: safeWebUrl(draft.linkedinUrl), instagramUrl: safeWebUrl(draft.instagramUrl), slackUrl: safeSlackProfileUrl(draft.slackUrl) };
  return <>
    <Link href={returnTo} className={styles.back}>Back to teammate finder</Link>
    <header className={styles.hero}><div><div className={styles.eyebrow}><span />YOUR TEAMMATE PROFILE</div><h1>Your place in the hive</h1><p>Add your skills and what you want to build. Your email stays out of the directory.</p></div></header>
    <div className={styles.editorGrid}>
      <div className={styles.editorPanel}>
        <div className={styles.sectionHead}><h2>Your next collaboration starts here</h2><button type="button" className={`${styles.secondary} ${styles.mobileOnly}`} onClick={() => setPreviewOpen(true)}>Preview my card</button></div>
        <form className={styles.form} onSubmit={event => {
          event.preventDefault(); const form = new FormData(event.currentTarget); setResult(null);
          startTransition(async () => { try { const response = await saveTeammateProfile(form); setResult(response); if (response.ok) router.refresh(); } catch { setResult({ ok: false, message: 'Your profile could not be saved. Try again.' }); } });
        }}>
          <div className={styles.formGrid}>
            <label>Name<input name="full_name" required maxLength={100} value={draft.name} onChange={e => set('name', e.target.value)} autoComplete="name" /></label>
            <label>School<input name="school" maxLength={100} value={draft.school} onChange={e => set('school', e.target.value)} autoComplete="organization" /></label>
          </div>
          <label>What would you love to build?<textarea name="team_bio" required={visible} minLength={visible ? 10 : undefined} maxLength={280} value={draft.bio} onChange={e => set('bio', e.target.value)} placeholder="A campus accessibility tool? Your first hardware project? Tell your next team what excites you." /><span className={styles.small}>{draft.bio.length}/280 characters · At least 10 to publish.</span></label>
          <fieldset><legend>I can help with</legend><div className={styles.chipGroup}>{TEAM_ROLES.map(role => <label className={styles.choice} key={role}><input type="checkbox" name="team_roles" value={role} checked={draft.roles.includes(role)} onChange={() => toggle('roles', role)} />{role}</label>)}</div></fieldset>
          <label>My skills<input name="team_skills" defaultValue={own.skills.join(', ')} onChange={e => set('skills', tags(e.target.value))} maxLength={329} placeholder="React, Python, Figma…" /><span className={styles.small}>Separate skills with commas. Up to 10 tags, 32 characters each.</span></label>
          <fieldset><legend>I&apos;m looking for teammates who can help with</legend><div className={styles.chipGroup}>{TEAM_ROLES.map(role => <label className={styles.choice} key={role}><input type="checkbox" name="team_seeking" value={role} checked={draft.seeking.includes(role)} onChange={() => toggle('seeking', role)} />{role}</label>)}</div></fieldset>
          <label>Project interests<input name="team_interests" defaultValue={own.interests.join(', ')} onChange={e => set('interests', tags(e.target.value))} maxLength={329} placeholder="Accessibility, climate, games…" /><span className={styles.small}>Use commas to separate up to 10 interests.</span></label>
          <div className={styles.formGrid}>
            <label>My goal<SelectControl label="My goal" name="team_goal" value={draft.goal ?? ''} onValueChange={value => set('goal', (value || null) as TeamProfile['goal'])} options={[{value:'',label:'Choose a goal'},...Object.entries(TEAM_GOALS).map(([value,label])=>({value,label}))]} /></label>
            <label>Hackathon experience<SelectControl label="Hackathon experience" name="team_experience" value={draft.experience ?? ''} onValueChange={value => set('experience', (value || null) as TeamProfile['experience'])} options={[{value:'',label:'Prefer not to say'},{value:'first',label:'My first hackathon'},{value:'returning',label:"I've hacked before"}]} /></label>
          </div>
          <div className={styles.sectionDivider}><h2>Where teammates can reach you</h2><p className={styles.small}>Add your Slack member profile to make your listing available. Social links are optional.</p></div>
          <label>Slack member profile<input type="url" name="slack_url" required={visible} value={draft.slackUrl ?? ''} onChange={e => set('slackUrl', e.target.value)} maxLength={500} placeholder="https://workspace.slack.com/team/U123ABC" /><a href="https://slack.com/help/articles/360003827751-Create-a-link-to-a-members-profile" target="_blank" rel="noopener noreferrer" className={styles.small}>How to copy your Slack member link</a></label>
          <div className={styles.formGrid}>
            <label>GitHub<input type="url" name="github_url" value={draft.githubUrl ?? ''} onChange={e => set('githubUrl', e.target.value)} maxLength={500} placeholder="https://github.com/you" /></label>
            <label>LinkedIn<input type="url" name="linkedin_url" value={draft.linkedinUrl ?? ''} onChange={e => set('linkedinUrl', e.target.value)} maxLength={500} placeholder="https://linkedin.com/in/you" /></label>
          </div>
          <label>Instagram (optional)<input type="url" name="instagram_url" value={draft.instagramUrl ?? ''} onChange={e => set('instagramUrl', e.target.value)} maxLength={500} placeholder="https://instagram.com/you" /></label>
          <label className={styles.checkLabel}><input type="checkbox" name="looking_for_team" checked={visible} disabled={hasTeam} onChange={e => { setVisible(e.target.checked); setResult(null); }} />Make my profile discoverable to other eligible hackers</label>
          <p className={styles.small}>To publish, add a short bio, at least one skill or role, a goal, and your Slack member link. Uncheck discoverability to save an unfinished draft.</p>
          {hasTeam && <p className={styles.small}>You already have a team here. Your individual listing stays hidden until you leave and choose to be discoverable again.</p>}
          {result && <p className={styles.feedback} role={result.ok ? 'status' : 'alert'}>{result.message}</p>}
          <div className={styles.inlineActions}><button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Saving your profile…' : 'Save teammate profile'}</button><Link href={returnTo} className={styles.quiet}>Back to browsing</Link></div>
        </form>
      </div>
      <aside className={`${styles.preview} ${styles.desktopPreview}`}><h2>Your card · live preview</h2><ProfileCard profile={preview} preview /><p className={`${styles.small} mt-3`}>Only saved changes appear in the directory. Listing visibility is controlled by the checkbox.</p></aside>
    </div>
    {previewOpen && <Modal title="Your teammate card" onClose={() => setPreviewOpen(false)}><ProfileCard profile={preview} preview /><p className={`${styles.small} mt-3`}>Save your profile to publish these changes.</p></Modal>}
  </>;
}
