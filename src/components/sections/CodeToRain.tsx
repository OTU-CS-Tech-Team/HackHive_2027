"use client";

import { useEffect, useRef } from "react";
import styles from "./SpeakersSection.module.css";

/**
 * Scroll-driven "code -> bulge -> glass shatter" sequence. When the shatter is done the stage is
 * faded out, revealing the judges section (with its gavel rain) underneath.
 * A tall track holds a sticky full-screen canvas; scroll progress through the
 * track scrubs the animation, the page itself never shifts while it plays.
 */

const CODE = `#include <iostream>
#include <vector>
#include "screen_size.h"
#include <string>

namespace SysCore {
  struct DisplayProps {
    int current_w;
    int current_h;
    double intensity;
  };

  void process_frame_buffer(DisplayProps& dp) {
    dp.current_w = static_cast<int>(screen_size.width);
    dp.current_h = static_cast<int>(screen_size.height);
    size_t total_px = dp.current_w * dp.current_h;
    char* fb = new char[total_px];
    if (!fb) return;
    std::memset(fb, 0, total_px);

    for (int i = 0; i < dp.current_h; ++i) {
      char* row = fb + (i * dp.current_w);
      for (int j = 0; j < dp.current_w; ++j) {
        if ((i * j) % 11 == 0) row[j] = 0x0A;
        if ((i | j) % 17 == 0) row[j] = 0x60;
      }
    }
    for (int k = 0; k < total_px; k += 1024) {
      fb[k] = (char)((k >> 4) & 0xFF);
    }
    delete[] fb;
  }

  bool init_and_render() {
    DisplayProps dp;
    process_frame_buffer(dp);
    bool status = (dp.current_w > 0 && dp.current_h > 0);
    return status;
  }
}`.split("\n");

const TYPE_END = 0.16; // scroll progress by which the code is fully typed, however slowly it's scrolled
const TYPE_MS = 1600; // ... though it types itself in this long once the stage is in view, no scrolling needed
const BULGE_START = 0.1; // scroll progress where the box starts to swell
const EXPLODE_AT = 0.42; // scroll progress where the shatter starts
const EXPLODE_LEN = 0.36; // scroll the outward travel spans (x ANIM_VH screens). Bigger = slower
const FADE_LEN = 0.08; // extra scroll after the travel before the shards are gone
const SLIDE_START = EXPLODE_AT + EXPLODE_LEN * 0.55; // judges section starts sliding up here
const FADE_START = EXPLODE_AT + EXPLODE_LEN * 0.7; // shards begin fading here
const FADE_END = EXPLODE_AT + EXPLODE_LEN + FADE_LEN; // fully gone, judges section cuts in
const ORIGIN_Y = 0.75; // bulge/explosion origin down the text block: 0 = top, 0.5 = middle, 1 = bottom
const GROUP_MIN = 3; // characters per flying chunk of text (min)
const GROUP_MAX = 5; // ... and max. Bigger groups = fewer draw calls = less lag, chunkier look
const ANIM_VH = 1.8; // scroll distance (in screen heights) the whole sequence is scrubbed over
const MAX_DPR = 2; // canvas resolution cap: the glows cost per pixel, and 3x phone screens gain little past 2x
// Blurs (canvas shadowBlur) are what made this lag, one per shard and per chunk of code every frame. Now each
// frame blurs at most once: the shards' outlines are stroked as one path, and the code's glow is blurred once
// into a sprite sheet and stamped on.
const GLOW_REACH = 24; // how far a chunk's glow spreads past its text, px
const GLOW_BLUR = 16; // the glow's blur, baked into the sheet at full strength
const GLOW_FULL = 24; // the old shadowBlur (d * 10 + e * 14) that counts as full strength
const GLOW_RES = 0.5; // the sheet's resolution: it's all blur, so half size loses nothing
// The track: one pinned screen, plus the scroll the sequence plays over, ending right as the shards are gone.
const TRACK_VH = 100 + ANIM_VH * FADE_END * 100;
const MONO = "ui-monospace,Menlo,Consolas,monospace";

