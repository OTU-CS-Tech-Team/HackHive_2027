"use client";

import { useEffect, useRef } from "react";
import { asciiFamily, cellSize, charFor, clamp, createSampler, fontReady, hash, loadImage, sample, smooth } from "./ascii";
import styles from "./about.module.css";

/**
 * The section's backdrop: the hero meadow again, as faint honey ASCII on ink. One sticky,
 * screen-sized canvas sits behind the whole section and redraws on scroll. The meadow is tiled
 * (every other copy mirrored, so there's no seam) and drifts a little slower than the page.
 * Over the section's last screen or so the characters brighten and get denser, then thin out
 * and dissolve right where Sponsors' dawn begins.
 */

const PARALLAX = 0.82; // the field moves this fast relative to the page
const ALPHA = 0.11; // resting opacity of the glyphs
const JITTER = 0.16; // per-cell opacity knocked off at random (0..16%, so about +-8%): breaks up banding
const HEAT_MAX = 0.85; // the brightest the bottom gets, on the ramp, so it never becomes a wall of "@"
// Glyph colour down the section: honey, warming to a pale gold right at the bottom where the
// section's background has itself climbed to honey (see .section::after), so they meet the dawn.
const HONEY_RGB = [245, 184, 61];
const SUN_RGB = [255, 232, 170];
const MAX_DPR = 1.5;

export function AsciiField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = cv?.parentElement;
    const section = wrap?.parentElement;
    const ctx = cv?.getContext("2d");
    if (!cv || !wrap || !section || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parallax = reduced ? 1 : PARALLAX;
    const family = asciiFamily(section);
    const sampler = createSampler();
    const mask = document.createElement("canvas"); // one pixel per cell: how much of each glyph to knock back

    let src: HTMLImageElement | null = null;
    let W = 0, H = 0, dpr = 1, fs = 13, cw = 0, ch = 0, cols = 0, tile = 0;
    let lum = new Float32Array(0);
    let running = false;
    let raf = 0;
    let drawn = "";

    function layout() {
      W = cv!.clientWidth;
      H = cv!.clientHeight;
      if (!W || !H || !src) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      cv!.width = Math.round(W * dpr);
      cv!.height = Math.round(H * dpr);
      fs = W < 640 ? 12 : 16;
      ({ cw, ch } = cellSize(ctx!, family, fs, 1.2));
      cols = Math.ceil(W / cw) + 1;
      // one tile keeps the meadow's aspect
      tile = Math.max(8, Math.round((cols * cw * (src.height / src.width)) / ch));
      lum = sample(sampler, src, cols, tile, cw, ch, { contrast: 1.25, gamma: 1 }).slice();
      // stable per-cell jitter, as alpha in a cols x tile canvas stamped over the glyphs
      mask.width = cols;
      mask.height = tile;
      const mctx = mask.getContext("2d")!;
      const img = mctx.createImageData(cols, tile);
      for (let i = 0; i < cols * tile; i++) img.data[i * 4 + 3] = Math.round(255 * JITTER * hash(i * 0.37 + 5.1));
      mctx.putImageData(img, 0, 0);
      drawn = "";
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!running || !lum.length) return;
      const secRect = section!.getBoundingClientRect();
      const cvTop = cv!.getBoundingClientRect().top;
      const inSection = cvTop - secRect.top; // where the canvas's top edge sits, in section px
      const sectionH = secRect.height;
      const state = `${inSection.toFixed(1)}|${sectionH}|${W}`;
      if (state === drawn) return;
      drawn = state;

      const vh = H;
      const offset = inSection * parallax; // field px at the canvas's top edge
      const first = Math.floor(offset / ch);
      // starts below the "See all projects" line, so that text sits on the calm part
      const heatFrom = sectionH - vh * 0.75;
      const heatTo = sectionH - vh * 0.3;
      // over the last ~30vh the cells thin out as the background climbs to honey
      const goneFrom = sectionH - vh * 0.3;
      const goneTo = sectionH + vh * 0.05;
      const c = ctx!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      c.font = `${fs}px ${family}`;
      c.textBaseline = "top";
      for (let v = first; ; v++) {
        const y = v * ch - offset;
        if (y > H) break;
        const Y = inSection + y; // this row's place in the section
        const heat = smooth(heatFrom, heatTo, Y);
        const gone = smooth(goneFrom, goneTo, Y);
        const k = Math.floor(v / tile);
        const within = ((v % tile) + tile) % tile;
        const row = (k & 1 ? tile - 1 - within : within) * cols;
        let line = "";
        for (let x = 0; x < cols; x++) {
          const l = lum[row + x];
          if (gone > 0 && hash(x * 0.71 + v * 13.3) < gone) {
            line += " ";
            continue;
          }
          // denser toward the bottom: everything climbs the ramp, and the dark gaps fill in
          // brighter, but each cell keeps its own tone, so the bottom stays a texture rather than a wall
          line += charFor(Math.min(HEAT_MAX, clamp(l * (1 - 0.5 * heat) + heat * 0.4)));
        }
        const rgb = HONEY_RGB.map((h, i) => Math.round(h + (SUN_RGB[i] - h) * gone));
        c.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        c.globalAlpha = ALPHA + (0.72 - ALPHA) * heat;
        c.fillText(line, 0, y);
      }
      c.globalAlpha = 1;
      // knock each cell back by its own small amount (the mask follows the field, cell for cell)
      c.globalCompositeOperation = "destination-out";
      c.imageSmoothingEnabled = false;
      const period = tile * ch;
      for (let y = -(((offset % period) + period) % period); y < H; y += period) {
        c.drawImage(mask, 0, y, cols * cw, period);
      }
      c.globalCompositeOperation = "source-over";
    }

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(cv);
    const visibility = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      drawn = "";
    });
    visibility.observe(wrap);
    Promise.all([loadImage("/about/meadow-ascii.png"), fontReady(family)]).then(
      ([img]) => {
        src = img;
        layout();
      },
      () => undefined,
    );
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility.disconnect();
    };
  }, []);

  return (
    <div className={styles.field} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.fieldCanvas} />
    </div>
  );
}
