import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadTeamDirectory } from '@/lib/team/load-directory';
import { TeamHub } from './TeamHub';
import { TeamHero } from './TeamHero';
import styles from './team.module.css';

export const metadata: Metadata = { title: 'Find your people | HackHive 2027', description: 'Meet hackers, discover complementary skills, and build your HackHive team.' };
export default function TeamPage() {
  return <main className={styles.page}><div className={styles.container}>
    <TeamHero />
    <Suspense fallback={<><p role="status" className={`${styles.small} mb-4`}>Finding your next collaboration…</p><div className={styles.grid} aria-hidden="true">{[1, 2, 3].map(value => <div key={value} className={styles.skeleton} />)}</div></>}><TeamContent /></Suspense>
  </div></main>;
}
async function TeamContent() {
  const data = await loadTeamDirectory();
  if (!data.ok) return <div role="alert" className={styles.empty}><h3>We couldn&apos;t load the teammate finder.</h3><p>Your next collaboration is worth another try.</p><a href="/dashboard/team" className={styles.secondary}>Reload directory</a></div>;
  return <TeamHub data={data} />;
}
