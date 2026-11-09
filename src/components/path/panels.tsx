import Link from "next/link";
import type { ReactNode } from "react";
import { EVENT_DATE_TEXT, HERO_APPLY_LINE } from "@/components/join/JoinCard";
import { FaqSection } from "@/components/sections/FaqSection";
import { FaqStones } from "@/components/path/FaqStones";
import styles from "@/components/path/path.module.css";

export function TrailheadPanel() {
  return (
    <div
      data-hero-parallax=""
      className={`${styles.hero} will-change-transform`}
    >
      <h1 className={`${styles.heroTitle} ${styles.display}`}>
        <span className={styles.heroFrost} aria-hidden="true">
          HackHive
        </span>
        <span className={styles.heroFace}>HackHive</span>
      </h1>
      <div className="relative mt-8 flex flex-col items-center md:mt-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[190%] w-[min(38rem,150%)] -translate-x-1/2 -translate-y-[46%] bg-[radial-gradient(ellipse_at_center,rgba(255,247,224,0.82)_0%,rgba(255,236,196,0.38)_46%,transparent_72%)]"
        />
        <p className="m-0 max-w-[18rem] text-[1.05rem] leading-snug font-semibold tracking-[0.045em] text-[#143224] text-balance md:max-w-none md:text-[clamp(1.08rem,2vw,1.3rem)]">
          {EVENT_DATE_TEXT}
        </p>
        <p className="mt-3 max-w-[17rem] text-[1.02rem] leading-relaxed text-[#143224] text-balance md:max-w-lg md:text-[1.12rem]">
          {HERO_APPLY_LINE}
        </p>
        <Link
          href="/apply"
          className="mt-7 inline-flex min-h-13 items-center justify-center rounded-full bg-[#f5b83d] px-8 text-[1.05rem] font-bold text-[#231c10] shadow-[0_12px_28px_rgba(90,50,8,0.2)] transition-[background-color,transform] duration-200 hover:bg-[#ffd36a] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#231c10] motion-reduce:transition-none"
        >
          Join as a hacker
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

const TRACKS = ["AI", "Web", "Hardware", "Social"] as const;

export function TracksPanel() {
  return (
    <div className={styles.stack}>
      <div className={styles.titleChip}>
        <p className={styles.kicker}>Tracks</p>
        <h2 className={`${styles.cardTitle} ${styles.display}`}>The path splits</h2>
      </div>
      <ul className={styles.forks}>
        {TRACKS.map((track) => (
          <li key={track} className={styles.forkName}>
            <span className={styles.bloom} aria-hidden="true" />
            {track}
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
