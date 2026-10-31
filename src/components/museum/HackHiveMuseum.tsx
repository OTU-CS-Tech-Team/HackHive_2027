"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ArchiveCollection } from "@/data/hackhive";
import Constellation from "./Constellation";
import styles from "./museum.module.css";

export default function HackHiveMuseum({ collections }: { collections: ArchiveCollection[] }) {
  const ordered = useMemo(() => [...collections].sort((a, b) => b.year - a.year), [collections]);
  const [activeYear, setActiveYear] = useState(ordered[0]?.year);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const sections = useRef<Record<number, HTMLElement | null>>({});
  const activeIndex = Math.max(0, ordered.findIndex(collection => collection.year === activeYear));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    let frame = 0;
    const syncYear = () => {
      frame = 0;
      // Pick the scene at the reading line, including direct year-anchor visits.
      const line = window.innerHeight * 0.45;
      let next = ordered[0]?.year;
      for (const collection of ordered) {
        const section = sections.current[collection.year];
        if (section && section.getBoundingClientRect().top <= line) next = collection.year;
      }
      setActiveYear(next);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(syncYear); };
    syncMotion(); syncVisibility(); syncYear();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [ordered]);

  return <div className={styles.museum}>
    <div className={styles.starfield} aria-hidden="true" />
    <aside className={styles.sidebar}>
      <h1 className={styles.museumTitle}>Museum</h1>
      <div className={styles.yearIdentity}>
        <p className={styles.brand}>HackHive</p>
        <div className={styles.yearStack} aria-label={`HackHive ${activeYear}`}>
          {ordered.slice(0, activeIndex + 1).map(collection => <div key={collection.year}
            className={collection.year === activeYear ? styles.currentYear : styles.pastYear}>
            {collection.year === activeYear ? <span key={`current-${collection.year}`}>{collection.year}</span>
              : <><span>{collection.year}</span><svg viewBox="0 0 200 50" preserveAspectRatio="none" aria-hidden="true"><path d="M1 36 197 11M7 23 185 29" /></svg></>}
          </div>)}
        </div>
      </div>
      <nav className={styles.yearNav} aria-label="Museum years">
        {ordered.map((collection, index) => <Link key={collection.year} href={`#year-${collection.year}`}
          aria-current={collection.year === activeYear ? "location" : undefined} className={styles.yearLink}>
          <span className={styles.navDot} /><span>{collection.year}</span>
          <span className={styles.srOnly}> projects, collection {index + 1}</span>
        </Link>)}
      </nav>
      <p className={styles.scrollHint}>Previous years <span aria-hidden="true">↓</span></p>
    </aside>
    <div className={styles.collections}>
      {ordered.map(collection => <section key={collection.year} id={`year-${collection.year}`}
        ref={node => { sections.current[collection.year] = node; }} className={styles.yearSection}
        aria-label={`HackHive ${collection.year} projects`}>
        <Constellation collection={collection}
          active={activeYear === collection.year && visible} reducedMotion={reducedMotion} />
      </section>)}
      {!ordered.length && <p className={styles.empty}>The next constellation is on its way.</p>}
    </div>
  </div>;
}
