"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  HONEY,
  INK,
  asciiFamily,
  cellSize,
  clamp,
  createSampler,
  drawDeveloping,
  drawRows,
  fontReady,
  hash,
  loadImage,
  sample,
  scrambleArt,
  smooth,
  toRows,
} from "./ascii";
import { heroFrame } from "@/components/landing/heroHandoff";
import styles from "./about.module.css";

/**
 * "The page gets hacked." A tall track holds a sticky full-screen canvas (the CodeToRain pattern);
 * it is pinned right over the hero's own pinned meadow (see .section's --overlap), and its first
 * frame is a capture of that meadow at the end of the walk to the tree, so the hand-over is
 * seamless. Until then the canvas is empty and the hero shows through. Scroll then scrubs:
 *   0.15 - 0.45  glitch: sliced rows slide sideways, RGB channels split, scanlines
 *   0.45 - 0.70  the picture turns to ASCII, cells growing, colour draining to honey on ink
 *   0.70 - 1     characters scramble and clear from the centre while the title decrypts
 * Once clear, the canvas is transparent and the section's ASCII backdrop (AsciiField) shows through.
 * The heading and blurb are real DOM (children); their final state is what the server renders.
 */

const ANIM_VH = 2.25; // screens of scroll the sequence plays over
const TRACK_VH = 100 + ANIM_VH * 100;
// The sequence finishes this many screens before the pin lets go, so the stats (pulled up under the
// title by .body's negative margin) only ever slide in over a finished, still title.
const HOLD = 0.35;
const MAX_DPR = 1.5; // full-screen text every frame: 3x phones gain nothing past this
const FS_FROM = 10; // ASCII font size at the start of the ASCII beat (cells ~6x12 px)...
const FS_TO = 18; // ... and at its end (~11x22). Quantised to whole px so samples can be reused.
const LINE = 1.2; // row height, in font sizes: a little air between rows so they read as text, not scanlines
const MAX_SHIFT = 40; // px a glitched slice slides at most
// glitch bars: honey and meadow tones, see-through, so they read as interference rather than holes
const BARS = ["rgba(245,184,61,0.6)", "rgba(126,176,92,0.6)", "rgba(215,238,248,0.6)", "rgba(201,138,11,0.6)"];
const SLICES = 16;

const POSTERS = [
  { min: 1024, src: "/path/poster.webp" },
  { min: 768, src: "/path/poster-tablet.webp" },
  { min: 0, src: "/path/poster-phone.webp" },
];

