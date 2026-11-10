"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { HeroMeadow } from "@/components/landing/HeroMeadow";
import { TrailheadPanel } from "@/components/path/panels";
import styles from "@/components/path/path.module.css";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Jiwoo's late cream. The veil never goes darker or browner than this.
const CREAM = { r: 0xff, g: 0xf6, b: 0xea };
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

// Starts once the walk is underway and is still sheer at progress 1.
// .dawn is already over the stage by then, so the meadow dissolves into
// its white top instead of sitting behind a blank white band.
function veilAmount(progress: number) {
  return smoothstep((progress - 0.58) / 0.72);
}

function channel(from: number, to: number, amount: number) {
  return Math.round(from + (to - from) * amount);
}

// Transparent cream to solid white. No tan stage.
function veilColor(progress: number) {
  const t = veilAmount(progress);
  if (t <= 0) return "rgba(255, 246, 234, 0)";
  if (t >= 1) return "rgb(255, 255, 255)";
  return `rgba(${channel(CREAM.r, WHITE.r, t)}, ${channel(CREAM.g, WHITE.g, t)}, ${channel(CREAM.b, WHITE.b, t)}, ${t.toFixed(3)})`;
}

export function HeroScroll({ poster, children }: { poster: boolean; children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  // MeadowScene still reads this for camera aim. We leave it at rest so the
  // flowers keep their wind and nothing follows the cursor. Jiwoo drops the
  // camera term on their side.
  const pointerRef = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const veil = root.querySelector<HTMLElement>("[data-hero-veil]");
    let scrollY = window.scrollY;
    let start = 0;
    let end = 1;
    let running = true;
    let lastVeil = "";

    const measure = () => {
      const height = window.innerHeight;
      root.style.setProperty("--path-vh", `${height}px`);
      start = root.offsetTop;
      end = start + root.offsetHeight - height;
      if (end <= start) end = start + 1;
    };

    const onScroll = () => {
      scrollY = window.scrollY;
    };

    const frame = () => {
      if (!running) return;
      const progress = clamp((scrollY - start) / (end - start), 0, 1);
      // Direct from scroll position. No tween, including when motion is reduced.
      progressRef.current = progress;
      const color = veilColor(progress);
      if (veil && color !== lastVeil) {
        veil.style.backgroundColor = color;
        lastVeil = color;
      }
      requestAnimationFrame(frame);
    };

    measure();
    scrollY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const id = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.heroScroll} data-hero-scroll="" aria-label="HackHive 2027">
      <div className={styles.heroStage} data-hero-stage="">
        <HeroMeadow progress={progressRef} pointer={pointerRef} poster={poster} />
        <div className={styles.content}>
          <TrailheadPanel>{children}</TrailheadPanel>
        </div>
        <div className={styles.heroVeil} data-hero-veil="" />
      </div>
    </section>
  );
}
