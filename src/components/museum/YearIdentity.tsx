"use client";

import { useEffect, useState } from "react";
import styles from "./museum.module.css";

export default function YearIdentity({ year, reducedMotion }: { year: number; reducedMotion: boolean }) {
  const [displayed, setDisplayed] = useState(year);
  const [scribbling, setScribbling] = useState(false);
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
    <h1 className={styles.brand}>HackHive</h1>
    <div className={styles.yearSlot} data-scribbling={scribbling} aria-live="polite" aria-atomic="true">
      <span key={displayed} className={styles.yearValue}>{displayed}</span>
      <svg viewBox="0 0 220 80" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="m8 51 197-27L14 45l190 10L6 31l201 28L26 61l163-42L9 53" /></svg>
    </div>
  </div>;
}
