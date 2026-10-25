import Link from 'next/link';
import styles from './team.module.css';

export function TeamHero() {
  return <>
    <Link href="/dashboard" className={styles.back}>← Hacker hub</Link>
    <header className={`${styles.hero} ${styles.discoveryHero}`}>
      <div><div className={styles.eyebrow}><span />HACKHIVE 2027 · TEAM FINDER</div><h1>Find your hive</h1><p>Find teammates by skills, interests, and what you want to build.</p></div>
      <svg className={styles.hiveMark} aria-hidden="true" viewBox="0 0 230 140" fill="none">
        <path d="M58 6 88 23V57L58 74 28 57V23ZM118 6 148 23V57L118 74 88 57V23ZM178 6 208 23V57L178 74 148 57V23ZM88 57 118 74V108L88 125 58 108V74ZM148 57 178 74V108L148 125 118 108V74Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M118 6 148 23V57L118 74 88 57V23Z" fill="currentColor" fillOpacity=".15" />
        <circle cx="58" cy="40" r="5" fill="currentColor" /><circle cx="118" cy="40" r="5" fill="currentColor" /><circle cx="148" cy="91" r="5" fill="currentColor" />
      </svg>
    </header>
  </>;
}
