"use client";

import { useEffect, useRef, useState } from "react";
import type { AboutStat } from "@/lib/about";
import { AsciiPhoto } from "./AsciiPhoto";
import { decrypt } from "./ascii";
import styles from "./about.module.css";

const DECRYPT_MS = 1100;

/**
 * An oval ASCII photo that develops into the real one the first time it scrolls into view, and a
 * big number that decrypts at the same moment. Screen readers get the plain number and label.
 */
export function StatBubble({ stat, step }: { stat: AboutStat; step: number }) {
  const rootRef = useRef<HTMLElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  const value = stat.value.toLocaleString("en-CA");

  useEffect(() => {
    const root = rootRef.current;
    const num = numberRef.current;
    if (!root || !num) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Scrambled from the start, so the real number isn't shown and then taken away.
    if (!reduced) num.textContent = decrypt(value, 0, 0);
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setSeen(true);
        if (reduced) return;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DECRYPT_MS);
          num.textContent = decrypt(value, t, Math.floor(now / 50));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      num.textContent = value;
    };
  }, [value]);

  return (
    <figure ref={rootRef} className={styles.stat} data-step={step}>
      <AsciiPhoto
        image={stat.image}
        developed={seen}
        duration={1900}
        cell={7}
        width={800}
        height={640}
        sizes="(min-width: 1024px) 26rem, (min-width: 640px) 22rem, 70vw"
        className={styles.bubble}
      />
      <figcaption className={styles.statText}>
        <span ref={numberRef} className={styles.statNumber} aria-hidden="true">
          {value}
        </span>
        <span className={styles.statLabel}>
          <span className="sr-only">{value} </span>
          {stat.label}
        </span>
      </figcaption>
    </figure>
  );
}
