"use client";
// to turn off flip on scroll up comment out line 238
/* eslint-disable @next/next/no-img-element -- photos come from Supabase Storage */
import Link from "next/link";
import type { Person } from "@/lib/content";
import { getCompactHoneycombPosition } from "@/lib/honeycomb-layout";
import styles from "./SpeakersSection.module.css";
import { useEffect, useRef, useState, type CSSProperties } from "react";
// A row is "open" once its centre rises above this line, given as a fraction
// of viewport height. Opening a row queues its cards, which then flip one at
// a time, left to right.
const FLIP_ROW_LINE = 0.75;
const FLIP_DURATION_MS = 150;
const HYSTERESIS_PX = 48; // stops flicker when sitting right on the line
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
  return 2;
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
  if (columns === 2) {
    const position = getCompactHoneycombPosition(index, peopleCount);

    return {
      gridColumn: `${position.columnStart} / span 2`,
      gridRow: `${position.rowIndex * 3 + 1} / span 4`,
      transform: position.translateX
        ? `translateX(calc(var(--tile-width) * ${position.translateX}))`
        : undefined,
    };
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

  // Left edge of the row, in tile widths. Full rows sit on whole tile widths
  // and inset rows on half tile widths. A partial row is centred, then nudged
  // half a tile left if centring would put it off that grid. Staying on the
  // grid is what makes neighbouring rows interlock.
  const lattice = isInsetRow ? 0.5 : 0;
  let leftEdge = (columns - rowCount) / 2;
  if ((leftEdge - lattice) % 1 !== 0) leftEdge -= 0.5; // use += 0.5 to lean right
  const rowOffset = leftEdge - lattice;

  // Rows always interlock now, so each one starts 3 grid rows below the last.
  const targetRow = patternIndex * 2 + Number(isInsetRow);
  const gridRow = targetRow * 3 + 1;

  return {
    gridColumn: `${slot * 2 + (isInsetRow ? 2 : 1)} / span 2`,
    gridRow: `${gridRow} / span 4`,
    transform: `translateX(calc(var(--tile-width) * ${rowOffset}))`,
  };
}

