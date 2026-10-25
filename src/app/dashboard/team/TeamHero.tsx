import Link from 'next/link';
import styles from './team.module.css';
import { HiveAnimation } from './HiveAnimation';

export function TeamHero() {
  return <>
    <Link href="/dashboard" className={styles.back}>← Hacker hub</Link>
    <header className={`${styles.hero} ${styles.discoveryHero}`}>
      <div><div className={styles.eyebrow}><span />HACKHIVE 2027 · TEAM FINDER</div><h1>Find your teammates</h1><p>Browse hackers and recruiting teams. Connect directly on Slack.</p></div>
      <HiveAnimation />
    </header>
  </>;
}
