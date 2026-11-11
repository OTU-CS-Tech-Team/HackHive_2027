import type { ReactNode } from "react";
import styles from "@/components/path/path.module.css";

const EVENT_DATE = "January 29–31, 2027";
const EVENT_PLACE = "In-person event";
const HERO_APPLY_LINE = "Applications are open, join us as a hacker!";

function Wordmark() {
  return (
    <>
      <span className={styles.heroLine}>HackHive</span>
      <span className={styles.heroYear}>2027</span>
    </>
  );
}

export function TrailheadPanel({ children }: { children: ReactNode }) {
  return (
    <div data-hero-parallax="" className={styles.hero}>
      <h1 className={`${styles.heroTitle} ${styles.display}`}>
        <span className={styles.heroFace}>
          <Wordmark />
        </span>
      </h1>
      <div className="relative mt-5 flex flex-col items-center md:mt-7 md:items-start">
        {/* A soft cream lift behind the dark lines, so they hold where a peak or the hill runs behind them. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[150%] w-[min(36rem,130%)] -translate-x-1/2 -translate-y-[52%] bg-[radial-gradient(ellipse_at_center,rgba(255,248,230,0.5)_0%,rgba(255,248,230,0.24)_45%,transparent_72%)] md:left-0 md:-translate-x-[14%]"
        />
        <p className={`m-0 max-w-[22rem] text-[1.1rem] leading-snug font-extrabold tracking-[0.02em] md:max-w-none ${styles.heroDate} md:text-[clamp(1.2rem,1.6vw,1.65rem)]`}>
          <span className="block whitespace-nowrap md:inline">{EVENT_DATE}</span>
          <span className="hidden md:inline" aria-hidden="true">
            {" • "}
          </span>
          <span className="mt-1 block whitespace-nowrap md:mt-0 md:inline">{EVENT_PLACE}</span>
        </p>
        <p className={`mt-2 max-w-[17rem] text-[1.02rem] leading-relaxed font-semibold text-balance md:max-w-lg md:text-[clamp(1.12rem,1.3vw,1.3rem)] ${styles.heroLead}`}>
          {HERO_APPLY_LINE}
        </p>
        {children}
      </div>
    </div>
  );
}
