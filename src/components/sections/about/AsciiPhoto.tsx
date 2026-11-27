"use client";

import { useEffect, useRef } from "react";
import { fallbackSrc, srcSet, type AboutImage } from "@/lib/about";
import { asciiFamily, cellSize, createSampler, drawDeveloping, fontReady, loadImage, sample, thresholds, toRows } from "./ascii";
import styles from "./about.module.css";

const MAX_DPR = 2;
const GLARE = 0.82; // brightness above which a cell counts as blown out

/**
 * Blown-out areas (a projector screen, a window) would otherwise be a solid wall of the densest
 * glyph. Cells inside such an area, with blown-out neighbours on all four sides, drop to a light
 * mid-tone fill, so the area's edges still draw it and the inside stays airy.
 */
function softenGlare(lum: Float32Array, cols: number, rows: number) {
  const out = lum.slice();
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (lum[i] < GLARE) continue;
      if (lum[i - 1] >= GLARE && lum[i + 1] >= GLARE && lum[i - cols] >= GLARE && lum[i + cols] >= GLARE) {
        out[i] = 0.3 + 0.12 * ((r + c) % 2); // a faint checker, not a flat field
      }
    }
  }
  return out;
}

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
   * Scroll drives it instead of `developed`: read on every scroll, 1 = the photo, 0 = all ASCII.
   * It follows softly, so scrolling back up turns the ASCII back into the photo.
   */
  getLevel?: () => number;
  sizes: string;
  width: number;
  height: number;
  className?: string;
};

/**
 * A real photo (<picture>, with alt text) under a canvas that draws it as ASCII. The canvas is
 * decoration only (aria-hidden); with no JS, or once developed, the photo is what shows.
 */
export function AsciiPhoto({ image, developed, duration = 1600, cell = 7, delay = 0, getLevel, sizes, width, height, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(developed ? 1 : 0);
  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (getLevel) return;
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
  }, [developed, delay, getLevel]);

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
      lines = toRows(softenGlare(lum, cols, rows), cols, rows);
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

    // Scrubbed by the caller's level. Reduced motion keeps the photo.
    const scrubbing = !!getLevel && !reduced;
    if (getLevel && reduced) target.current = 1;
    function onScroll() {
      const goal = Math.min(1, Math.max(0, getLevel!()));
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
  }, [image.ascii, duration, cell, getLevel]);

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
