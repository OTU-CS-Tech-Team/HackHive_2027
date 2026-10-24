import Link from 'next/link';
import styles from './team.module.css';

export function TeamHero() {
  return <>
    <Link href="/dashboard" className={styles.back}>← Hacker hub</Link>
    <header className={`${styles.hero} ${styles.discoveryHero}`}>
      <div><div className={styles.eyebrow}><span />HACKHIVE 2027 · TEAM FINDER</div><h1>Find your people.<br /><em>Build something great.</em></h1><p>Meet curious hackers, share your strengths, and build something that matters.</p></div>
      <div className={styles.heroArt} aria-hidden="true"><span>✦</span><span>↗</span><span>+</span></div>
    </header>
  </>;
}
