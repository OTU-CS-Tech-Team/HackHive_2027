import Link from 'next/link';
import styles from './team.module.css';
import { HiveAnimation } from './HiveAnimation';

export function TeamHero() {
  return <>
    <Link href="/dashboard" className={styles.back}>← Hacker hub</Link>
    <header className={`${styles.hero} ${styles.discoveryHero}`}>
      <div><div className={styles.eyebrow}><span />HACKHIVE 2027 · TEAM FINDER</div><h1>Find your hive</h1><p>Find teammates by skills, interests, and what you want to build.</p></div>
      <HiveAnimation />
    </header>
  </>;
}
