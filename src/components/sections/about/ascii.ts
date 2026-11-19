// Small ASCII-art engine for the About section. Everything here is plain canvas 2D:
// an image is drawn into an offscreen canvas at one pixel per character cell, read back,
// mapped through a luminance ramp, and drawn as one fillText per row.

/** Dark to light. A space is "no ink", so dark areas stay the background colour. */
export const RAMP = " .,:;-=+*x#%";
/** Only the brightest few percent get the heaviest glyph, so bright areas don't turn into walls of it. */
const TOP = "@";
const TOP_FROM = 0.97;
/** Characters a scrambling cell cycles through. */
export const NOISE = "!<>-_\\/[]{}=+*^?#%@$&;:01";
export const HONEY = "#f5b83d";
export const INK = "#14110b";

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Cheap deterministic hash in [0, 1). Same input, same output, so scrubbing back and forth is stable. */
export function hash(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** The ASCII face, from --font-ascii (set by next/font on the section). */
export function asciiFamily(el: Element) {
  const family = getComputedStyle(el).getPropertyValue("--font-ascii").trim();
  return family ? `${family}, ui-monospace, monospace` : "ui-monospace, Menlo, Consolas, monospace";
}

/** Resolves once the face can be drawn on a canvas (canvas text does not wait for webfonts). */
export function fontReady(family: string, size = 16) {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return document.fonts.load(`${size}px ${family}`).then(
    () => undefined,
    () => undefined,
  );
}

/** Width and height of one character cell at this size. Glyphs are roughly twice as tall as wide. */
export function cellSize(ctx: CanvasRenderingContext2D, family: string, size: number, lineHeight = 1) {
  ctx.font = `${size}px ${family}`;
  const w = ctx.measureText("MMMMMMMMMM").width / 10;
  return { cw: w || size * 0.5, ch: size * lineHeight };
}

/** A reusable offscreen canvas for sampling, so frames don't allocate. */
export type Sampler = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; lum: Float32Array };

export function createSampler(): Sampler {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return { canvas, ctx, lum: new Float32Array(0) };
}

/**
 * Draws `img` into the sampler at one pixel per cell, cover-fitted to a box of cols x rows cells
 * that are cw x ch px each (so the glyphs' tall aspect doesn't squash the picture). Leaves the
 * small colour image in sampler.canvas and returns luminance per cell in sampler.lum.
 * `contrast` > 1 steepens around mid-grey; `gamma` < 1 lifts shadows. `equalize` spreads the
 * picture's tones evenly over the ramp first (a bright picture would otherwise be a wall of "@").
 */
export function sample(
  s: Sampler,
  img: CanvasImageSource & { width: number; height: number },
  cols: number,
  rows: number,
  cw: number,
  ch: number,
  {
    contrast = 1.2,
    gamma = 0.9,
    focusY = 0.5,
    equalize = false,
  }: { contrast?: number; gamma?: number; focusY?: number; equalize?: boolean } = {},
) {
  if (s.canvas.width !== cols || s.canvas.height !== rows) {
    s.canvas.width = cols;
    s.canvas.height = rows;
  }
  if (s.lum.length !== cols * rows) s.lum = new Float32Array(cols * rows);
  const W = cols * cw;
  const H = rows * ch;
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) * focusY;
  s.ctx.imageSmoothingEnabled = true;
  s.ctx.imageSmoothingQuality = "high";
  s.ctx.clearRect(0, 0, cols, rows);
  s.ctx.drawImage(img, dx / cw, dy / ch, dw / cw, dh / ch);
  const data = s.ctx.getImageData(0, 0, cols, rows).data;
  const lum = s.lum;
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
  }
  if (equalize) {
    const hist = new Float32Array(256);
    for (let i = 0; i < lum.length; i++) hist[Math.round(lum[i] * 255)]++;
    const cdf = new Float32Array(256);
    for (let b = 0, run = 0; b < 256; b++) {
      cdf[b] = run + hist[b] / 2; // middle of this tone's share
      run += hist[b];
    }
    for (let i = 0; i < lum.length; i++) lum[i] = cdf[Math.round(lum[i] * 255)] / lum.length;
  }
  for (let i = 0; i < lum.length; i++) lum[i] = Math.pow(clamp((lum[i] - 0.5) * contrast + 0.5), gamma);
  return lum;
}

export function charFor(l: number, ramp = RAMP) {
  if (l >= TOP_FROM) return TOP;
  return ramp[Math.min(ramp.length - 1, Math.floor((l / TOP_FROM) * ramp.length))];
}

/** One string per row of cells. `out` is reused when given. */
export function toRows(lum: Float32Array, cols: number, rows: number, ramp = RAMP, out: string[] = []) {
  out.length = rows;
  for (let r = 0; r < rows; r++) {
    let line = "";
    const o = r * cols;
    for (let c = 0; c < cols; c++) line += charFor(lum[o + c], ramp);
    out[r] = line;
  }
  return out;
}

/** Draws rows top-down, one fillText each. Font and fill must already be set. */
export function drawRows(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, ch: number) {
  ctx.textBaseline = "top";
  for (let r = 0; r < rows.length; r++) ctx.fillText(rows[r], x, y + r * ch);
}

/** A random threshold per cell, for fizzing cells in or out one at a time instead of a uniform fade. */
export function thresholds(n: number, seed = 1) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = hash(i * 1.37 + seed * 91.3);
  return out;
}

