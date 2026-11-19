"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { AboutStat } from "@/lib/about";
import { cn } from "@/lib/utils";
import { AsciiPhoto } from "./AsciiPhoto";
import { clamp, decrypt, smooth } from "./ascii";
import styles from "./about.module.css";

/**
 * The year in numbers, one at a time. A tall track pins a full screen (the HackTransition pattern)
 * and scroll plays each stat in turn: it comes in as a real photo while its number decrypts, the
 * photo turns into ASCII, and only then does the next one come in. Scrolling back up runs it all in
 * reverse. Desktop keeps the earlier stats on screen (left, right, left); phones show one at a time.
 * Reduced motion, or no JS: a plain list of photos and numbers.
 */

// Within a stat's turn (0 to 1): the number decrypts first, then the photo turns into ASCII, then a short hold.
const DECRYPT = [0.02, 0.3] as const;
const TO_ASCII = [0.2, 0.8] as const;
// ...but the real photo holds this many px of scroll longer before it starts turning (the turn
// is ~55vh, so this shifts the start by a share of it and keeps the end before the next stat)
const PHOTO_HOLD_PX = 50;

export function StatsSequence({ stats }: { stats: readonly AboutStat[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const n = stats.length;

  // How far through the pinned track we are, 0 to 1.
  const progress = () => {
    const track = trackRef.current;
    if (!track) return 0;
    const run = track.offsetHeight - window.innerHeight;
    return run > 0 ? clamp(-track.getBoundingClientRect().top / run) : 1;
  };

  // One stable getter per stat for AsciiPhoto: 1 = photo, 0 = ASCII.
  const levels = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => () => {
        const track = trackRef.current;
        const turnPx = track ? (track.offsetHeight - window.innerHeight) / n : 1;
        const hold = Math.min(0.15, PHOTO_HOLD_PX / Math.max(1, turnPx));
        return 1 - smooth(TO_ASCII[0] + hold, Math.min(0.95, TO_ASCII[1] + hold), progress() * n - i);
      }),
    [n],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const fig of track.querySelectorAll<HTMLElement>("[data-stat]")) fig.dataset.state = "active";
      return;
    }
    const figs = [...track.querySelectorAll<HTMLElement>("[data-stat]")];
    const nums = figs.map((fig) => fig.querySelector<HTMLElement>("[data-stat-number]")!);
    const values = stats.map((s) => s.value.toLocaleString("en-CA") + (s.suffix ?? ""));
    let raf = 0;

    function update() {
      raf = 0;
      const p = progress();
      const tick = Math.floor(performance.now() / 50);
      figs.forEach((fig, i) => {
        const u = p * n - i; // this stat's turn: below 0 not yet, above 1 finished
        const state = i > 0 && u < 0.02 ? "hidden" : u >= 1 && i < n - 1 ? "done" : "active";
        if (fig.dataset.state !== state) fig.dataset.state = state;
        const text = decrypt(values[i], smooth(DECRYPT[0], DECRYPT[1], u), tick);
        if (nums[i].textContent !== text) nums[i].textContent = text;
      });
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
      nums.forEach((num, i) => (num.textContent = values[i]));
    };
  }, [stats, n]);

  return (
    <div ref={trackRef} className={styles.statsTrack} style={{ "--n": n } as CSSProperties}>
      <div className={styles.statsStage}>
        <h3 className={cn(styles.subhead, styles.quiet)}>HackHive 2026, in numbers</h3>
        <div className={styles.stats}>
          {stats.map((stat, i) => {
            const value = stat.value.toLocaleString("en-CA") + (stat.suffix ?? "");
            return (
              <figure
                key={stat.id}
                className={styles.stat}
                data-stat=""
                data-state={i === 0 ? "active" : "hidden"}
                data-side={i % 2 ? "right" : "left"}
                style={{ "--i": i } as CSSProperties}
              >
                <span className={styles.frame}>
                  <AsciiPhoto
                    image={stat.image}
                    developed
                    getLevel={levels[i]}
                    cell={7}
                    width={800}
                    height={533}
                    sizes="(min-width: 1024px) 30rem, (min-width: 640px) 24rem, 90vw"
                    className={styles.framePhoto}
                  />
                </span>
                <figcaption className={styles.statText}>
                  <span className={styles.statNumber} data-stat-number="" aria-hidden="true">
                    {value}
                  </span>
                  <span className={styles.statLabel}>
                    <span className="sr-only">{value} </span>
                    {stat.label}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