const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a: number, b: number, x: number) => {
  const t = cl((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// A few neighbouring characters that fly as one piece (one draw call instead of 3-5).
type Group = { text: string; start: number; len: number; gx: number; gy: number; r: number; sh: number; s: number; s2: number };
type Glyph = { ch: string; x: number; y: number; r: number; s: number; s2: number };
type Pt = [number, number];
type Chunk = { pts: Pt[]; ccx: number; ccy: number; s: number; s2: number };
// Where a group's glow sits in the sprite sheet, in sheet px at full size.
type Sprite = { sx: number; sy: number; w: number; h: number };


export function CodeToRain() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const cv = canvasRef.current;
    const stage = cv?.parentElement;
    const hint = hintRef.current;
    const ctx = cv?.getContext("2d");
    const host = track?.parentElement; // wrapper that also contains the judges section
    if (!track || !cv || !stage || !ctx || !host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- terminal / shatter state ----
    let W = 0, H = 0, dpr = 1;
    let fs = 14, lh = 20, cw = 8, bx = 0, by = 0, bw = 0, pad = 0;
    let cx = 0, cy = 0, diag = 0, hFull = 0;
    let glyphs: Glyph[] = [];
    let groups: Group[] = [];
    let chunks: Chunk[] = [];
    let sprites: Sprite[] = [];
    const sheet = document.createElement("canvas");

    let sp = 0; // smoothed scroll progress
    let auto = 0; // how far the code has typed itself, 0..1
    let lastTop: number | null = null; // previous frame's track top, to tell scroll direction
    let held = false; // true after scrolling up: no self-typing until the next downward scroll
    let last = performance.now();
    let raf = 0;
    let running = true;
    // What was last drawn, so a frame where none of it has changed can be skipped.
    let drawn = "";
    let judgesIn = "";
    let hintOn: boolean | null = null;

    // Bulge: slight swell around the container's middle point.
    function warp(x: number, y: number, d: number, j1: number, j2: number) {
      let dx = x - cx, dy = y - cy;
      const nr = (Math.hypot(dx, dy) || 1) / (bw * 0.5);
      let s = 1, rot = 0;
      if (d > 0) {
        const f = Math.exp(-nr * nr * 0.5);
        const k = 1 + d * 0.14 * f;
        const sw = d * 0.06 * f;
        const cs = Math.cos(sw), sn = Math.sin(sw);
        const rx = dx * k, ry = dy * k;
        dx = rx * cs - ry * sn;
        dy = rx * sn + ry * cs;
        s = 1 + d * 0.05 * f;
        rot = sw + d * (j1 - 0.5) * 0.04;
        dx += (j1 - 0.5) * d * 1.5;
        dy += (j2 - 0.5) * d * 1.5;
      }
      return [dx, dy, s, rot] as const;
    }

    // Glass shards: jittered grid, each cell split into two triangles.
    function makeChunks() {
      const gx = 9, gy = 6;
      const V: Pt[][] = [];
      for (let j = 0; j <= gy; j++) {
        V.push([]);
        for (let i = 0; i <= gx; i++) {
          let x = bx + (bw * i) / gx;
          let y = by + (hFull * j) / gy;
          if (i > 0 && i < gx) x += (hash(i * 7 + j * 13) - 0.5) * (bw / gx) * 0.95;
          if (j > 0 && j < gy) y += (hash(i * 11 + j * 5 + 50) - 0.5) * (hFull / gy) * 0.95;
          V[j].push([x, y]);
        }
      }
      chunks = [];
      for (let j = 0; j < gy; j++) {
        for (let i = 0; i < gx; i++) {
          const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i];
          const tris: Pt[][] =
            hash(i + j * 9) > 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
          for (const t of tris) {
            const pts: Pt[] = [];
            for (let k = 0; k < 3; k++) {
              const p = t[k], q = t[(k + 1) % 3];
              for (let s = 0; s < 6; s++) {
                pts.push([p[0] + ((q[0] - p[0]) * s) / 6, p[1] + ((q[1] - p[1]) * s) / 6]);
              }
            }
            const id = chunks.length;
            chunks.push({
              pts,
              ccx: (t[0][0] + t[1][0] + t[2][0]) / 3,
              ccy: (t[0][1] + t[1][1] + t[2][1]) / 3,
              s: hash(id + 3),
              s2: hash(id + 17),
            });
          }
        }
      }
    }

    function layout() {
      W = stage!.clientWidth;
      H = stage!.clientHeight;
      if (!W || !H) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      drawn = "";
      cv!.width = W * dpr;
      cv!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const maxc = Math.max(...CODE.map((l) => l.length));
      bw = Math.min(W * 0.86, 960);
      pad = Math.max(12, bw * 0.03);
      fs = Math.min(15, (bw - pad * 2) / (maxc * 0.6));
      lh = fs * 1.45;
      const maxh = H * 0.88 - pad * 2;
      if (CODE.length * lh > maxh) {
        lh = maxh / CODE.length;
        fs = Math.min(fs, lh / 1.2);
      }
      ctx!.font = `${fs}px ${MONO}`;
      cw = ctx!.measureText("M").width;
      bx = (W - bw) / 2;
      by = H * 0.06;

      glyphs = [];
      let id = 0;
      CODE.forEach((line, r) => {
        for (let c = 0; c < line.length; c++) {
          if (line[c] !== " ") {
            glyphs.push({
              ch: line[c],
              x: bx + pad + c * cw,
              y: by + pad + r * lh + fs,
              r,
              s: hash(id + 1),
              s2: hash(id + 7),
            });
          }
          id++;
        }
      });

      // Chunk neighbouring characters (same row, touching) into groups of GROUP_MIN..GROUP_MAX.
      groups = [];
      for (let i = 0; i < glyphs.length; ) {
        const first = glyphs[i];
        const size = GROUP_MIN + Math.floor(hash(groups.length * 3 + 5) * (GROUP_MAX - GROUP_MIN + 1));
        let len = 1;
        while (
          len < size &&
          i + len < glyphs.length &&
          glyphs[i + len].r === first.r &&
          Math.abs(glyphs[i + len].x - (first.x + len * cw)) < 0.5
        ) {
          len++;
        }
        let text = "";
        for (let k = 0; k < len; k++) text += glyphs[i + k].ch;
        groups.push({
          text,
          start: i,
          len,
          gx: first.x + (len * cw) / 2, // centre of the chunk: it swells, spins and flies around this
          gy: first.y,
          r: first.r,
          sh: 0.75 + 0.25 * hash(first.r * 3.3),
          s: hash(groups.length + 1),
          s2: hash(groups.length + 7),
        });
        i += len;
      }

      // Each group's glow, blurred once into one sheet (shadow drawn, then the text itself knocked back
      // out so only the glow is left), for frames to stamp on.
      const sheetW = 2048;
      let sx = 0, sy = 0, rowH = 0;
      sprites = groups.map((g) => {
        const w = g.len * cw + GLOW_REACH * 2, h = fs * 1.35 + GLOW_REACH * 2;
        if (sx + w > sheetW) { sx = 0; sy += rowH; rowH = 0; }
        const sprite = { sx, sy, w, h };
        sx += w;
        rowH = Math.max(rowH, h);
        return sprite;
      });
      sheet.width = Math.ceil(sheetW * GLOW_RES);
      sheet.height = Math.ceil((sy + rowH) * GLOW_RES);
      const sc = sheet.getContext("2d")!;
      sc.setTransform(GLOW_RES, 0, 0, GLOW_RES, 0, 0);
      sc.font = `${fs}px ${MONO}`;
      sc.fillStyle = "#64ff96";
      sc.shadowColor = "rgba(100,255,150,.8)";
      sc.shadowBlur = GLOW_BLUR * GLOW_RES; // shadows ignore the transform, so it's scaled by hand
      groups.forEach((g, k) => sc.fillText(g.text, sprites[k].sx + GLOW_REACH, sprites[k].sy + GLOW_REACH + fs));
      sc.shadowBlur = 0;
      sc.globalCompositeOperation = "destination-out";
      groups.forEach((g, k) => sc.fillText(g.text, sprites[k].sx + GLOW_REACH, sprites[k].sy + GLOW_REACH + fs));

      hFull = cl(pad * 2 + CODE.length * lh + fs * 0.4, H * 0.3, H * 0.92);
      // origin for the bulge and the explosion: horizontal centre, lower part of the text
      cx = W / 3;
      cy = by + hFull * ORIGIN_Y;
      diag = Math.hypot(W, H);
      makeChunks();
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000;
      last = now;
      if (!running || !W) return;

      // Absolute scroll distance, so the track can end right after the reveal
      // without squashing the animation.
      const top = track!.getBoundingClientRect().top;
      const target = cl(-top / (ANIM_VH * window.innerHeight));
      sp = reduced ? target : Math.abs(target - sp) < 1e-4 ? target : sp + (target - sp) * Math.min(1, dt * 10);
      const p = sp;
      // The code types itself once most of the stage is in view, and starts over if scrolled back above it.
      const vh = window.innerHeight;
      const dTop = lastTop === null ? 0 : top - lastTop; // > 0: scrolling up, < 0: scrolling down
      lastTop = top;
      if (dTop > 0.5) held = true;
      else if (dTop < -0.5) held = false;

      if (top > vh) {
        auto = 0;
      } else if (reduced) {
        if (top < vh * 0.35) auto = 1;
      } else if (dTop > 0.5 && top > 0) {
        // scrolling back up toward the start: un-type in step with the scroll
        auto = cl(auto - dTop / (vh * 0.5));
      } else if (top < vh * 0.35 && !held) {
        auto = cl(auto + (dt * 1000) / TYPE_MS);
      }
      const typeP = Math.max(cl(p / TYPE_END), auto);
      const blink = typeP < 1 && Math.floor(now / 450) % 2;
      // Nothing to redraw: same scroll, same typing, same cursor.
      const state = `${p}|${typeP}|${blink}`;
      if (state === drawn) return;
      drawn = state;

      ctx!.clearRect(0, 0, W, H);
      ctx!.fillStyle = "#0a1207";
      ctx!.fillRect(0, 0, W, H);
      const showHint = p < 0.02;
      if (hint && showHint !== hintOn) {
        hintOn = showHint;
        hint.style.opacity = showHint ? "0.7" : "0";
      }

      const d = ss(BULGE_START, EXPLODE_AT, p); // bulge amount
      const e = cl((p - EXPLODE_AT) / EXPLODE_LEN); // outward travel, scroll driven
      const ee = 1 - Math.pow(1 - e, 1.8); // burst, then slows
      const fade = 1 - ss(FADE_START, FADE_END, p); // shards and code fade out near the end
      // The judges section (with its own gavel rain) slides up over the pinned stage and fades in.
      // 0 = parked one screen below, 1 = in place. CSS on the section reads --judges-in.
      const slide = (reduced ? (p >= FADE_END ? 1 : 0) : ss(SLIDE_START, FADE_END, p)).toFixed(4);
      // Only when it moves: every change restyles the whole judges section.
      if (slide !== judgesIn) {
        judgesIn = slide;
        host!.style.setProperty("--judges-in", slide);
      }
      const reveal = p >= FADE_END ? 1 : 0; // shards are gone: stop drawing them
      const total = glyphs.length;
      const shown = Math.floor(typeP * total);

      // ---- container: bulging box, then glass shards ----
      if (reveal < 1) {
        if (shown < total) {
          const lastRow = shown ? glyphs[shown - 1].r + 1 : 1;
          const h = cl(pad * 2 + lastRow * lh + fs * 0.4, H * 0.3, hFull);
          const N = 28;
          const P: Pt[] = [];
          for (let i = 0; i < N; i++) P.push([bx + (bw * i) / N, by]);
          for (let i = 0; i < N; i++) P.push([bx + bw, by + (h * i) / N]);
          for (let i = 0; i < N; i++) P.push([bx + bw * (1 - i / N), by + h]);
          for (let i = 0; i < N; i++) P.push([bx, by + h * (1 - i / N)]);
          ctx!.beginPath();
          P.forEach((q, i) => {
            const w = warp(q[0], q[1], d, 0.5, 0.5);
            if (i) ctx!.lineTo(cx + w[0], cy + w[1]);
            else ctx!.moveTo(cx + w[0], cy + w[1]);
          });
          ctx!.closePath();
          ctx!.fillStyle = "#090a03";
          ctx!.fill();
          ctx!.shadowColor = `rgba(80,255,140,${0.2 + d * 0.6})`;
          ctx!.shadowBlur = 14 + d * 40;
          ctx!.strokeStyle = `rgba(125,255,160,${0.35 + d * 0.4})`;
          ctx!.lineWidth = 2;
          ctx!.stroke();
          ctx!.shadowBlur = 0;
        } else {
          // Each shard is placed (moved, spun and tumbled) here rather than with a canvas transform, so all
          // their outlines can go in one path: filled one by one as before, then stroked once, glow and all,
          // so the glow is one blur per frame instead of one per shard.
          const outline = new Path2D();
          ctx!.globalAlpha = fade;
          ctx!.fillStyle = e > 0 ? `rgba(16,70,38,${0.25 + e * 0.35})` : "#090a03";
          for (const c of chunks) {
            const wc = warp(c.ccx, c.ccy, d, 0.5, 0.5);
            const ang = Math.atan2(wc[1], wc[0]) + (c.s - 0.5) * 0.5;
            const spd = (0.12 + c.s2 * 0.38) * diag * ee; // stays on screen
            const tx = cx + wc[0] + Math.cos(ang) * spd, ty = cy + wc[1] + Math.sin(ang) * spd;
            const turn = (c.s - 0.5) * 3 * ee, cr = Math.cos(turn), sr = Math.sin(turn);
            const tumble = Math.cos((c.s2 - 0.3) * 9 * ee); // edge-on tumble
            const shard = new Path2D();
            c.pts.forEach((q, i) => {
              const w = warp(q[0], q[1], d, 0.5, 0.5);
              const lx = (w[0] - wc[0]) * tumble, ly = w[1] - wc[1];
              const X = tx + lx * cr - ly * sr, Y = ty + lx * sr + ly * cr;
              if (i) shard.lineTo(X, Y);
              else shard.moveTo(X, Y);
            });
            shard.closePath();
            ctx!.fill(shard);
            outline.addPath(shard);
          }
          ctx!.shadowColor = "rgba(240, 255, 80, 0.9)";
          ctx!.shadowBlur = 10 + d * 30 + e * 10;
          ctx!.strokeStyle = `rgba(150,255,185,${0.3 + d * 0.3 + e * 0.4})`;
          ctx!.lineWidth = 1.5 + e * 1.5;
          ctx!.stroke(outline);
          ctx!.shadowBlur = 0;
          ctx!.globalAlpha = 1;
        }

        // ---- code text ----
        ctx!.font = `${fs}px ${MONO}`;
        ctx!.textBaseline = "alphabetic";
        const n = Math.min(shown, total);
        // The glow swells with the bulge and the burst, as the old blur did, stamped from the sheet.
        const glow = cl((d * 10 + e * 14) / GLOW_FULL) * fade;
        ctx!.globalAlpha = fade;
        for (let k = 0; k < groups.length; k++) {
          const g = groups[k];
          if (g.start >= n) break; // not typed yet
          let [dx, dy, s, rot] = warp(g.gx, g.gy, d, g.s, g.s2);
          if (e > 0) {
            const ang = Math.atan2(dy, dx) + (g.s - 0.5) * 0.7;
            const sp2 = (0.08 + g.s2 * 0.32) * diag; // stays on screen
            dx += Math.cos(ang) * sp2 * ee;
            dy += Math.sin(ang) * sp2 * ee;
            rot += (g.s - 0.5) * 14 * e;
            s *= 1 + e * 0.9;
          }
          const x = cx + dx, y = cy + dy;
          if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;
          const count = Math.min(g.len, n - g.start); // partly typed chunk
          ctx!.save();
          ctx!.translate(x, y);
          ctx!.rotate(rot);
          ctx!.scale(s, s);
          if (glow > 0.02 && count === g.len) {
            const sprite = sprites[k];
            ctx!.globalAlpha = glow;
            ctx!.drawImage(sheet, sprite.sx * GLOW_RES, sprite.sy * GLOW_RES, sprite.w * GLOW_RES, sprite.h * GLOW_RES,
              (-g.len * cw) / 2 - GLOW_REACH, -fs - GLOW_REACH, sprite.w, sprite.h);
            ctx!.globalAlpha = fade;
          }
          ctx!.fillStyle = `rgb(${(110 * g.sh) | 0},${(255 * g.sh) | 0},${(150 * g.sh) | 0})`;
          ctx!.fillText(count === g.len ? g.text : g.text.slice(0, count), (-g.len * cw) / 2, 0);
          ctx!.restore();
        }
        ctx!.globalAlpha = 1;

        // typing cursor
        if (blink && shown > 0 && d < 0.05) {
          const o = glyphs[shown - 1];
          ctx!.fillStyle = "#e1ff7d";
          ctx!.fillRect(o.x + cw, o.y - fs * 0.85, cw * 0.8, fs);
        }
      }
    }

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(stage);
    const visibilityObserver = new IntersectionObserver((entries) => {
      running = entries[0].isIntersecting;
    });
    visibilityObserver.observe(track);

    layout();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  return (
    <div ref={trackRef} className={styles.codeRainTrack} style={{ height: `${TRACK_VH}vh` }}>
      <div className={styles.codeRainStage}>
        <canvas ref={canvasRef} className={styles.codeRainCanvas} aria-hidden="true" />
        <div ref={hintRef} className={styles.codeRainHint} aria-hidden="true">
          SCROLL ↓
        </div>
      </div>
    </div>
  );
}