"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  const [unlockedYear, setUnlockedYear] = useState(newest);
  const [renderedYears, setRenderedYears] = useState<number[]>([newest]);
  const [exitingYear, setExitingYear] = useState<number | null>(null);

  useEffect(() => {
    const updateUnlocked = () => {
      const menuBottom =
        yearNavRef.current?.getBoundingClientRect().bottom ?? 0;
      const line = Math.max(window.innerHeight * UNLOCK_LINE, menuBottom + 16);
      let next = newest;
      for (const year of years) {
        const node = sectionRefs.current[year];
        if (!node) continue;
        if (node.getBoundingClientRect().top <= line) {
          next = year;
        }
      }
      setUnlockedYear(next);
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

    const wanted = new Set(years.filter((year) => year >= unlockedYear));
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
  }, [exitingYear, newest, renderedYears, unlockedYear, years]);

  const scrollToYear = (year: number) => {
    sectionRefs.current[year]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className={styles.museum}>
      <nav
        ref={yearNavRef}
        className={styles.yearNav}
        aria-label="Museum years"
      >
        <span className={styles.yearNavLabel}>Explore the years</span>
        {years.map((year) => (
          <a
            key={year}
            href={`#year-${year}`}
            className={styles.yearLink}
            aria-current={year === unlockedYear ? "location" : undefined}
          >
            {year}
          </a>
        ))}
      </nav>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <Link href="/" className={styles.backLink}>
            Back to homepage
          </Link>
          <div className={styles.brand}>
            <p className={styles.kicker}>The archive</p>
            <p className={styles.title}>
              A little history.
              <br />A lot of building.
            </p>
          </div>
          <div className={styles.squad} aria-label="HackHive Museum">
            {PIECES.filter((piece) => renderedYears.includes(piece.year)).map(
              (piece) => (
                <PuzzlePiece
                  key={piece.year}
                  year={piece.year}
                  word={piece.word}
                  fill={piece.fill}
                  ink={INK}
                  slot={piece.slot}
                  north={piece.north}
                  east={piece.east}
                  south={piece.south}
                  west={piece.west}
                  active={piece.year === unlockedYear}
                  animate={piece.year !== newest}
                  exiting={piece.year === exitingYear}
                  onSelect={() => scrollToYear(piece.year)}
                />
              ),
            )}
          </div>
          <p className={styles.scrollHint}>
            <span className={styles.scrollArrow} aria-hidden>
              <svg viewBox="0 0 24 40" width="22" height="38">
                <path
                  d="M12 2v28M4 20l8 14 8-14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Scroll through the years.
            <br />
            Watch the archive come together.
          </p>
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
