"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveCollection } from "@/data/hackhive";
import ArchiveCard from "./ArchiveCard";
import PuzzlePiece, { type EdgeKind, type PuzzleSlot } from "./PuzzlePiece";
import styles from "./museum.module.css";

type HackHiveMuseumProps = {
  collections: ArchiveCollection[];
};

type PieceSpec = {
  year: number;
  word: string;
  fill: string;
  slot: PuzzleSlot;
  north: EdgeKind;
  east: EdgeKind;
  south: EdgeKind;
  west: EdgeKind;
};

const PIECES: PieceSpec[] = [
  {
    year: 2026,
    word: "HACK",
    fill: "#f5b83d",
    slot: "tl",
    north: "flat",
    west: "flat",
    east: "tab",
    south: "tab",
  },
  {
    year: 2025,
    word: "HIVE",
    fill: "#ffd879",
    slot: "tr",
    north: "flat",
    east: "flat",
    west: "blank",
    south: "tab",
  },
  {
    year: 2024,
    word: "MUSEUM",
    fill: "#e8a62a",
    slot: "wide",
    west: "flat",
    south: "flat",
    north: "blank",
    east: "flat",
  },
];

const INK = "#231c10";
const UNLOCK_LINE = 0.3;
const EXIT_MS = 420;

export default function HackHiveMuseum({ collections }: HackHiveMuseumProps) {
  const years = useMemo(
    () => collections.map((collection) => collection.year),
    [collections],
  );
  const newest = years[0] ?? 2026;
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const yearNavRef = useRef<HTMLElement | null>(null);
  const [activeYear, setActiveYear] = useState(newest);
  const [renderedYears, setRenderedYears] = useState<number[]>([newest]);
  const [exitingYear, setExitingYear] = useState<number | null>(null);

  useEffect(() => {
    const updateUnlocked = () => {
      const menuBottom =
        window.matchMedia("(max-width: 900px)").matches
          ? (yearNavRef.current?.getBoundingClientRect().bottom ?? 0)
          : 0;
      const line = Math.max(window.innerHeight * UNLOCK_LINE, menuBottom + 16);
      let next = newest;
      for (const year of years) {
        const node = sectionRefs.current[year];
        if (!node) continue;
        if (node.getBoundingClientRect().top <= line) {
          next = year;
        }
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        next = years.at(-1) ?? newest;
      }
      setActiveYear(next);
    };

    updateUnlocked();
    window.addEventListener("scroll", updateUnlocked, { passive: true });
    window.addEventListener("resize", updateUnlocked);
    return () => {
      window.removeEventListener("scroll", updateUnlocked);
      window.removeEventListener("resize", updateUnlocked);
    };
  }, [newest, years]);

  useEffect(() => {
    if (exitingYear !== null) {
      const timer = window.setTimeout(() => {
        setRenderedYears((current) =>
          current.filter((year) => year !== exitingYear),
        );
        setExitingYear(null);
      }, EXIT_MS);
      return () => window.clearTimeout(timer);
    }

    const wanted = new Set(years.filter((year) => year >= activeYear));
    const extras = renderedYears.filter(
      (year) => year !== newest && !wanted.has(year),
    );
    if (extras.length > 0) {
      const frame = window.requestAnimationFrame(() => {
        setExitingYear(Math.min(...extras));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const missing = years.filter(
      (year) => wanted.has(year) && !renderedYears.includes(year),
    );
    if (missing.length > 0) {
      const incoming = Math.max(...missing);
      const frame = window.requestAnimationFrame(() => {
        setRenderedYears((current) =>
          [...current, incoming].sort((a, b) => b - a),
        );
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [exitingYear, newest, renderedYears, activeYear, years]);

  const scrollToYear = (year: number) => {
    sectionRefs.current[year]?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  };

  return (
    <div className={styles.museum}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.squad} aria-label="HackHive Museum">
            {PIECES.filter((piece) => renderedYears.includes(piece.year)).map((piece) => (
              <PuzzlePiece
                key={piece.year}
                {...piece}
                ink={INK}
                active={piece.year === activeYear}
                animate={piece.year !== newest}
                exiting={piece.year === exitingYear}
                onSelect={() => scrollToYear(piece.year)}
              />
            ))}
          </div>
          <nav ref={yearNavRef} className={styles.yearNav} aria-label="Museum years">
            <p className={styles.yearNavLabel}>Explore the years</p>
            <ol className={styles.yearList}>
              {years.filter((year) => renderedYears.includes(year)).map((year) => (
                <li
                  key={year}
                  className={year === exitingYear ? styles.yearItemOut : year !== newest ? styles.yearItemIn : undefined}
                  inert={year === exitingYear}
                >
                  <a
                    href={`#year-${year}`}
                    className={styles.yearLink}
                    aria-current={year === activeYear ? "location" : undefined}
                  >
                    <span className={styles.yearDot} aria-hidden="true" />
                    {year}
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
