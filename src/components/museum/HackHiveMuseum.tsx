"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ArchiveCollection } from "@/data/hackhive";
import Constellation from "./Constellation";
import YearIdentity from "./YearIdentity";
import SpaceBackground from "./SpaceBackground";
import styles from "./museum.module.css";

type SceneState = { year: number; revealed: number[] };

export default function HackHiveMuseum({ collections }: { collections: ArchiveCollection[] }) {
  const ordered = useMemo(() => [...collections].sort((a, b) => b.year - a.year), [collections]);
  const firstYear = ordered[0]?.year ?? 2026;
  const [scene, setScene] = useState<SceneState>({ year: firstYear, revealed: [firstYear] });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const sections = useRef<Record<number, HTMLElement | null>>({});
  const museum = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    let frame = 0;
    const syncScene = () => {
      frame = 0;
      const viewport = window.innerHeight;
      let year = firstYear;
      const revealed: number[] = [];
      for (const collection of ordered) {
        const section = sections.current[collection.year];
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        if (rect.top < viewport * .88 && rect.bottom > 64) revealed.push(collection.year);
        if (rect.top <= viewport * .45) year = collection.year;
      }
      setScene(previous => previous.year === year && previous.revealed.join() === revealed.join()
        ? previous : { year, revealed });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(syncScene); };
    syncMotion(); syncVisibility(); syncScene();
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
  }, [ordered, firstYear]);

  return <div ref={museum} className={styles.museum}>
    <SpaceBackground />
    <aside className={styles.sidebar}>
      <YearIdentity year={scene.year} reducedMotion={reducedMotion} />
    </aside>
    <div className={styles.collections}>
      {ordered.map(collection => <section key={collection.year} id={`year-${collection.year}`}
        ref={node => { sections.current[collection.year] = node; }} className={styles.yearSection}
        aria-label={`HackHive ${collection.year}`}>
        <Constellation collection={collection} revealed={scene.revealed.includes(collection.year)}
          active={scene.year === collection.year && visible && scene.revealed.includes(collection.year)} reducedMotion={reducedMotion} />
      </section>)}
    </div>
      <nav className={styles.yearNav} aria-label="Archive years">
        {ordered.map(collection => <Link key={collection.year} href={`/hackhive/archive#year-${collection.year}`}
          onClick={() => sections.current[collection.year]?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" })}
          aria-current={collection.year === scene.year ? "location" : undefined}>{collection.year}</Link>)}
      </nav>
  </div>;
}
