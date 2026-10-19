'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { ArchiveCollection } from '@/data/hackhive';
import type { HackHiveProject } from '@/types/hackhive';
import ArchiveCard from './ArchiveCard';
import PuzzlePiece, { type EdgeKind, type PuzzleSlot } from './PuzzlePiece';
import styles from './museum.module.css';

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
    word: 'HACK',
    fill: '#e7a4b4',
    slot: 'tl',
    north: 'flat',
    west: 'flat',
    east: 'tab',
    south: 'tab',
  },
  {
    year: 2025,
    word: 'HIVE',
    fill: '#9aa56f',
    slot: 'tr',
    north: 'flat',
    east: 'flat',
    west: 'blank',
    south: 'tab',
  },
  {
    year: 2024,
    word: 'MUSEUM',
    fill: '#8eb4c4',
    slot: 'wide',
    west: 'flat',
    south: 'flat',
    north: 'blank',
    east: 'flat',
  },
];

function chunkProjects(projects: HackHiveProject[], size: number) {
  const rows: HackHiveProject[][] = [];
  for (let index = 0; index < projects.length; index += size) {
    rows.push(projects.slice(index, index + size));
  }
  return rows;
}

const YEAR_ACCENT: Record<number, string> = {
  2026: '#d45d7d',
  2025: '#7a8544',
  2024: '#4e8aa0',
};

const INK = '#1b003f';
const UNLOCK_LINE = 0.3;
const EXIT_MS = 420;

export default function HackHiveMuseum({ collections }: HackHiveMuseumProps) {
  const years = useMemo(
    () => collections.map((collection) => collection.year),
    [collections],
  );
  const newest = years[0] ?? 2026;
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const [unlockedYear, setUnlockedYear] = useState(newest);
  const [renderedYears, setRenderedYears] = useState<number[]>([newest]);
  const [exitingYear, setExitingYear] = useState<number | null>(null);

  useEffect(() => {
    const updateUnlocked = () => {
      const line = window.innerHeight * UNLOCK_LINE;
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
    window.addEventListener('scroll', updateUnlocked, { passive: true });
    window.addEventListener('resize', updateUnlocked);
    return () => {
      window.removeEventListener('scroll', updateUnlocked);
      window.removeEventListener('resize', updateUnlocked);
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
    sectionRefs.current[year]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.museum}>
      <nav className={styles.yearNav} aria-label="Museum years">
        <span className={styles.yearNavLabel}>Jump to year</span>
        {years.map((year) => (
          <a
            key={year}
            href={`#year-${year}`}
            className={styles.yearLink}
            aria-current={year === unlockedYear ? 'location' : undefined}
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
            <h1 className={styles.title}>HackHive Archive</h1>
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
            scroll down to view previous years
          </p>
        </aside>

        <div className={styles.main}>
          <header className={styles.welcome}>
            <h2 className={styles.welcomeTitle}>Welcome to the HackHive archive.</h2>
            <p className={styles.welcomeCopy}>
              Not every year was clean. Some weekends broke, some projects stalled,
              and a few ideas only made sense at 3 a.m. Each one still left something
              behind — a trick, a standard, a reason the next cohort could build
              further. This is that stack. Scroll it.
            </p>
          </header>
          {collections.map((collection) => (
            <section
              key={collection.year}
              id={`year-${collection.year}`}
              ref={(node) => {
                sectionRefs.current[collection.year] = node;
              }}
              className={styles.yearSection}
              style={{ '--year-accent': YEAR_ACCENT[collection.year] ?? INK } as CSSProperties}
              aria-labelledby={`heading-${collection.year}`}
            >
              <span className={styles.yearRule} />
              <h2 id={`heading-${collection.year}`} className={styles.yearTitle}>
                {collection.title}
              </h2>
              {collection.projects.length > 0 ? (
                <div className={styles.rows}>
                  {chunkProjects(collection.projects, 3).map((row, index) => (
                    <div key={row.map((project) => project.id).join('-')}>
                      {index > 0 ? <div className={styles.rowRule} /> : null}
                      <div className={styles.grid}>
                        {row.map((project) => (
                          <ArchiveCard
                            key={project.id}
                            project={project}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyYear}>Winners for this year will land here.</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
