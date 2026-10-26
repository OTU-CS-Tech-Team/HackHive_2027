import { Suspense } from 'react';
import Link from 'next/link';
import { requireTeamAccess } from '@/lib/team/access';
import { PROFILE_COLUMNS } from '@/lib/team/load-directory';
import { teamProfile, type TeamProfileRow } from '@/lib/team/profiles';
import { ProfileEditor } from './ProfileEditor';
import styles from '../team.module.css';

export const metadata = { title: 'Your teammate profile | HackHive 2027' };
export default function ProfilePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  return <main className={styles.page}><div className={styles.container}><Suspense fallback={<p role="status">Loading your teammate profile…</p>}><Editor searchParams={searchParams} /></Suspense></div></main>;
}
async function Editor({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const access = await requireTeamAccess();
  if (!access.ok) return <p role="alert">Your profile couldn&apos;t be loaded. <Link href="/dashboard/team">Back to browsing</Link></p>;
  const [{ data: own, error }, { data: membership, error: membershipError }] = await Promise.all([
    access.session.from('profiles').select(`${PROFILE_COLUMNS},looking_for_team`).eq('id', access.user.id).maybeSingle(),
    access.session.from('team_memberships').select('id').eq('user_id', access.user.id).maybeSingle(),
  ]);
  if (error || !own || membershipError) return <div className={styles.empty}><h3>Profile tools are temporarily unavailable</h3><p>You can still browse and manage your existing listing. Try the editor again later.</p><Link href="/dashboard/team" className={styles.secondary}>Back to teammate finder</Link></div>;
  const { returnTo } = await searchParams;
  const safeReturn = typeof returnTo === 'string' && (returnTo === '/dashboard/team' || returnTo.startsWith('/dashboard/team?')) ? returnTo : '/dashboard/team';
  return <ProfileEditor own={teamProfile(own as unknown as TeamProfileRow)} listed={own.looking_for_team === true} hasTeam={!!membership} returnTo={safeReturn} />;
}
