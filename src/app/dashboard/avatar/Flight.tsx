"use client";

// Bees flying loops in the wardrobe's empty corner, each trailing a dotted
// line that fades out behind it. SVG animation (SMIL): the bee rides the path
// and, in step, a mask slides along the same path to show the dots just behind
// it. Loaded with ssr: false, so a reduced-motion visitor never sees it move.

import { useId } from "react";
import { HONEY, topBee } from "./Bee";
import styles from "./avatar.module.css";

const TAU = Math.PI * 2;
const f = (n: number) => n.toFixed(1);

// A loop round (cx, cy): an ellipse with a smaller, faster circle riding on
// it. Where the ellipse runs slowest (its ends), the circle wins and the bee
// loops the loop: k = 2 once, k = 3 at both ends. flip = -1 mirrors it, so
// the bee goes round the other way. Drawn as cubic Béziers along the curve's
// own tangents.
function loop(cx: number, cy: number, rx: number, ry: number, r: number, k: number, flip = 1) {
  const at = (t: number) => [cx + flip * (rx * Math.cos(t) - r * Math.cos(k * t)), cy + ry * Math.sin(t) - r * Math.sin(k * t)];
  const tangent = (t: number) => [flip * (-rx * Math.sin(t) + r * k * Math.sin(k * t)), ry * Math.cos(t) - r * k * Math.cos(k * t)];
  const n = 48;
  const h = TAU / n / 3;
  let d = `M${at(0).map(f).join(" ")}`;
  for (let i = 0; i < n; i++) {
    const [p, q, dp, dq] = [at((i * TAU) / n), at(((i + 1) * TAU) / n), tangent((i * TAU) / n), tangent(((i + 1) * TAU) / n)];
    d += `C${f(p[0] + dp[0] * h)} ${f(p[1] + dp[1] * h)} ${f(q[0] - dq[0] * h)} ${f(q[1] - dq[1] * h)} ${f(q[0])} ${f(q[1])}`;
  }
  let length = 0;
  for (let i = 0; i < 600; i++) {
    const [p, q] = [at((i * TAU) / 600), at(((i + 1) * TAU) / 600)];
    length += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return { d: `${d}Z`, length };
}

// In a 400×180 box, drawn 1:1 in the wardrobe's 400px column: [path, px a
// second]. Round loops need r·k at 2-3× ry.
export const FLIGHTS = [
  { ...loop(196, 96, 132, 32, 30, 3), speed: 64 },
  { ...loop(334, 50, 32, 20, 22, 2), speed: 48 },
  { ...loop(86, 140, 50, 13, 12, 3, -1), speed: 52 },
];

// Trail length in px, drawn as bands that stack brighter toward the bee.
const TRAIL = 140;
const BANDS = [1, 0.75, 0.5, 0.25];

export default function Flight() {
  const id = useId().replace(/[^\w-]/g, "");
  return (
    <div className={styles.flight}>
      <svg
        viewBox="0 0 400 180"
        aria-hidden="true"
        ref={(svg) => {
          // Reduced motion: stop mid-flight, a still drawing of three bees on
          // their way. At 19.5s they're furthest apart.
          if (svg && matchMedia("(prefers-reduced-motion: reduce)").matches) {
            svg.pauseAnimations();
            svg.setCurrentTime(19.5);
          }
        }}
      >
        {FLIGHTS.map(({ d, length, speed }, i) => {
          const dur = `${(length / speed).toFixed(2)}s`;
          const mask = `${id}-trail-${i}`;
          return (
            <g key={d}>
              <mask id={mask}>
                {BANDS.map((part) => {
                  // In pathLength units (100 round the loop): show [bee - l, bee).
                  const l = ((TRAIL * part) / length) * 100;
                  return (
                    <path key={part} d={d} pathLength={100} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={8} strokeDasharray={`${l} ${100 - l}`}>
                      <animate attributeName="stroke-dashoffset" values={`${l};${l - 100}`} dur={dur} repeatCount="indefinite" />
                    </path>
                  );
                })}
              </mask>
              {/* One dot every ~7px, a whole number of them so the seam doesn't double up. */}
              <path
                d={d}
                mask={`url(#${mask})`}
                pathLength={Math.round(length / 7)}
                fill="none"
                stroke={HONEY}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeDasharray="0 1"
              />
              <g>
                <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" path={d} />
                {topBee(true)}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
