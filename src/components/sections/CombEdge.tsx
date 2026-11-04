"use client";

import { useId, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { COMB_HEIGHT, COMB_WIDTH, comb } from "./comb";
import styles from "./CombEdge.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type CombEdgeProps = {
  // Matches the section below, which the comb grows out of.
  colour: string;
  // Shade the tips start from. See-through, so the art above keeps its texture
  // inside the cells; no flat fill can match painted leaves.
  tip: string;
  seed: number;
};

// Comb rising over the seam between two sections, with cells that break off as
// it scrolls past.
export function CombEdge({ colour, tip, seed }: CombEdgeProps) {
  const root = useRef<HTMLDivElement>(null);
  const fade = useId();
  const { edge, cells } = comb(seed);

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to("[data-cell]", {
          scale: 0,
          y: -14,
          transformOrigin: "50% 50%",
          ease: "none",
          stagger: { amount: 0.6 },
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "top 30%",
            scrub: true,
          },
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className={styles.edge} aria-hidden="true">
      <svg
        viewBox={`0 0 ${COMB_WIDTH} ${COMB_HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        className={styles.art}
        fill={`url(#${fade})`}
      >
        {/* In user space, so the fade runs across the whole comb, not each cell. */}
        <linearGradient
          id={fade}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2={COMB_HEIGHT}
        >
          <stop offset="0" stopColor={tip} stopOpacity="0" />
          <stop offset="0.6" stopColor={tip} stopOpacity="0.9" />
          <stop offset="1" stopColor={colour} />
        </linearGradient>
        <path d={edge} />
        {cells.map((d) => (
          <path key={d} d={d} data-cell />
        ))}
      </svg>
    </div>
  );
}
