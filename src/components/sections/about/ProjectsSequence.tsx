"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import Link from "next/link";
import type { AboutProject } from "@/lib/about";
import { cn } from "@/lib/utils";
import { Polaroids } from "./Polaroids";
import { clamp, decrypt, smooth } from "./ascii";
import styles from "./about.module.css";

/**
 * Projects from 2026, played in like the stats (StatsSequence). A short track pins a screen and
 * scroll plays two turns: the heading decrypts, then all three Polaroids come in together as ASCII
 * and develop into their photos. Once they have, the link to the archive appears. Scrolling back
 * up runs it in reverse.
 * Phones: three Polaroids don't fit one pinned screen, so they scroll as a column and each one
 * develops as it rises to the middle of the screen.
 * Reduced motion, or no JS: everything as a plain list, photos already developed.
 */

const TURNS = 2; // the heading, then the Polaroids
const HOLD = 0.4; // turns of scroll at the end with everything in place
const DEVELOP = [0.15, 0.75] as const; // within the Polaroids' turn: ASCII to photo
const LINK_AT = 0.8; // into the Polaroids' turn, the archive link comes in
const PHONE = "(max-width: 639px)";

export function ProjectsSequence({ projects, archiveHref }: { projects: readonly AboutProject[]; archiveHref: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Turns played so far, 0 to TURNS + HOLD.
  const turn = () => {
    const track = trackRef.current;
    if (!track) return 0;
    const run = track.offsetHeight - window.innerHeight;
    return (run > 0 ? clamp(-track.getBoundingClientRect().top / run) : 1) * (TURNS + HOLD);
  };

  // AsciiPhoto's level for each Polaroid: 0 = ASCII, 1 = the photo.
  const levels = useMemo(
    () =>
      projects.map((_, i) => () => {
        const track = trackRef.current;
        if (track && window.matchMedia(PHONE).matches) {
          // phones: by where this Polaroid sits on the screen, photo once its centre passes 45%
          const slot = track.querySelector(`[data-seq="${i}"]`);
          if (!slot) return 1;
          const r = slot.getBoundingClientRect();
          return 1 - smooth(0.45, 0.85, (r.top + r.height / 2) / window.innerHeight);
        }
        return smooth(DEVELOP[0], DEVELOP[1], turn() - 1);
      }),
    [projects],
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
    const phone = window.matchMedia(PHONE);
    let raf = 0;

    function update() {
      raf = 0;
      if (phone.matches) {
        // not pinned on phones: everything is in place, the photos develop by position
        for (const el of items) if (el.dataset.state !== "active") el.dataset.state = "active";
        if (heading.textContent !== headingText) heading.textContent = headingText;
        return;
      }
      const t = turn();
      for (const el of items) {
        const kind = el.dataset.seq;
        const state =
          kind === "heading" ? "active" : kind === "link" ? (t - 1 >= LINK_AT ? "active" : "hidden") : t - 1 < 0.02 ? "hidden" : "active";
        if (el.dataset.state !== state) el.dataset.state = state;
      }
      const text = decrypt(headingText, smooth(0.05, 0.7, t), Math.floor(performance.now() / 50));
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
