"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import Link from "next/link";
import type { AboutProject } from "@/lib/about";
import { cn } from "@/lib/utils";
import { Polaroids } from "./Polaroids";
import { clamp, decrypt, smooth } from "./ascii";
import styles from "./about.module.css";

/**
 * Projects from 2026, played in like the stats (StatsSequence). A tall track pins a screen and
 * scroll brings in, one turn each: the heading, decrypting; then each Polaroid, which comes in as
 * ASCII and develops into its photo. Once the last has developed, the link to the archive appears.
 * Scrolling back up runs it in reverse. Phones show one Polaroid at a time.
 * Reduced motion, or no JS: everything as a plain list, photos already developed.
 */

const DEVELOP = [0.15, 0.8] as const; // within a Polaroid's turn: ASCII to photo
const LINK_AT = 0.85; // into the last Polaroid's turn, the archive link comes in
const HOLD = 0.6; // turns of scroll at the end with everything in place

export function ProjectsSequence({ projects, archiveHref }: { projects: readonly AboutProject[]; archiveHref: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const turns = 1 + projects.length; // the heading, then each Polaroid

  const progress = () => {
    const track = trackRef.current;
    if (!track) return 0;
    const run = track.offsetHeight - window.innerHeight;
    return run > 0 ? clamp(-track.getBoundingClientRect().top / run) : 1;
  };

  // AsciiPhoto's level for each Polaroid: 0 = ASCII, 1 = the photo.
  const levels = useMemo(
    () =>
      projects.map((_, i) => () => smooth(DEVELOP[0], DEVELOP[1], progress() * (turns + HOLD) - (i + 1))),
    [projects, turns],
  );

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
    let raf = 0;

    function update() {
      raf = 0;
      const t = progress() * (turns + HOLD);
      const tick = Math.floor(performance.now() / 50);
      for (const el of items) {
        const kind = el.dataset.seq;
        let state = "active";
        if (kind === "heading") {
          // in view from the start, like the first stat; it decrypts over its turn
        } else if (kind === "link") {
          state = t - projects.length >= LINK_AT ? "active" : "hidden";
        } else {
          const i = Number(kind);
          const u = t - (i + 1);
          state = u < 0.02 ? "hidden" : u >= 1 && i < projects.length - 1 ? "done" : "active";
        }
        if (el.dataset.state !== state) el.dataset.state = state;
      }
      const text = decrypt(headingText, smooth(0.05, 0.7, t), tick);
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
  }, [projects.length, turns]);

  return (
    <div ref={trackRef} className={styles.projectsTrack} style={{ "--turns": turns + HOLD } as CSSProperties}>
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

        <Polaroids projects={projects} levels={levels} />

        <div className={cn(styles.projects, styles.quiet, styles.seqItem)} data-seq="link" data-state="hidden">
          <Link href={archiveHref} className={styles.projectsLink}>
            <span>See the full history of HackHive</span>
            <span className={styles.arrow} aria-hidden="true">
              ---------&gt;
            </span>
            <span className={styles.archiveButton}>HackHive archive</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
