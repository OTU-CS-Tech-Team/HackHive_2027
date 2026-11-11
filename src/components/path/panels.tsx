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
      <div className="relative mt-5 flex flex-col items-center md:mt-8">
        {/* A faint green shade behind the white lines, so they hold on the pale hills. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[150%] w-[min(36rem,130%)] -translate-x-1/2 -translate-y-[52%] bg-[radial-gradient(ellipse_at_center,rgba(18,52,34,0.2)_0%,rgba(18,52,34,0.1)_45%,transparent_72%)]"
        />
        <p className={`m-0 max-w-[22rem] text-[1.05rem] leading-snug font-semibold tracking-[0.045em] md:max-w-none ${styles.heroLead} md:text-[clamp(1.08rem,2vw,1.3rem)]`}>
          <span className="block whitespace-nowrap md:inline">{EVENT_DATE}</span>
          <span className="hidden md:inline" aria-hidden="true">
            {" • "}
          </span>
          <span className="mt-1 block whitespace-nowrap md:mt-0 md:inline">{EVENT_PLACE}</span>
        </p>
        <p className={`mt-3 max-w-[17rem] text-[1.02rem] leading-relaxed font-medium text-balance md:max-w-lg md:text-[1.12rem] ${styles.heroLead}`}>
          {HERO_APPLY_LINE}
        </p>
        {children}
      </div>
    </div>
  );
}
