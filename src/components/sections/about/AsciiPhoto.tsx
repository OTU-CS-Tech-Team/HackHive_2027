"use client";

import { useEffect, useRef } from "react";
import { fallbackSrc, srcSet, type AboutImage } from "@/lib/about";
import { asciiFamily, cellSize, createSampler, drawDeveloping, fontReady, loadImage, sample, thresholds, toRows } from "./ascii";
import styles from "./about.module.css";

const MAX_DPR = 2;

type Props = {
  image: AboutImage;
  /** false: ASCII glyphs on ink. true: the photo, fizzing in cell by cell. */
  developed: boolean;
  /** How long a full develop takes, ms. Going back to ASCII runs at the same rate. */
  duration?: number;
  /** Roughly how wide a character cell is, px. Fewer, bigger glyphs read better than many tiny ones. */
  cell?: number;
  /** Wait this long before developing, ms (to stagger a row of photos). */
  delay?: number;
  /**
   * Scroll drives it instead of `developed`: the real photo while the frame is low on the screen,
   * turning to ASCII as it rises past the middle, and back to the photo when scrolled back down.
   */
  scrub?: boolean;
  sizes: string;
  width: number;
  height: number;
  className?: string;
};

/**
 * A real photo (<picture>, with alt text) under a canvas that draws it as ASCII. The canvas is
 * decoration only (aria-hidden); with no JS, or once developed, the photo is what shows.
 */
export function AsciiPhoto({ image, developed, duration = 1600, cell = 7, delay = 0, scrub = false, sizes, width, height, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(developed ? 1 : 0);
  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (scrub) return;
    if (!developed || !delay) {
      target.current = developed ? 1 : 0;
      kick.current();
      return;
    }
    const id = window.setTimeout(() => {
      target.current = 1;
      kick.current();
    }, delay);
    return () => window.clearTimeout(id);
  }, [developed, delay, scrub]);

  useEffect(() => {
    const cv = canvasRef.current;
    const box = cv?.parentElement;
    const ctx = cv?.getContext("2d");
    if (!cv || !box || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const family = asciiFamily(box);
    const sampler = createSampler();

    let src: HTMLImageElement | null = null;
    let ready = false;
    let W = 0, H = 0, dpr = 1;
    let cols = 0, rows = 0, cw = 0, ch = 0, fs = 0;
    let lines: string[] = [];
    let thr = new Float32Array(0);
    let t = target.current;
    let raf = 0;
    let last = 0;
    let disposed = false;

    function layout() {
      W = box!.clientWidth;
      H = box!.clientHeight;
      if (!W || !H || !src || !ready) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      cv!.width = Math.round(W * dpr);
      cv!.height = Math.round(H * dpr);
      const probe = cellSize(ctx!, family, 10);
      fs = Math.max(6, (cell / probe.cw) * 10);
      ({ cw, ch } = cellSize(ctx!, family, fs, 1));
      cols = Math.ceil(W / cw);
      rows = Math.ceil(H / ch);
      const lum = sample(sampler, src, cols, rows, cw, ch, { contrast: 1.4, gamma: 0.95 });
      lines = toRows(lum, cols, rows);
      thr = thresholds(cols * rows, cols);
      draw(0);
    }

    function draw(frame: number) {
      if (!lines.length) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.font = `${fs}px ${family}`;
      // a cell's flicker band, so the very last cells still flash before they clear
      drawDeveloping(ctx!, lines, cols, cw, ch, thr, t * 1.1, { frame, flicker: 0.1 });
    }

    function step(now: number) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const goal = target.current;
      const rate = 1000 / duration;
      if (reduced) t = goal;
      else if (scrubbing) t = Math.abs(goal - t) < 0.002 ? goal : t + (goal - t) * Math.min(1, dt * 9); // follow the scroll, softly
      else t = goal > t ? Math.min(goal, t + dt * rate) : Math.max(goal, t - dt * rate);
      draw(Math.floor(now / 60));
      if (t !== goal) raf = requestAnimationFrame(step);
      else raf = 0;
    }

    kick.current = () => {
      if (disposed || raf || !lines.length) return;
      last = 0;
      raf = requestAnimationFrame(step);
    };

    // Scrubbed: 1 (photo) while the frame's centre is below 78% of the screen, 0 (ASCII) once it's above 38%.
    // Reduced motion keeps the photo.
    const scrubbing = scrub && !reduced;
    if (scrub && reduced) target.current = 1;
    function onScroll() {
      const r = box!.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const centre = (r.top + r.height / 2) / vh;
      const goal = Math.min(1, Math.max(0, (centre - 0.38) / 0.4));
      if (goal === target.current) return;
      target.current = goal;
      kick.current();
    }
    if (scrubbing) {
      target.current = 1;
      t = 1;
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(box);
    Promise.all([loadImage(image.ascii), fontReady(family)]).then(
      ([img]) => {
        if (disposed) return;
        src = img;
        ready = true;
        layout();
        if (scrubbing) onScroll();
        kick.current();
      },
      () => undefined, // no ASCII: the photo just shows
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      kick.current = () => undefined;
    };
  }, [image.ascii, duration, cell, scrub]);

  return (
    <span className={`${styles.asciiPhoto} ${className ?? ""}`}>
      <picture>
        <source type="image/avif" srcSet={srcSet(image, "avif")} sizes={sizes} />
        <source type="image/webp" srcSet={srcSet(image, "webp")} sizes={sizes} />
        <img src={fallbackSrc(image)} alt={image.alt} width={width} height={height} loading="lazy" decoding="async" />
      </picture>
      <canvas ref={canvasRef} aria-hidden="true" />
    </span>
  );
}
