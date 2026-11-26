import Link from 'next/link';
import styles from './team.module.css';
import { HiveAnimation } from './HiveAnimation';

export function TeamHero() {
  return <>
    <header className={`${styles.hero} ${styles.discoveryHero}`}>
      <div><div className={styles.eyebrow}>HACKHIVE 2027</div><h1>Find Your Teammates</h1></div>
      <HiveAnimation />
    </header>
  </>;
}
