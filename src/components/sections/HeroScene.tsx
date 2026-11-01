"use client";

import { useEffect, useRef } from "react";
import styles from "./HeroSection.module.css";

const SPARKS = [
  { left: "16%", top: "26%", delay: "0.2s" },
  { left: "28%", top: "37%", delay: "1.1s" },
  { left: "40%", top: "48%", delay: "0.4s" },
  { left: "52%", top: "59%", delay: "1.6s" },
  { left: "15%", top: "70%", delay: "0.8s" },
  { left: "27%", top: "18%", delay: "2s" },
  { left: "51%", top: "31%", delay: "1.3s" },
  { left: "38%", top: "62%", delay: "0.6s" },
];

export function HeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = rootRef.current?.closest("section");
    const header = document.querySelector<HTMLElement>("[data-navbar-shell]");
    if (!section || !header) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          header.setAttribute("data-over-scene", "true");
        } else {
          header.removeAttribute("data-over-scene");
        }
      },
      { threshold: 0.18 },
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      header.removeAttribute("data-over-scene");
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.scene} aria-hidden="true">
      <div className={styles.meadowIn}>
        <img className={styles.meadow} src="/hero/meadow.webp" alt="" />
      </div>
      <div className={styles.hiveSlot}>
        <div className={styles.hiveSwing}>
          <img className={styles.hive} src="/hero/hive.webp" alt="" />
        </div>
      </div>
      {SPARKS.map((spark) => (
        <span
          key={`${spark.left}-${spark.top}`}
          className={styles.spark}
          style={{ left: spark.left, top: spark.top, animationDelay: spark.delay }}
        />
      ))}
      <div className={styles.shade} />
    </div>
  );
}
