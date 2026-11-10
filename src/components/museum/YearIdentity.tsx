"use client";

import { useEffect, useState } from "react";
import styles from "./museum.module.css";

// Single-stroke numerals let each year be written, rather than faded in as type.
const DIGITS: Record<string, string> = {
  "0": "M25 8C8 4 4 24 8 45C12 64 32 60 35 40C39 21 34 5 23 8",
  "1": "M10 19L24 8L23 59",
  "2": "M7 18C12-1 39 5 33 23C29 34 10 41 6 58L37 57",
  "3": "M7 11C32-2 44 20 22 30C47 27 41 65 7 56",
  "4": "M29 60L31 7L5 42L39 41",
  "5": "M36 8L11 9L8 31C40 19 46 60 15 60L6 56",
  "6": "M33 7C15 8 4 30 8 49C13 69 42 57 35 39C29 24 11 31 8 40",
  "7": "M5 9L37 8L15 60",
  "8": "M22 31C-4 19 12-3 31 9C47 20 27 29 15 36C-6 49 14 69 32 57C48 45 29 34 22 31",
  "9": "M34 30C34-3 4 3 7 25C10 44 35 34 34 18C37 35 28 55 12 61",
};

// `crossed` scribbles the year out ahead of a change (its scene is on its way out); clearing it
// without a change writes the year in afresh.
export default function YearIdentity({ year, reducedMotion, crossed = false }: { year: number; reducedMotion: boolean; crossed?: boolean }) {
  const [displayed, setDisplayed] = useState(year);
  const [scribbling, setScribbling] = useState(false);
  const [writes, setWrites] = useState(0);
  const [wasCrossed, setWasCrossed] = useState(crossed);
  if (crossed !== wasCrossed) {
    setWasCrossed(crossed);
    if (!crossed) setWrites(count => count + 1);
  }
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setScribbling(year !== displayed && !reducedMotion);
      if (reducedMotion) setDisplayed(year);
    });
    const timer = year !== displayed && !reducedMotion ? window.setTimeout(() => {
      setDisplayed(year);
      setScribbling(false);
    }, 620) : undefined;
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [year, displayed, reducedMotion]);

  return <div className={styles.yearIdentity}>
    <h1 className={styles.srOnly}>HackHive project archive</h1>
    <div className={styles.yearSlot} data-scribbling={scribbling || crossed} aria-live="polite" aria-atomic="true">
      <span className={styles.srOnly}>{displayed}</span>
      <svg key={`${displayed}-${writes}`}className={styles.writtenYear} viewBox="0 0 220 80" aria-hidden="true">
        {String(displayed).split("").map((digit, index) => <path key={index} d={DIGITS[digit]} pathLength="1"
          transform={`translate(${16 + index * 47} 6)`} style={{ animationDelay: `${index * .18}s` }} />)}
      </svg>
      <svg className={styles.scribble} viewBox="0 0 220 80" aria-hidden="true"><path pathLength="1" d="m8 51 197-27L14 45l190 10L6 31l201 28L26 61l163-42L9 53" /></svg>
    </div>
  </div>;
}
