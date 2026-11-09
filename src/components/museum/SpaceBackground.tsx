"use client";

import { useEffect, useRef } from "react";
import styles from "./museum.module.css";

type Star = { x: number; y: number; z: number; size: number; warm: boolean };

export default function SpaceBackground() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d", { alpha: false });
    if (!element || !context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    let width = 0, height = 0, frame = 0, previous = 0, started = 0;
    let stars: Star[] = [];
    let offsetX = 0, offsetY = 0, targetX = 0, targetY = 0;
    let scrollImpulse = 0, lastScroll = window.scrollY;
    let seed = 2026;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const createStar = (distant = false): Star => ({
      x: (random() - .5) * width * 1.8,
      y: (random() - .5) * height * 1.8,
      z: distant ? 1 : .12 + random() * .88,
      size: .4 + random() * .65,
      warm: random() > .95,
    });

    const paint = (now: number, still = false) => {
      const elapsed = Math.min(now - previous || 33, 64);
      previous = now;
      // A single arrival, then a nearly imperceptible flight. Never a flashing overlay.
      const arrival = still ? 0 : Math.pow(Math.max(0, 1 - (now - started) / 2400), 3);
      const speed = still ? 0 : .000006 + arrival * .0006 + scrollImpulse;
      const streaking = arrival > .08 || scrollImpulse > .00004;
      scrollImpulse *= .88;
      offsetX += (targetX - offsetX) * .035;
      offsetY += (targetY - offsetY) * .035;
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
      const centerX = width * .43 + offsetX, centerY = height * .47 + offsetY;
      stars.forEach((star, index) => {
        const oldZ = star.z;
        star.z -= elapsed * speed;
        if (star.z <= .06) { stars[index] = createStar(true); return; }
        const x = star.x / star.z + centerX, y = star.y / star.z + centerY;
        if (x < -40 || x > width + 40 || y < -40 || y > height + 40) {
          stars[index] = createStar(true); return;
        }
        const opacity = Math.min(.55, .13 + (1 - star.z) * .34);
        const color = star.warm ? `rgba(245,210,139,${opacity})` : `rgba(211,221,235,${opacity})`;
        context.fillStyle = color;
        if (streaking && oldZ > star.z) {
          const lastX = star.x / oldZ + centerX, lastY = star.y / oldZ + centerY;
          context.strokeStyle = color;
          context.lineWidth = .6;
          context.beginPath(); context.moveTo(lastX, lastY); context.lineTo(x, y); context.stroke();
        }
        context.beginPath(); context.arc(x, y, Math.min(1.4, star.size / Math.sqrt(star.z)), 0, Math.PI * 2); context.fill();
      });
    };
    const tick = (now: number) => {
      if (document.hidden) { frame = 0; return; }
      if (now - previous >= 32) paint(now);
      frame = window.requestAnimationFrame(tick);
    };
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed = 2026;
      stars = Array.from({ length: width < 700 ? 85 : 180 }, () => createStar());
      paint(performance.now(), true);
    };
    const sync = () => {
      window.cancelAnimationFrame(frame); frame = 0;
      previous = performance.now();
      if (motion.matches) { targetX = 0; targetY = 0; paint(previous, true); }
      else if (!document.hidden) frame = window.requestAnimationFrame(tick);
    };
    const pointer = (event: PointerEvent) => {
      if (motion.matches || !finePointer.matches || event.pointerType !== "mouse") return;
      targetX = (event.clientX / width - .5) * 14;
      targetY = (event.clientY / height - .5) * 10;
    };
    const scroll = () => {
      const distance = Math.abs(window.scrollY - lastScroll);
      lastScroll = window.scrollY;
      if (!motion.matches) scrollImpulse = Math.min(.00016, scrollImpulse + distance * .0000005);
    };
    started = performance.now();
    resize(); sync();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  return <canvas ref={canvas} className={styles.starfield} aria-hidden="true" />;
}