/**
 * "Develops" an ASCII picture into the photo underneath: at t = 0 every cell is a glyph on ink,
 * at t = 1 every cell is clear (the canvas is transparent there and the real photo shows). Each
 * cell clears once t passes its own threshold, and flickers a noise glyph just before it does.
 * Clears the canvas first; ink is drawn as one rect per run of undeveloped cells.
 */
export function drawDeveloping(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  cols: number,
  cw: number,
  ch: number,
  thr: Float32Array,
  t: number,
  { ink = INK, glyph = HONEY, flicker = 0.08, frame = 0 }: { ink?: string; glyph?: string; flicker?: number; frame?: number } = {},
) {
  const W = cols * cw;
  ctx.clearRect(0, 0, W, rows.length * ch);
  if (t >= 1) return;
  ctx.fillStyle = ink;
  // ink behind the cells that are still glyphs
  for (let r = 0; r < rows.length; r++) {
    const o = r * cols;
    let run = -1;
    for (let c = 0; c <= cols; c++) {
      const live = c < cols && thr[o + c] >= t;
      if (live && run < 0) run = c;
      else if (!live && run >= 0) {
        // overlap by half a pixel so runs don't leave hairline seams
        ctx.fillRect(run * cw - 0.25, r * ch - 0.25, (c - run) * cw + 0.5, ch + 0.5);
        run = -1;
      }
    }
  }
  ctx.fillStyle = glyph;
  ctx.textBaseline = "top";
  if (t <= 0) flicker = 0; // at rest nothing fizzes
  for (let r = 0; r < rows.length; r++) {
    const o = r * cols;
    const src = rows[r];
    let line = "";
    for (let c = 0; c < cols; c++) {
      const th = thr[o + c];
      if (th < t) line += " ";
      else if (th < t + flicker) line += NOISE[Math.floor(hash(o + c + frame * 7.1) * NOISE.length)];
      else line += src[c];
    }
    ctx.fillText(line, 0, r * ch);
  }
}

/**
 * Decrypts `target` as t goes 0 -> 1: characters lock left to right, and the ones not yet locked
 * cycle through random digits/noise. Spaces and punctuation (like the comma in 1,200) never scramble.
 * `tick` changes which random glyph shows, so callers can cycle at their own rate.
 */
export function decrypt(target: string, t: number, tick: number, pool = "0123456789#%&@$") {
  if (t >= 1) return target;
  const n = target.length;
  let out = "";
  for (let i = 0; i < n; i++) {
    const ch = target[i];
    if (!/[0-9A-Za-z]/.test(ch)) {
      out += ch;
      continue;
    }
    // each character locks a little after the one before it
    const lockAt = (i + 1) / (n + 1) + 0.12 * (hash(i * 3.1) - 0.5);
    out += t >= lockAt ? ch : pool[Math.floor(hash(i * 13.7 + tick * 3.3) * pool.length)];
  }
  return out;
}

/** Same idea for a block of ASCII art: every non-space glyph scrambles until its own lock time. */
export function scrambleArt(target: string, t: number, tick: number, order: Float32Array) {
  if (t >= 1) return target;
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (ch === " " || ch === "\n") out += ch;
    else if (t >= order[i]) out += ch;
    else if (t < order[i] - 0.35) out += " ";
    else out += NOISE[Math.floor(hash(i * 7.7 + tick * 1.9) * NOISE.length)];
  }
  return out;
}

// ---------- Block letters for the title ----------

// 5 rows tall. Each "#" is one pixel, drawn two characters wide so the letters come out about square.
const LETTERS: Record<string, string[]> = {
  A: [".###.", "#...#", "#####", "#...#", "#...#"],
  C: [".####", "#....", "#....", "#....", ".####"],
  E: ["#####", "#....", "####.", "#....", "#####"],
  H: ["#...#", "#...#", "#####", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  K: ["#...#", "#..#.", "###..", "#..#.", "#...#"],
  V: ["#...#", "#...#", "#...#", ".#.#.", "..#.."],
};
const LETTER_GAP = 2; // pixels between letters
const WORD_GAP = 5; // pixels for a space

/**
 * Renders words in block letters made of characters. Returns two layers of equal-length lines:
 * `fill`, the letters, and `shade`, a drop shadow one row down and one pixel right, meant to be
 * drawn underneath in a dimmer colour.
 */
export function blockLetters(text: string, glyph = "#") {
  const H = 5;
  const px: boolean[][] = Array.from({ length: H }, () => []);
  [...text.toUpperCase()].forEach((letter, i) => {
    for (let r = 0; r < H; r++) {
      if (i > 0) for (let g = 0; g < LETTER_GAP; g++) px[r].push(false);
      if (letter === " ") for (let g = 0; g < WORD_GAP - LETTER_GAP; g++) px[r].push(false);
      else for (const p of LETTERS[letter]?.[r] ?? "") px[r].push(p === "#");
    }
  });
  const width = px[0].length + 1;
  const fill: string[] = [];
  const shade: string[] = [];
  for (let r = 0; r < H + 1; r++) {
    let f = "";
    let sh = "";
    for (let c = 0; c < width; c++) {
      const on = r < H && px[r][c];
      const shadow = r > 0 && c > 0 && px[r - 1][c - 1];
      f += (on ? glyph : " ").repeat(2);
      sh += (shadow && !on ? glyph : " ").repeat(2);
    }
    fill.push(f);
    shade.push(sh);
  }
  return { fill, shade };
}
