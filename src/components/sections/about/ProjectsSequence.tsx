"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import type { AboutProject } from "@/lib/about";
import { cn } from "@/lib/utils";
import { Polaroids } from "./Polaroids";
import { clamp, decrypt, smooth } from "./ascii";
import styles from "./about.module.css";

/**
 * Projects from 2026, played in like the stats (StatsSequence). A short track pins a screen and
 * scroll plays one quick turn: the heading decrypts, then the Polaroids fly in one after another.
 * Once they have landed, the link to the archive appears. Scrolling back up runs it in reverse
 * (they fly back out).
 * Phones: three Polaroids don't fit one pinned screen, so they scroll as a column; each one flies in
 * as it comes up the screen.
 * Reduced motion, or no JS: everything as a plain list, photos already developed.
 */

const TURNS = 0.95; // the heading, the Polaroids, then (a little further down) the archive link
const HOLD = 0.3; // turns of scroll at the end with everything in place
const HEADING = [0, 0.3] as const; // the heading decrypts first...
const FLY_AT = [0.06, 0.22, 0.38] as const; // ...as the Polaroids fly in, one after another...
// ...then, once the last has landed, a little more scroll (~17vh) brings in the archive link
const LINK_AT = 0.72;
const PHONE = "(max-width: 639px)";
const PHONE_FLY_AT = 0.92; // phones: a Polaroid flies in once its slot's top is this far up the screen
const PHONE_LINK_AT = 0.78; // ...and the archive link a little further up, after the last Polaroid

const flyAt = (i: number) => FLY_AT[Math.min(i, FLY_AT.length - 1)];

/** Where a slot's top sits on the screen, ignoring its own fly-in transform. */
function slotTop(slot: HTMLElement) {
  const parent = slot.offsetParent;
  return parent ? parent.getBoundingClientRect().top + slot.offsetTop : slot.getBoundingClientRect().top;
}

export function ProjectsSequence({ projects, archiveHref }: { projects: readonly AboutProject[]; archiveHref: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Turns played so far, 0 to TURNS + HOLD.
  const turn = () => {
    const track = trackRef.current;
    if (!track) return 0;
    const run = track.offsetHeight - window.innerHeight;
    return (run > 0 ? clamp(-track.getBoundingClientRect().top / run) : 1) * (TURNS + HOLD);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const heading = track.querySelector<HTMLElement>("[data-seq-heading]")!;
    const headingText = heading.textContent ?? "";
    const items = [...track.querySelectorAll<HTMLElement>("[data-seq]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const el of items) el.dataset.state = "active";
      return;
    }
    const phone = window.matchMedia(PHONE);
    let raf = 0;

    function update() {
      raf = 0;
      if (phone.matches) {
        // not pinned on phones: each Polaroid, then the archive link, flies in as it comes up the screen
        const line = window.innerHeight * PHONE_FLY_AT;
        for (const el of items) {
          const kind = el.dataset.seq;
          const at = kind === "link" ? window.innerHeight * PHONE_LINK_AT : line;
          const state = kind === "heading" || slotTop(el) < at ? "active" : "hidden";
          if (el.dataset.state !== state) el.dataset.state = state;
        }
        if (heading.textContent !== headingText) heading.textContent = headingText;
        return;
      }
      const t = turn();
      for (const el of items) {
        const kind = el.dataset.seq!;
        const state =
          kind === "heading"
            ? "active"
            : kind === "link"
              ? t >= LINK_AT
                ? "active"
                : "hidden"
              : t >= flyAt(Number(kind))
                ? "active"
                : "hidden";
        if (el.dataset.state !== state) el.dataset.state = state;
      }
      const text = decrypt(headingText, smooth(HEADING[0], HEADING[1], t), Math.floor(performance.now() / 50));
      if (heading.textContent !== text) heading.textContent = text;
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      heading.textContent = headingText;
    };
  }, [projects.length]);

  return (
    <div ref={trackRef} className={styles.projectsTrack} style={{ "--turns": TURNS + HOLD } as CSSProperties}>
      <div className={styles.projectsStage}>
        <div className={styles.seqItem} data-seq="heading" data-state="active">
          <h3 className={cn(styles.subhead, styles.subheadProjects, styles.quiet)}>
            <span className="sr-only">Projects from HackHive 2026</span>
            <span aria-hidden="true" data-seq-heading="">
              Projects from HackHive 2026
            </span>
          </h3>
          <p className={cn(styles.hint, styles.quiet)}>Open a Polaroid to watch the team&rsquo;s demo.</p>
        </div>

        <Polaroids projects={projects} sequenced />

        <div className={cn(styles.projects, styles.quiet, styles.seqItem)} data-seq="link" data-state="hidden">
          <Link href={archiveHref} className={styles.projectsLink}>
            {/* the three parts fly in one after another, like the Polaroids */}
            <span className={styles.flyPart}>See the full history of HackHive</span>
            <span className={styles.flyPart} aria-hidden="true">
              <span className={styles.arrow}>---------&gt;</span>
            </span>
            <span className={styles.flyPart}>
              <span className={styles.archiveButton}>
                <svg className={styles.archiveHex} viewBox="0 0 16 18" width="14" height="16" aria-hidden="true">
                  <path d="M8 1 15 5v8l-7 4-7-4V5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                HackHive archive
                <span className={styles.archiveGo} aria-hidden="true">
                  &rarr;
                </span>
              </span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
