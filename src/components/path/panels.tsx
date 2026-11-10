import Link from "next/link";
import styles from "@/components/path/path.module.css";

const EVENT_DATE_TEXT = "January 29–31, 2027 • In-person event";
const HERO_APPLY_LINE = "Applications are open, join us as a hacker!";

export function TrailheadPanel() {
  return (
    <div data-hero-parallax="" className={`${styles.hero} will-change-transform`}>
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
