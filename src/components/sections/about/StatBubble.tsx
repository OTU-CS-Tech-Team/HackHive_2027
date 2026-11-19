"use client";

import { useEffect, useRef } from "react";
import type { AboutStat } from "@/lib/about";
import { AsciiPhoto } from "./AsciiPhoto";
import { decrypt } from "./ascii";
import styles from "./about.module.css";

const DECRYPT_MS = 1100;

/**
 * A framed photo that turns into ASCII as you scroll past it (and back into the photo when you
 * scroll up), and a big number that decrypts the first time it comes into view. Steps alternate
 * left and right down the page. Screen readers get the plain number and label.
 */
export function StatBubble({ stat, step }: { stat: AboutStat; step: number }) {
  const rootRef = useRef<HTMLElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
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
    <figure ref={rootRef} className={styles.stat} data-side={step % 2 ? "right" : "left"}>
      <span className={styles.frame}>
        <AsciiPhoto
          image={stat.image}
          developed
          scrub
          cell={7}
          width={800}
          height={533}
          sizes="(min-width: 1024px) 30rem, (min-width: 640px) 24rem, 90vw"
          className={styles.framePhoto}
        />
      </span>
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
