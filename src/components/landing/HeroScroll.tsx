"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
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

// The meadow warms toward cream from 0.7. This covers it with white by 0.9,
// a short beat before .dawn, which itself opens on white.
function veilAmount(progress: number) {
  return smoothstep((progress - 0.7) / 0.2);
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

function trackPointer(
  root: HTMLElement,
  pointerRef: RefObject<{ x: number; y: number }>,
  mobile: boolean,
  now: () => number,
) {
  const target = { x: 0, y: 0 };
  const current = pointerRef.current;
  let gyro = false;
  let hovering = false;
  const hero = root.querySelector<HTMLElement>("[data-hero-parallax]");

  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    hovering = true;
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    target.x = clamp((event.clientX / width) * 2 - 1, -1, 1);
    target.y = clamp((event.clientY / height) * 2 - 1, -1, 1);
  };
  const onLeave = () => {
    hovering = false;
    target.x = 0;
    target.y = 0;
  };
  const onOrient = (event: DeviceOrientationEvent) => {
    if (event.gamma == null) return;
    gyro = true;
    target.x = clamp(event.gamma / 28, -1, 1);
    target.y = clamp(((event.beta ?? 0) - 40) / 35, -1, 1);
  };
  const askGyro = () => {
    const orientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof orientation.requestPermission !== "function") return;
    orientation
      .requestPermission()
      .then((state) => {
        if (state === "granted") window.addEventListener("deviceorientation", onOrient, { passive: true });
      })
      .catch(() => {});
  };

  window.addEventListener("pointermove", onPointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  if (mobile) {
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    window.addEventListener("pointerdown", askGyro, { once: true, passive: true });
  }

  const step = () => {
    if (!current) return;
    if (mobile && !gyro && !hovering) {
      const time = now() / 1000;
      target.x = Math.sin(time * 0.32) * 0.16;
      target.y = Math.cos(time * 0.24) * 0.1;
    }
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    if (Math.abs(dx) < 0.0015 && Math.abs(dy) < 0.0015) return;
    current.x += dx * 0.35;
    current.y += dy * 0.35;
    if (hero) {
      hero.style.transform = `translate3d(${(current.x * 14).toFixed(2)}px, ${(current.y * 8).toFixed(2)}px, 0)`;
    }
  };

  return {
    step,
    stop: () => {
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("pointerdown", askGyro);
      if (hero) hero.style.transform = "";
    },
  };
}

export function HeroScroll({ poster, children }: { poster: boolean; children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const veil = root.querySelector<HTMLElement>("[data-hero-veil]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
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

    const pointer = reduce ? null : trackPointer(root, pointerRef, mobile, () => performance.now());

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
      pointer?.step();
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
      pointer?.stop();
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
