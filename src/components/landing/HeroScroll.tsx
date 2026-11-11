"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  COPY_LIFT_VH,
  copyFade,
  sceneProgress,
  veilBackground,
} from "@/components/landing/heroHandoff";
import { HeroMeadow } from "@/components/landing/HeroMeadow";
import { TrailheadPanel } from "@/components/path/panels";
import styles from "@/components/path/path.module.css";

/** How fast the camera catches up to the scroll, per second. Higher is snappier. */
const WALK_GLIDE = 12;

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
    const copy = root.querySelector<HTMLElement>("[data-hero-copy]");
    let scrollY = window.scrollY;
    let start = 0;
    let end = 1;
    let running = true;
    let lastVeil = "";
    let lastCopy = "";
    // The camera's walk, gliding toward where the scroll says it should be.
    let walk = -1;
    let lastTime = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
      const raw = Math.max(0, (scrollY - start) / (end - start));
      const progress = Math.min(raw, 1);
      // The scene gets a short walk (WALK_END), so the garden never thins. It
      // glides toward the scroll position (most of the gap closes in about
      // 0.15s), so a wheel's notches don't step the camera. With reduced
      // motion it follows the scroll exactly. The overlays below stay direct.
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const target = sceneProgress(raw);
      if (walk < 0 || reduceMotion.matches) walk = target;
      else walk += (target - walk) * (1 - Math.exp(-dt * WALK_GLIDE));
      if (Math.abs(target - walk) < 1e-5) walk = target;
      progressRef.current = walk;
      const background = veilBackground(progress);
      if (veil && background !== lastVeil) {
        veil.style.background = background;
        lastVeil = background;
      }
      if (copy) {
        const fade = copyFade(raw);
        const signature = fade.toFixed(4);
        if (signature !== lastCopy) {
          lastCopy = signature;
          copy.style.opacity = (1 - fade).toFixed(3);
          copy.style.transform = fade === 0 ? "none" : `translate3d(0, ${(-fade * COPY_LIFT_VH).toFixed(2)}vh, 0)`;
          if (fade >= 0.98) copy.setAttribute("inert", "");
          else copy.removeAttribute("inert");
        }
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
          <div className={styles.copy} data-hero-copy="">
            <TrailheadPanel>{children}</TrailheadPanel>
          </div>
        </div>
        <div className={styles.heroVeil} data-hero-veil="" />
      </div>
    </section>
  );
}
