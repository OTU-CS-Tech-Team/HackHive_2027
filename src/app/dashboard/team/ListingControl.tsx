'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { type TeamProfile } from '@/lib/team/profiles';
import { Avatar } from './ProfileCard';
import { setTeamListing, type TeamActionResult } from './actions';
import { updateTeamQuery } from './team-query';
import styles from './team.module.css';

export function ListingControl({ profile, listed, found, upgraded, hasTeam, editorHref }: {
  profile: TeamProfile; listed: boolean; found: boolean; upgraded: boolean; hasTeam: boolean; editorHref: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeamActionResult | null>(null);
  const router = useRouter();
  const act = (visible: boolean, teamFound = false) => {
    setResult(null);
    startTransition(async () => { try { const response = await setTeamListing(visible, teamFound); setResult(response); if (response.ok) router.refresh(); } catch { setResult({ ok: false, message: 'Your listing could not be saved. Try again.' }); } });
  };
  const controls = <>
    <button type="button" className={listed ? styles.quiet : styles.primary} disabled={pending} onClick={() => act(!listed)}>{pending ? 'Saving…' : listed ? 'Hide listing' : 'Make me discoverable'}</button>
    {listed && upgraded && <><button className={styles.quiet} disabled={pending} type="button" onClick={() => act(true)}>Still looking ✓</button><button className={styles.quiet} disabled={pending} type="button" onClick={() => act(false, true)}>I found a team 🎉</button></>}
  </>;
  return <>
    <section className={styles.ownPanel} aria-label="Your teammate listing">
      <div className={styles.ownIdentity}><Avatar profile={profile} /><div>
        <div className={styles.ownName}>{profile.name} <span className={`${styles.badge} ${!listed ? styles.badgeHidden : ''}`}>{hasTeam ? 'On a team' : found ? 'Not looking' : listed ? 'Discoverable' : 'Hidden'}</span></div>
        <p className={styles.small}>{listed ? 'Your profile is visible to other hackers.' : 'Your profile is hidden from the directory.'}</p>
      </div></div>
      <div className={styles.ownActions}>
        {upgraded ? <Link href={editorHref} className={styles.secondary}>Edit profile ↗</Link> : <Link href="/dashboard?tab=profile" className={styles.secondary}>Edit links</Link>}
        {hasTeam ? <button type="button" className={styles.quiet} onClick={() => updateTeamQuery({ view: 'mine' })}>Your team →</button> : <details className={styles.availabilityMenu}><summary className={styles.secondary}>Availability ⌄</summary><div>{controls}</div></details>}
      </div>
    </section>
    {result && <p role={result.ok ? 'status' : 'alert'} className={styles.feedback}>{result.message}</p>}
  </>;
}
