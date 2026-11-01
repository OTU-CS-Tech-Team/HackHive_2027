"use client";

import { useState } from "react";
import Link from "next/link";
import { EVENT_DATE_TEXT } from "@/components/join/JoinCard";
import styles from "@/components/path/path.module.css";

const STONES = [
  {
    id: "when",
    label: "When?",
    answer: EVENT_DATE_TEXT,
  },
  {
    id: "who",
    label: "Who?",
    answer:
      "HackHive is Ontario Tech University's premier hackathon. Build, learn, and connect with fellow hackers from across the globe.",
  },
  {
    id: "join",
    label: "How do I join?",
    answer: "Apply as a hacker. The form lives at the end of this path.",
  },
  {
    id: "schedule",
    label: "Schedule?",
    answer: "Times are Eastern. Room changes show up on the schedule under the old oak.",
  },
] as const;

export function FaqStones() {
  const [open, setOpen] = useState<string | null>(STONES[0]?.id ?? null);
  const current = STONES.find((stone) => stone.id === open) ?? null;

  return (
    <div className={styles.streamLayout}>
      {current ? (
        <p className={styles.answer}>
          {current.answer}{" "}
          {current.id === "join" ? <Link href="/apply">Join as a hacker</Link> : null}
          {current.id === "schedule" ? <a href="#schedule">See the schedule</a> : null}
        </p>
      ) : null}
      <ul className={styles.stones}>
        {STONES.map((stone) => (
          <li key={stone.id}>
            <button
              type="button"
              className={styles.stone}
              aria-expanded={open === stone.id}
              onClick={() => setOpen((prev) => (prev === stone.id ? null : stone.id))}
            >
              {stone.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