export function HackTransition({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const cv = canvasRef.current;
    const content = contentRef.current;
    const stage = cv?.parentElement;
    const ctx = cv?.getContext("2d");
    if (!track || !cv || !content || !stage || !ctx) return;

    const titles = [...content.querySelectorAll<HTMLElement>("[data-hack-title]")].map((el) => {
      const text = el.textContent ?? "";
      // left to right lock order, with a little jitter so it doesn't wipe like a ruler
      const lines = text.split("\n");
      const width = Math.max(1, ...lines.map((l) => l.length));
      const order = new Float32Array(text.length);
      let col = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "\n") col = 0;
        else order[i] = 0.12 + 0.72 * (col++ / width) + 0.14 * hash(i * 2.3);
      }
      return { el, text, order, shown: "\u0000" }; // nothing set yet
    });
    const afters = [...content.querySelectorAll<HTMLElement>("[data-hack-after]")];

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function setText(p: number, tick: number) {
      const t = smooth(0.73, 0.97, p);
      for (const title of titles) {
        const next = p < 0.71 ? "" : scrambleArt(title.text, t, tick, title.order);
        if (next !== title.shown) {
          title.shown = next;
          title.el.textContent = next || title.text;
          title.el.style.visibility = next ? "" : "hidden";
        }
      }
      const a = smooth(0.9, 0.995, p).toFixed(3);
      for (const el of afters) if (el.style.opacity !== a) el.style.opacity = a;
      // the ink pool behind the text only belongs once the picture has cleared
      const halo = smooth(0.7, 0.86, p).toFixed(3);
      if (content!.style.getPropertyValue("--halo") !== halo) content!.style.setProperty("--halo", halo);
    }

    if (reduced) {
      // Straight to the final state: no canvas, title and copy as rendered.
      return;
    }

    const family = asciiFamily(stage);
    const sampler = createSampler();
    const glyphs = document.createElement("canvas"); // white glyphs, then tinted by the picture
    const gctx = glyphs.getContext("2d")!;
    const base = document.createElement("canvas"); // the poster, cover-fitted to the stage
    const chan = [0, 1, 2].map(() => document.createElement("canvas")); // its R, G and B on their own
    const scan = document.createElement("canvas");
    scan.width = 1;
    scan.height = 3;
    const sctx = scan.getContext("2d")!;
    sctx.fillStyle = "rgba(0,0,0,0.55)";
    sctx.fillRect(0, 0, 1, 1);
    const scanPattern = ctx.createPattern(scan, "repeat");

    let W = 0, H = 0, dpr = 1, bs = 1; // stage size (CSS px), device scale, base canvas scale
    let poster: HTMLImageElement | null = null; // fallback when the live meadow can't be read
    let shot: HTMLCanvasElement | null = null; // the hero's last frame, captured as the hack begins
    let armed = true; // capture again the next time the hack starts from the top
    let failed = false; // nothing to hack (no picture): show the finished title and stop drawing
    const picture = () => shot ?? poster;
    let posterSrc = "";
    let fontOk = false;
    // the current ASCII grid, rebuilt only when the font size changes
    let gridFs = 0, cols = 0, rows = 0, cw = 0, ch = 0;
    let lines: string[] = [];
    let clearOrder = new Float32Array(0);

    let sp = -1; // smoothed progress
    let last = performance.now();
    let raf = 0;
    let running = false;
    let drawn = "";

    // The hero's WebGL meadow, as it looks right now. Null if it isn't there or reads back blank.
    function captureHero() {
      let gl: HTMLCanvasElement | null = null;
      try {
        gl = heroFrame.capture?.() ?? null;
      } catch {
        gl = null;
      }
      if (!gl || !gl.width || !gl.height) return null;
      const probe = document.createElement("canvas");
      probe.width = probe.height = 8;
      const pctx = probe.getContext("2d", { willReadFrequently: true })!;
      try {
        pctx.drawImage(gl, 0, 0, 8, 8);
        const d = pctx.getImageData(0, 0, 8, 8).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        if (sum < 64 * 30) return null; // black: the scene hasn't drawn yet
        return gl;
      } catch {
        return null;
      }
    }

    function buildBase() {
      const poster = picture();
      if (!poster || !W) return;
      bs = Math.min(1, 1100 / W);
      const bw = Math.round(W * bs), bh = Math.round(H * bs);
      base.width = bw;
      base.height = bh;
      const b = base.getContext("2d", { willReadFrequently: true })!;
      const scale = Math.max(bw / poster.width, bh / poster.height);
      const dw = poster.width * scale, dh = poster.height * scale;
      b.drawImage(poster, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
      const src = b.getImageData(0, 0, bw, bh);
      chan.forEach((c, k) => {
        c.width = bw;
        c.height = bh;
        const out = new ImageData(bw, bh);
        const d = out.data, s = src.data;
        for (let p = 0; p < d.length; p += 4) {
          d[p + k] = s[p + k];
          d[p + 3] = 255;
        }
        c.getContext("2d")!.putImageData(out, 0, 0);
      });
      gridFs = 0;
      drawn = "";
    }

    function layout() {
      W = stage!.clientWidth;
      H = stage!.clientHeight;
      if (!W || !H) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      cv!.width = Math.round(W * dpr);
      cv!.height = Math.round(H * dpr);
      glyphs.width = cv!.width;
      glyphs.height = cv!.height;
      const want = POSTERS.find((p) => W >= p.min)!.src;
      if (want !== posterSrc) {
        posterSrc = want;
        loadImage(want).then((img) => {
          if (posterSrc !== want) return;
          poster = img;
          buildBase();
        }, () => {
          // No picture to hack: show the finished state rather than a hidden title.
          if (shot) return;
          failed = true;
          setText(1, 0);
          cv!.style.display = "none";
        });
      } else {
        buildBase();
      }
      drawn = "";
    }

    function grid(fs: number) {
      if (fs === gridFs || !picture()) return;
      gridFs = fs;
      ({ cw, ch } = cellSize(ctx!, family, fs, LINE));
      cols = Math.ceil(W / cw);
      rows = Math.ceil(H / ch);
      const lum = sample(sampler, base, cols, rows, cw, ch, { equalize: true, gamma: 1.5, contrast: 0.95 });
      lines = toRows(lum, cols, rows, undefined, lines);
      if (fs === FS_TO) {
        // clears from the centre outwards, ragged
        clearOrder = new Float32Array(cols * rows);
        const cx = W / 2, cy = H * 0.45, far = Math.hypot(W / 2, H * 0.55);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const d = Math.hypot((c + 0.5) * cw - cx, (r + 0.5) * ch - cy) / far;
            clearOrder[r * cols + c] = 0.08 + 0.7 * d + 0.22 * hash(r * 131 + c);
          }
        }
      }
    }

    function drawPicture(g: number, step: number) {
      const c = ctx!;
      if (g <= 0.001) {
        c.drawImage(base, 0, 0, W, H);
        return;
      }
      // the glitch comes in bursts: some scroll steps hit hard, others barely
      const burst = hash(step * 3.7) > 0.55 ? 1 : 0.3 + 0.3 * hash(step * 9.1);
      const G = g * burst;
      c.fillStyle = "#000";
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "lighter";
      const split = G * (6 + 16 * hash(step * 1.3));
      let y = 0;
      for (let i = 0; i < SLICES && y < H; i++) {
        const h = i === SLICES - 1 ? H - y : H * (0.02 + 0.1 * hash(step * 17 + i * 5.3));
        const moved = hash(step * 7 + i * 2.1) < G * 0.75;
        const dx = moved ? (hash(step * 31 + i) - 0.5) * 2 * MAX_SHIFT * G : 0;
        const sy = y * bs, sh = Math.max(1, h * bs);
        // each channel also wraps round from the far side, so a shifted slice never leaves a black gap
        [dx - split, dx, dx + split].forEach((x, k) => {
          c.drawImage(chan[k], 0, sy, base.width, sh, x, y, W, h);
          if (Math.abs(x) > 0.5) c.drawImage(chan[k], 0, sy, base.width, sh, x - Math.sign(x) * W, y, W, h);
        });
        y += h;
      }
      c.globalCompositeOperation = "source-over";
      if (scanPattern) {
        c.globalAlpha = 0.25 + 0.5 * G;
        c.fillStyle = scanPattern;
        c.fillRect(0, 0, W, H);
        c.globalAlpha = 1;
      }
      // a few dead blocks
      const blocks = Math.floor(G * 7);
      for (let i = 0; i < blocks; i++) {
        c.fillStyle = BARS[Math.floor(hash(step + i * 4.4) * BARS.length)];
        c.fillRect(hash(step * 2 + i) * W, hash(step * 5 + i * 3) * H, W * (0.03 + 0.2 * hash(i + step)), 2 + 10 * hash(i * 7 + step));
      }
    }

    // Glyphs tinted by the picture under them, then washed toward honey.
    function drawAscii(alpha: number, drain: number) {
      const g = gctx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, W, H);
      g.font = `${gridFs}px ${family}`;
      g.fillStyle = "#fff";
      drawRows(g, lines, 0, 0, ch);
      g.globalCompositeOperation = "source-in";
      g.imageSmoothingEnabled = false;
      g.drawImage(sampler.canvas, 0, 0, cols * cw, rows * ch);
      if (drain > 0) {
        g.globalCompositeOperation = "source-atop";
        g.globalAlpha = drain;
        g.fillStyle = HONEY;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = "source-over";
      const c = ctx!;
      c.globalAlpha = alpha;
      c.fillStyle = INK;
      c.fillRect(0, 0, W, H);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(glyphs, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalAlpha = 1;
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (failed || !running || !W || !fontOk) return;

      const top = track!.getBoundingClientRect().top;
      const target = clamp(-top / ((ANIM_VH - HOLD) * window.innerHeight));
      if (target <= 0) {
        // The hero is still walking to the tree: stay clear and let it show through.
        sp = 0;
        armed = true;
        if (drawn !== "idle") {
          drawn = "idle";
          setText(0, 0);
          ctx!.setTransform(1, 0, 0, 1, 0, 0);
          ctx!.clearRect(0, 0, cv!.width, cv!.height);
        }
        return;
      }
      if (armed) {
        // The hero has just let go: take its final frame as the picture that gets hacked.
        armed = false;
        const next = captureHero();
        if (next) {
          shot = next;
          buildBase();
        }
      }
      if (!picture()) return;
      sp = sp <= 0 || Math.abs(target - sp) < 1e-4 ? target : sp + (target - sp) * Math.min(1, dt * 12);
      // The sequence used to open on the meadow held still (0 to 0.15). It now starts glitching
      // straight away, since the hero itself has just been that still picture.
      const p = 0.15 + 0.85 * sp;
      const step = Math.floor(p * 140); // glitch pattern changes every 1/140th of the track
      const tick = Math.floor(now / 70); // scramble rate while characters are still settling
      const settling = p > 0.7 && p < 0.999;
      const state = `${p.toFixed(4)}|${settling ? tick : 0}`;
      if (state === drawn) return;
      drawn = state;

      setText(p, tick);
      const c = ctx!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (p >= 0.999) {
        c.clearRect(0, 0, W, H);
        return;
      }
      const glitch = smooth(0.15, 0.3, p) * (1 - smooth(0.52, 0.62, p));
      const asciiIn = smooth(0.45, 0.56, p);

      if (p < 0.7) {
        if (asciiIn < 1) drawPicture(glitch, step);
        if (asciiIn > 0) {
          const fs = Math.round(FS_FROM + (FS_TO - FS_FROM) * smooth(0.45, 0.7, p));
          grid(fs);
          drawAscii(asciiIn, smooth(0.5, 0.68, p));
        }
        return;
      }

      // scramble and clear from the centre; the canvas goes transparent where cells clear
      grid(FS_TO);
      c.font = `${FS_TO}px ${family}`;
      drawDeveloping(c, lines, cols, cw, ch, clearOrder, smooth(0.7, 0.98, p) * 1.05, {
        ink: INK,
        glyph: HONEY,
        flicker: 0.14,
        frame: tick,
      });
    }

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(stage);
    const visibility = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      if (running) drawn = "";
    });
    visibility.observe(track);

    // Before the first frame (and before the hero has scrolled away) the title and copy wait hidden.
    setText(0, 0);
    layout();
    const fontDone = () => {
      fontOk = true; // a font that never arrives falls back to the system monospace
      gridFs = 0;
      drawn = "";
    };
    fontReady(family).then(fontDone, fontDone);
    const fontTimeout = window.setTimeout(() => {
      if (!fontOk) fontDone();
    }, 3000);
    raf = requestAnimationFrame(frame);

    return () => {
      window.clearTimeout(fontTimeout);
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      for (const title of titles) {
        title.el.textContent = title.text;
        title.el.style.visibility = "";
      }
      for (const el of afters) el.style.opacity = "";
      content.style.removeProperty("--halo");
    };
  }, []);

  return (
    <div ref={trackRef} className={styles.hackTrack} style={{ "--track-vh": TRACK_VH } as CSSProperties}>
      <div className={styles.hackStage}>
        <canvas ref={canvasRef} className={styles.hackCanvas} aria-hidden="true" />
        <div ref={contentRef} className={styles.hackContent}>
          {children}
        </div>
      </div>
    </div>
  );
}