function PersonHexCard({ person, role, revealed, onFlipEnd }: {
  person: Person;
  role: Person["role"];
  revealed: boolean;
  onFlipEnd: () => void;
}) {
  const [touchMode, setTouchMode] = useState(false);

  useEffect(() => {
    const touchQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateTouchMode = () => setTouchMode(touchQuery.matches);

    updateTouchMode();
    touchQuery.addEventListener("change", updateTouchMode);
    return () => touchQuery.removeEventListener("change", updateTouchMode);
  }, []);

  return (
    <div
      className={`${styles.card} ${touchMode ? styles.touchMode : ""} ${revealed ? styles.isFlipped : ""}`}
      style={{ transitionDuration: `${FLIP_DURATION_MS}ms` }}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === "transform") {
          onFlipEnd();
        }
      }}
    >
      <div className={`${styles.face} ${styles.front}`} aria-hidden={revealed}>
        {person.photo_url ? (
          <img src={person.photo_url} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {person.name.charAt(0)}
          </span>
        )}
        <span className={styles.name}>{person.name}</span>
      </div>
      <div
        className={`${styles.face} ${styles.back}`}
        aria-hidden={!revealed}
        inert={!revealed}
      >
        <div className={styles.backToggle}>
          {role === "judge" && (
            person.photo_url ? (
              <img src={person.photo_url} alt="" className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {person.name.charAt(0)}
              </span>
            )
          )}
          <span className={styles.name}>{person.name}</span>
          {person.title && <span className={styles.details}>{person.title}</span>}
          {person.company && <span className={styles.details}>{person.company}</span>}
          <span className={styles.rule} aria-hidden="true" />
          {person.bio && <span className={styles.bio}>{person.bio}</span>}
        </div>
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
    </div>
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

  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const revealedRef = useRef(revealed);
  const desiredRef = useRef<ReadonlySet<string>>(new Set());
  const onFlipEndRef = useRef<() => void>(() => {});

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

    // Scroll-linked flipping in reading order: rows top to bottom, and within a
  // row left to right in groups of FLIP_GROUP_SIZE. Each group can never flip
  // before the group ahead of it, in either scroll direction.
  useEffect(() => {
    const hive = hiveRef.current;
    if (!hive || !measured) return;

    const cells = Array.from(
      hive.querySelectorAll<HTMLElement>("[data-person-id]"),
    );
        let rowsOfCells: number[][] = [];
    let orderedIds: string[] = [];
    let frame = 0;
    let sequenceTimer = 0;
    let animating = false;

    const measure = () => {
      const items = cells.map((cell, i) => {
        const rect = cell.getBoundingClientRect();
        return {
          i,
          top: rect.top,
          height: rect.height,
          x: rect.left + rect.width / 2,
        };
      });

      // Cluster cards into visual rows by their top edge.
      const sorted = [...items].sort((a, b) => a.top - b.top || a.x - b.x);
      const rows: (typeof items)[] = [];
      for (const item of sorted) {
        const row = rows[rows.length - 1];
        if (row && Math.abs(item.top - row[0].top) < item.height * 0.5) {
          row.push(item);
        } else {
          rows.push([item]);
        }
      }

      // Rows top to bottom, cards left to right: this is the flip order.
      rowsOfCells = rows.map((row) =>
        row.sort((a, b) => a.x - b.x).map((item) => item.i),
      );
      orderedIds = rowsOfCells.flat().map((i) => cells[i].dataset.personId!);
    };
    const advanceSequence = () => {
      if (animating) return;

      const current = revealedRef.current;
      const desired = desiredRef.current;
      const nextId =
        orderedIds.find((id) => desired.has(id) && !current.has(id)) 
        ?? [...orderedIds].reverse().find((id) => current.has(id) && !desired.has(id));
      if (!nextId) return;

      const next = new Set(current);
      if (desired.has(nextId)) next.add(nextId);
      else next.delete(nextId);
      revealedRef.current = next;
      setRevealed(next);
      animating = true;

      const hasTransition =
        !window.matchMedia("(hover: none), (pointer: coarse)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      sequenceTimer = window.setTimeout(() => {
        finishSequence();
      }, hasTransition ? FLIP_DURATION_MS + 100 : 0);
    };

    const finishSequence = () => {
      if (!animating) return;
      if (sequenceTimer) window.clearTimeout(sequenceTimer);
      sequenceTimer = 0;
      animating = false;
      advanceSequence();
    };
    onFlipEndRef.current = finishSequence;

        const update = () => {
      frame = 0;
      const lineY = document.documentElement.clientHeight * FLIP_ROW_LINE;
      const current = desiredRef.current;
      const next = new Set<string>();

      // One trigger per row: every card in the row is wanted flipped, or none.
      for (const row of rowsOfCells) {
        const rect = cells[row[0]].getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const wasOpen = current.has(cells[row[0]].dataset.personId!);
        const open = wasOpen ? centerY < lineY + HYSTERESIS_PX : centerY < lineY;
        if (open) {
          for (const i of row) next.add(cells[i].dataset.personId!);
        }
      }

      const changed =
        next.size !== current.size || [...next].some((id) => !current.has(id));
      if (changed) desiredRef.current = next;
      advanceSequence();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onResize = () => {
      measure();
      schedule();
    };

    measure();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (sequenceTimer) window.clearTimeout(sequenceTimer);
      onFlipEndRef.current = () => {};
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
    };
  }, [measured, activeColumns, people]);

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
              data-person-id={person.id}
              className={`${styles.cell} ${roleClass}`}
              style={positionForIndex(index, activeColumns, people.length + Number(Boolean(moreHref)))}
            >
              <div className={styles.flip}>
                <PersonHexCard
                  person={person}
                  role={role}
                  revealed={revealed.has(person.id)}
                  onFlipEnd={() => onFlipEndRef.current()}
                />
              </div>
            </li>
          ))}
          {moreHref && (
            <li
              className={`${styles.cell} ${styles.judge}`}
              style={positionForIndex(people.length, activeColumns, people.length + 1)}
            >
              <Link href={moreHref} className={styles.moreCard}>
                <span className={styles.moreLabel}>Speakers</span>
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