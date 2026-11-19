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
  sizes: string;
  width: number;
  height: number;
  className?: string;
};

/**
 * A real photo (<picture>, with alt text) under a canvas that draws it as ASCII. The canvas is
 * decoration only (aria-hidden); with no JS, or once developed, the photo is what shows.
 */
export function AsciiPhoto({ image, developed, duration = 1600, cell = 7, delay = 0, sizes, width, height, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(developed ? 1 : 0);
  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
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
  }, [developed, delay]);

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
      t = reduced ? goal : goal > t ? Math.min(goal, t + dt * rate) : Math.max(goal, t - dt * rate);
      draw(Math.floor(now / 60));
      if (t !== goal) raf = requestAnimationFrame(step);
      else raf = 0;
    }

    kick.current = () => {
      if (disposed || raf || !lines.length) return;
      last = 0;
      raf = requestAnimationFrame(step);
    };

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(box);
    Promise.all([loadImage(image.ascii), fontReady(family)]).then(
      ([img]) => {
        if (disposed) return;
        src = img;
        ready = true;
        layout();
        kick.current();
      },
      () => undefined, // no ASCII: the photo just shows
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      kick.current = () => undefined;
    };
  }, [image.ascii, duration, cell]);

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
