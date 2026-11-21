import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardSidebar, getAccess } from '@/components/DashboardSidebar';
import { createClient } from '@/lib/supabase/server';
import { loadTeamDirectory } from '@/lib/team/load-directory';
import { TeamHub } from './TeamHub';
import { TeamHero } from './TeamHero';
import styles from './team.module.css';

export const metadata: Metadata = { title: 'Find your hive | HackHive 2027', description: 'Meet hackers, discover complementary skills, and build your HackHive team.' };

export default function TeamPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 pt-24">Loading…</main>}>
      <TeamShell />
    </Suspense>
  );
}

async function TeamShell() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=%2Fdashboard%2Fteam');

  const { allowed } = await getAccess(supabase, user.id);
  if (!allowed.includes('team')) redirect('/dashboard');

  return (
    <div className="pt-24 md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <DashboardSidebar allowed={allowed} active="team" />
      <main className={`${styles.page} min-w-0`}><div className={styles.container}>
        <TeamHero />
        <Suspense fallback={<><p role="status" className={`${styles.small} mb-4`}>Finding your next collaboration…</p><div className={styles.grid} aria-hidden="true">{[1, 2, 3].map(value => <div key={value} className={styles.skeleton} />)}</div></>}><TeamContent /></Suspense>
      </div></main>
    </div>
  );
}

async function TeamContent() {
  const data = await loadTeamDirectory();
  if (!data.ok) return <div role="alert" className={styles.empty}><h3>We couldn&apos;t load the teammate finder.</h3><p>Your next collaboration is worth another try.</p><a href="/dashboard/team" className={styles.secondary}>Reload directory</a></div>;
  return <TeamHub data={data} />;
}