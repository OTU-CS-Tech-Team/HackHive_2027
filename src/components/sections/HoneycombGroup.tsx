"use client";

/* eslint-disable @next/next/no-img-element -- photos come from Supabase Storage */
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Person } from "@/lib/content";
import styles from "./SpeakersSection.module.css";

type HoneycombGroupProps = {
  role: Person["role"];
  heading: string;
  blurb: string;
  people: Person[];
  moreHref?: string;
};

function columnsForWidth(width: number) {
  if (width >= 1440) return 6;
  if (width >= 1120) return 5;
  if (width >= 840) return 4;
  if (width >= 560) return 2;
  return 1;
}

function centerOutSlot(index: number, count: number) {
  const slots = Array.from({ length: count }, (_, slot) => slot);
  slots.sort(
    (left, right) =>
      Math.abs(left - (count - 1) / 2) - Math.abs(right - (count - 1) / 2) ||
      left - right,
  );
  return slots[index];
}

function positionForIndex(index: number, columns: number, peopleCount: number) {
  if (columns === 1) {
    return { gridColumn: '1 / span 2', gridRow: `${index * 4 + 1} / span 4` };
  }
  const cellsPerPattern = columns * 2 - 1;
  const patternIndex = Math.floor(index / cellsPerPattern);
  const cellInPattern = index % cellsPerPattern;
  const remainingInPattern = Math.min(cellsPerPattern, peopleCount - patternIndex * cellsPerPattern);
  const firstRowCount = Math.min(columns, remainingInPattern);
  const isInsetRow = cellInPattern >= firstRowCount;
  const rowStartIndex = isInsetRow ? firstRowCount : 0;
  const rowCount = isInsetRow
    ? remainingInPattern - firstRowCount
    : firstRowCount;
  const columnInRow = cellInPattern - rowStartIndex;
  const slot = rowCount < columns
    ? centerOutSlot(columnInRow, rowCount)
    : columnInRow;
  const rowOffset = (columns - rowCount) / 2 - (isInsetRow ? 0.5 : 0);
  const gridColumn = slot * 2 + (isInsetRow ? 2 : 1);
  const rows: number[] = [];
  for (let remaining = peopleCount; remaining > 0;) {
    const fullRowCount = Math.min(columns, remaining);
    rows.push(fullRowCount);
    remaining -= fullRowCount;
    if (remaining > 0) {
      const insetRowCount = Math.min(columns - 1, remaining);
      rows.push(insetRowCount);
      remaining -= insetRowCount;
    }
  }
  const targetRow = patternIndex * 2 + Number(isInsetRow);
  let gridRow = 1;
  for (let row = 0; row < targetRow; row++) {
    const currentOffset = (columns - rows[row]) / 2;
    const nextOffset = (columns - rows[row + 1]) / 2;
    const sharesColumn = Array.from({ length: rows[row] }, (_, current) =>
      Array.from({ length: rows[row + 1] }, (_, next) =>
        currentOffset + current === nextOffset + next,
      ).some(Boolean),
    ).some(Boolean);
    gridRow += sharesColumn ? 4 : 3;
  }

  return {
    gridColumn: `${gridColumn} / span 2`,
    gridRow: `${gridRow} / span 4`,
    transform: `translateX(calc(var(--tile-width) * ${rowOffset}))`,
  };
}

