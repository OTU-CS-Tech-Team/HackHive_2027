"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ArchiveCollection } from "@/data/hackhive";
import Constellation from "./Constellation";
import YearIdentity from "./YearIdentity";
import SpaceBackground from "./SpaceBackground";
import styles from "./museum.module.css";

type SceneState = { year: number; revealed: number[]; crossed: boolean };

export default function HackHiveMuseum({ collections }: { collections: ArchiveCollection[] }) {
  const ordered = useMemo(() => [...collections].sort((a, b) => b.year - a.year), [collections]);
  const firstYear = ordered[0]?.year ?? 2026;
  const [scene, setScene] = useState<SceneState>({ year: firstYear, revealed: [firstYear], crossed: false });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const sections = useRef<Record<number, HTMLElement | null>>({});
  const museum = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // The same query as museum.module.css's upright layout, where the year sits beside the constellation.
    const upright = window.matchMedia("(max-width: 960px) and (orientation: portrait), (max-width: 960px) and (min-height: 561px), (max-width: 960px) and (pointer: fine)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    let frame = 0;
    let lastY = window.scrollY, rising = false;
    const syncScene = () => {
      frame = 0;
      const viewport = window.innerHeight;
      if (window.scrollY !== lastY) rising = window.scrollY < lastY;
      lastY = window.scrollY;
      let year = firstYear;
      const revealed: number[] = [];
      for (const collection of ordered) {
        const section = sections.current[collection.year];
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        if (rect.top < viewport * .88 && rect.bottom > 64) revealed.push(collection.year);
        if (rect.top <= viewport * .45) year = collection.year;
      }
      // Upright on phones, the year sits beside the constellation, over where the project passes as the
      // scenes change. So it's scribbled out as its scene's run ends, fades away as the scene leaves (gone
      // before the project gets to it), and fades back in as the next scene arrives.
      let crossed = false, fade = 1;
      const section = sections.current[year], view = section?.firstElementChild;
      const label = museum.current?.querySelector<HTMLElement>(`.${styles.yearIdentity}`);
      if (upright.matches && section && view instanceof HTMLElement && label) {
        const pinned = parseFloat(getComputedStyle(view).top) || 0;
        const offset = view.getBoundingClientRect().top - pinned;
        const bounds = section.getBoundingClientRect();
        // Scribbled with a little scrolling to go while still pinned, in whichever direction it's being left,
        // and only toward another year: not 2024 on the way down, nor 2026 on the way up to the page's top.
        // Gone by the time the scene has moved a third of the row's height, before the project's top gets up
        // to the year. The next year only fades in over the last third of its scene's arrival, once the
        // last scene has passed it.
        const index = ordered.findIndex(collection => collection.year === year);
        crossed = rising
          ? index > 0 && pinned - bounds.top < 120
          : index < ordered.length - 1 && bounds.bottom - (pinned + view.offsetHeight) < 120;
        fade = 1 - Math.abs(offset) / (label.offsetHeight * .3);
      }
      museum.current?.style.setProperty("--year-fade", String(Math.max(0, Math.min(1, fade))));
      setScene(previous => previous.year === year && previous.crossed === crossed && previous.revealed.join() === revealed.join()
        ? previous : { year, revealed, crossed });
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
      <YearIdentity year={scene.year} reducedMotion={reducedMotion} crossed={scene.crossed} />
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
