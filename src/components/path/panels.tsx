import Link from "next/link";
import type { ReactNode } from "react";
import { EVENT_DATE_TEXT, HERO_APPLY_LINE, MLHWordmark } from "@/components/join/JoinCard";
import { FaqSection } from "@/components/sections/FaqSection";
import { FaqStones } from "@/components/path/FaqStones";
import styles from "@/components/path/path.module.css";

export function TrailheadPanel() {
  return (
    <div className={styles.hero}>
      <h1 className={`${styles.heroTitle} ${styles.display}`}>HackHive</h1>
      <p className={styles.heroDate}>{EVENT_DATE_TEXT}</p>
      <p className={styles.heroMember}>
        <MLHWordmark /> Official Member
      </p>
      <p className={styles.heroLine}>{HERO_APPLY_LINE}</p>
      <div className={styles.actions}>
        <Link href="/apply" className={styles.cta}>
          Join as a hacker
        </Link>
        <Link href="#faq" className={styles.heroLearn}>
          Learn more
        </Link>
      </div>
    </div>
  );
}

export function AboutPanel() {
  return (
    <article className={styles.card}>
      <p className={styles.kicker}>About</p>
      <h2 className={`${styles.cardTitle} ${styles.display}`}>What is HackHive?</h2>
      <p className={styles.lede}>
        Join Ontario Tech University&apos;s premier hackathon. Build, learn, and connect with
        fellow hackers from across the globe.
      </p>
      <ul className={styles.stats}>
        <li className={styles.stat}>
          <strong>3 days</strong>
          <span>January 29–31</span>
        </li>
        <li className={styles.stat}>
          <strong>In person</strong>
          <span>Ontario Tech</span>
        </li>
        <li className={styles.stat}>
          <strong>2027</strong>
          <span>Applications open</span>
        </li>
      </ul>
      <p className={styles.lede}>{EVENT_DATE_TEXT}</p>
      <Link href="#faq" className={`${styles.textLink} ${styles.inkLink}`}>
        Learn more
      </Link>
    </article>
  );
}

const TRACKS = [
  { name: "AI", direction: "right" },
  { name: "Web", direction: "left" },
  { name: "Hardware", direction: "right" },
  { name: "Social", direction: "left" },
] as const;

export function TracksPanel() {
  return (
    <div className={styles.stack}>
      <div className={styles.titleChip}>
        <p className={styles.kicker}>Tracks</p>
        <h2 className={`${styles.cardTitle} ${styles.display}`}>The path splits</h2>
      </div>
      <ul className={styles.signs}>
        {TRACKS.map((track) => (
          <li
            key={track.name}
            className={`${styles.signpost} ${track.direction === "right" ? styles.pointRight : styles.pointLeft}`}
          >
            {track.direction === "left" ? "← " : ""}
            {track.name}
            {track.direction === "right" ? " →" : ""}
          </li>
        ))}
      </ul>
      <p className={styles.note}>These names are provisional while the lineup is set.</p>
    </div>
  );
}

export function ReadingPanel({
  kicker,
  children,
  frame = "pad",
}: {
  kicker: string;
  children: ReactNode;
  frame?: "pad" | "sponsor";
}) {
  return (
    <div className={`${styles.readingPanel} ${frame === "sponsor" ? styles.sponsorFrame : ""}`}>
      <p className={styles.readingKicker}>{kicker}</p>
      <div className={frame === "pad" ? styles.pad : undefined}>{children}</div>
    </div>
  );
}

export function StreamPanel() {
  return (
    <div>
      <FaqStones />
      <div className={styles.faqMount}>
        <FaqSection />
      </div>
    </div>
  );
}

export function HivePanel() {
  return (
    <div className={styles.hiveCard}>
      <p className={styles.kicker}>Sunset</p>
      <h2 className={`${styles.hiveTitle} ${styles.display}`}>The hive is open</h2>
      <p className={styles.hiveDate}>{EVENT_DATE_TEXT}</p>
      <p className={styles.lede}>{HERO_APPLY_LINE}</p>
      <div className={styles.actions}>
        <Link href="/apply" className={styles.cta}>
          Join as a hacker
        </Link>
      </div>
    </div>
  );
}
