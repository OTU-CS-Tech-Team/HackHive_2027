/* eslint-disable @next/next/no-img-element -- OAuth/Storage profile avatars */
import type { TeamProfile } from '@/lib/team/profiles';
import { TEAM_GOALS } from '@/lib/team/profiles';
import styles from './team.module.css';

export function Avatar({ profile }: { profile: TeamProfile }) {
  const tone = Array.from(profile.id).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 3;
  return profile.avatarUrl ? <img src={profile.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className={styles.avatar} />
    : <span className={styles.avatar} data-tone={tone} aria-hidden="true">{profile.name.split(' ').slice(0, 2).map(word => Array.from(word)[0]).join('')}</span>;
}

export function ProfileCard({ profile, saved = false, reasons = [], preview = false, disabled = false, onSave }: {
  profile: TeamProfile; saved?: boolean; reasons?: string[]; preview?: boolean; disabled?: boolean;
  onSave?: () => void;
}) {
  const links = [['GitHub', profile.githubUrl], ['LinkedIn', profile.linkedinUrl], ['Instagram', profile.instagramUrl]];
  return <article className={styles.card}>
    <div className={styles.cardHead}>
      <Avatar profile={profile} />
      <div className={styles.cardIdentity}><h3>{profile.name}</h3><p className={styles.cardSchool}>{profile.school || 'School not added'}</p></div>
      {!preview && <button type="button" className={styles.save} aria-label={`${saved ? 'Unsave' : 'Save'} ${profile.name}`} aria-pressed={saved} disabled={disabled || !onSave} onClick={onSave}>
        <svg aria-hidden="true" width="19" height="21" viewBox="0 0 20 22" fill={saved ? 'currentColor' : 'none'}><path d="M4 2h12v18l-6-4-6 4V2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      </button>}
    </div>
    <div className={styles.cardMeta}><span className={styles.badge}>● Looking for teammates</span>{profile.goal && <span className={styles.small}>{TEAM_GOALS[profile.goal]}</span>}</div>
    {!!profile.roles.length && <div className={styles.chipGroup}>{profile.roles.map(role => <span className={`${styles.chip} ${styles.role}`} key={role}>{role}</span>)}</div>}
    <p className={`${styles.bio} ${styles.profileBio}`}>{profile.bio || 'Open to project ideas. Connect on Slack to find out what you could build together.'}</p>
    {!!profile.skills.length && <div className={styles.chipGroup}>{profile.skills.map(skill => <span className={styles.chip} key={skill}>{skill}</span>)}</div>}
    <div className={styles.cardNeeds}>
      {!!profile.seeking.length && <p className={styles.small}><strong>Looking for:</strong> {profile.seeking.join(' · ')}</p>}
      {!!profile.interests.length && <p className={styles.small}><strong>Interested in:</strong> {profile.interests.join(' · ')}</p>}
    </div>
    {profile.experience === 'first' && <p className={`${styles.small} mt-3`}>First hackathon · ready to learn</p>}
    {!!reasons.length && <p className={styles.match}>✦ {reasons[0]}</p>}
    <div className={styles.cardFooter}>
      <div className={styles.socials}>{links.filter(([, href]) => href).map(([label, href]) => <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={`${label}: ${profile.name} (opens in a new tab)`}>{label}</a>)}</div>
      {preview ? <span className={`${styles.primary} ${styles.full}`}>Message on Slack</span> : profile.slackUrl ? <a className={`${styles.primary} ${styles.full}`} href={profile.slackUrl} target="_blank" rel="noopener noreferrer" aria-label={`Message ${profile.name} on Slack (opens in a new tab)`}>Message on Slack</a> : <p className={styles.contactMissing}>Slack profile not added</p>}
      <div className={styles.footerMeta}>
        {profile.confirmedAt && <p className={styles.confirmed}>Confirmed {new Date(profile.confirmedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' })}</p>}
      </div>
    </div>
  </article>;
}
