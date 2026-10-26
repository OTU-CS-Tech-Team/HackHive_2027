"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveCollection } from "@/data/hackhive";
import ArchiveCard from "./ArchiveCard";
import MuseumMark from "./MuseumMark";
import styles from "./museum.module.css";

type HackHiveMuseumProps = {
  collections: ArchiveCollection[];
};

export default function HackHiveMuseum({ collections }: HackHiveMuseumProps) {
  const years = useMemo(
    () => collections.map((collection) => collection.year),
    [collections],
  );
  const newest = years[0];
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const yearNavRef = useRef<HTMLElement | null>(null);
  const [activeYear, setActiveYear] = useState(newest);

  useEffect(() => {
    const updateActiveYear = () => {
      const menuBottom = window.matchMedia("(max-width: 900px)").matches
        ? (yearNavRef.current?.getBoundingClientRect().bottom ?? 0)
        : 0;
      const line = Math.max(window.innerHeight * 0.3, menuBottom + 16);
      let next = newest;
      for (const year of years) {
        const node = sectionRefs.current[year];
        if (node && node.getBoundingClientRect().top <= line) next = year;
      }
      // Short final collections may not reach the activation line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        next = years.at(-1) ?? newest;
      }
      setActiveYear(next);
    };

    updateActiveYear();
    window.addEventListener("scroll", updateActiveYear, { passive: true });
    window.addEventListener("resize", updateActiveYear);
    return () => {
      window.removeEventListener("scroll", updateActiveYear);
      window.removeEventListener("resize", updateActiveYear);
    };
  }, [newest, years]);

  return (
    <div className={styles.museum}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <MuseumMark className={styles.museumMark} />
          <nav ref={yearNavRef} className={styles.yearNav} aria-label="Museum years">
            <p className={styles.yearNavLabel}>Explore the years</p>
            <ol className={styles.yearList}>
              {years.map((year) => (
                <li key={year}>
                  <a
                    href={`#year-${year}`}
                    className={styles.yearLink}
                    aria-current={year === activeYear ? "location" : undefined}
                  >
                    <span className={styles.yearDot} aria-hidden="true" />
                    {year}
                    <span className={styles.yearArrow} aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className={styles.main}>
          <header className={styles.welcome}>
            <p className={styles.kicker}>Made at HackHive</p>
            <h1 className={styles.welcomeTitle}>HackHive Museum</h1>
            <p className={styles.welcomeCopy}>
              Explore the projects built by past HackHive teams. Watch their
              demos and revisit the ideas that started here.
            </p>
            <div className={styles.archiveStats}>
              <span>
                <strong>
                  {collections.reduce(
                    (total, collection) => total + collection.projects.length,
                    0,
                  )}
                </strong>{" "}
                projects
              </span>
              <span>
                <strong>{years.length}</strong> years of HackHive
              </span>
            </div>
          </header>
          {collections.map((collection) => (
            <section
              key={collection.year}
              id={`year-${collection.year}`}
              ref={(node) => {
                sectionRefs.current[collection.year] = node;
              }}
              className={styles.yearSection}
              aria-labelledby={`heading-${collection.year}`}
            >
              <div className={styles.yearHeading}>
                <span className={styles.yearBadge} aria-hidden="true">
                  {collection.year}
                </span>
                <div>
                  <h2
                    id={`heading-${collection.year}`}
                    className={styles.yearTitle}
                  >
                    {collection.title}
                  </h2>
                  <p className={styles.yearCount}>
                    {collection.projects.length}{" "}
                    {collection.projects.length === 1 ? "project" : "projects"}{" "}
                    in this collection
                  </p>
                </div>
              </div>
              {collection.projects.length > 0 ? (
                <div className={styles.grid}>
                  {collection.projects.map((project) => (
                    <ArchiveCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <p className={styles.emptyYear}>
                  Winners for this year will land here.
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