function PersonHexCard({ person, role }: {
  person: Person;
  role: Person["role"];
}) {
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const isOpen = flipped || hovered;

  useEffect(() => {
    const touchQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateTouchMode = () => setTouchMode(touchQuery.matches);

    updateTouchMode();
    touchQuery.addEventListener("change", updateTouchMode);
    return () => touchQuery.removeEventListener("change", updateTouchMode);
  }, []);
  const lastTap = useRef(0);
  const justTapped = () => performance.now() - lastTap.current < 600;
  return (
    <div
      className={`${styles.card} ${touchMode ? styles.touchMode : ""} ${flipped ? styles.isFlipped : ""} ${hovered ? styles.isHovered : ""}`}
      onPointerEnter={(event) => {
        if (!touchMode && event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (!touchMode && event.pointerType === "mouse") setHovered(false);
      }}
    >
      <button
        type="button"
        className={`${styles.face} ${styles.front} ${styles.faceButton}`}
        aria-hidden={isOpen}
        aria-expanded={isOpen}
        tabIndex={isOpen ? -1 : 0}
        aria-label={`Show details for ${person.name}`}
        onPointerUp={(event) => {
          if (event.pointerType === "mouse") return;
          lastTap.current = performance.now();
          setFlipped((current) => !current);
        }}
        onClick={() => {
          if (justTapped()) return;
          setFlipped((current) => !current);
        }}
      >
        {person.photo_url ? (
          <img src={person.photo_url} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {person.name.charAt(0)}
          </span>
        )}
        <span className={styles.name}>{person.name}</span>
        <span className={styles.tag}>{role === "speaker" ? "Speaker" : "Judge"}</span>
      </button>
      <div
        className={`${styles.face} ${styles.back}`}
        aria-hidden={!isOpen}
        inert={!isOpen}
        onClick={() => {
          if (touchMode && !justTapped()) setFlipped(false);
        }}
      >
        <button
          type="button"
          className={styles.backToggle}
          aria-label={`Show front of ${person.name}'s card`}
          tabIndex={isOpen ? 0 : -1}
          onPointerUp = {(event) => {
              if (event.pointerType === "mouse") return;
                    lastTap.current = performance.now();
              setFlipped((current) => !current);
            }}
        onClick={() => {
          if (justTapped()) return;
          setFlipped((current) => !current);
        }}
        >
        <span className={styles.name}>{person.name}</span>
        {(person.title || person.company) && (
          <span className={styles.details}>
            {[person.title, person.company].filter(Boolean).join(", ")}
          </span>
        )}
        <span className={styles.rule} aria-hidden="true" />
        {person.bio && <span className={styles.bio}>{person.bio}</span>}
      </button>
      {person.linkedin_url && (
        <a
          href={person.linkedin_url}
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          LinkedIn
        </a>
      )}
    </div>
    </div >
  );
}

export function HoneycombGroup({
  role,
  heading,
  blurb,
  people,
  moreHref,
}: HoneycombGroupProps) {
  const hiveRef = useRef<HTMLUListElement>(null);
  const [columns, setColumns] = useState<number | null>(null);
  const measured = columns !== null;
  const activeColumns = columns ?? 1;
  const roleClass = role === "speaker" ? styles.speaker : styles.judge;

  useEffect(() => {
    const hive = hiveRef.current;
    if (!hive) return;

    const updateColumns = () => {
      const nextColumns = columnsForWidth(hive.getBoundingClientRect().width);
      setColumns((current) => current === nextColumns ? current : nextColumns);
    };

    const observer = new ResizeObserver(updateColumns);
    observer.observe(hive);
    updateColumns();

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.group}>
      <h3 className={styles.heading}>{heading}</h3>
      <p className={styles.blurb}>{blurb}</p>
      {people.length ? (
        <ul
          ref={hiveRef}
          className={`${styles.hive} ${measured ? styles.ready : ""}`}
          style={{ "--columns": activeColumns } as CSSProperties & { "--columns": number }}
        >
          {people.map((person, index) => (
            <li
              key={person.id}
              className={`${styles.cell} ${roleClass}`}
              style={positionForIndex(index, activeColumns, people.length + Number(Boolean(moreHref)))}
            >
              <div className={styles.flip}>
                <PersonHexCard person={person} role={role} />
              </div>
            </li>
          ))}
          {moreHref && (
            <li
              className={`${styles.cell} ${styles.judge}`}
              style={positionForIndex(people.length, activeColumns, people.length + 1)}
            >
              <Link href={moreHref} className={styles.moreCard}>
                <span className={styles.moreLabel}>More</span>
                <span className={styles.moreArrow} aria-hidden="true">→</span>
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <p className={styles.empty}>Announcing soon.</p>
      )}
    </div>
  );
}
