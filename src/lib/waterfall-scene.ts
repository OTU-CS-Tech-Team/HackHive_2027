/**
 * waterfall-scene.ts
 * ---------------------------------------------------------------------------
 * A lightly animated, low-poly waterfall valley drawn on a <canvas>.
 *
 * Quick start (fills the whole page behind your content):
 *
 *   import { mountWaterfallBackground } from "./waterfall-scene";
 *   const bg = mountWaterfallBackground();      // returns { scene, destroy }
 *   // bg.destroy();                            // when you want to remove it
 *
 * Or draw into a canvas you already have:
 *
 *   const scene = new WaterfallScene(myCanvas, 7);   // 7 = terrain seed
 *   scene.start();
 *
 * How it fills any page size
 * - Everything is laid out from the canvas width/height, so the scene stretches
 *   to cover X and Y. Taller page  -> the waterfall and cliff simply run higher.
 *   Wider page -> more hills, trees and meadow get generated on the right.
 * - Extra "filler" (thin streams falling straight down the cliff, ledge rocks,
 *   moss, trees, flowers) is placed with a seeded random generator, so the
 *   terrain varies but is the same every load. Change the seed for a new valley.
 * - Static stuff (sky, mountains, cliff, hills) is painted once into an
 *   offscreen canvas. Only the moving parts are redrawn each frame.
 * ---------------------------------------------------------------------------
 */

/**
 * Which part of the valley to show. "full" fits the whole scene in the viewport.
 * "top" / "middle" / "bottom" build the SAME valley three screens tall and show
 * one third of it, so three pages can look like one continuous picture:
 *   top    = sky, mountains, upper cliff and the top of the fall
 *   middle = the long fall, ledges, moss and streams down the cliff
 *   bottom = the splash pool, stream and the flower meadow
 */
export type Region = "full" | "top" | "middle" | "bottom";

type RGB = [number, number, number];
type RNG = () => number;

const TAU = Math.PI * 2;

// ===========================================================================
// Small helpers
// ===========================================================================
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const shade = (c: RGB, k: number): RGB => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
const css = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

// Seeded random numbers so the "random" terrain is identical on every load.
function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (rng: RNG, lo: number, hi: number): number => lo + (hi - lo) * rng();

// Stateless hash -> 0..1 (used for animation so no per-frame state is needed).
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Smooth 1D noise built from a few sine waves with random phase.
// Input roughly 0..1 across the screen, output -1..1.
function makeNoise(rng: RNG): (x: number) => number {
  const waves = Array.from({ length: 4 }, (_, i) => ({
    f: (3 + i * 4.5) * (0.8 + rng() * 0.4),
    p: rng() * TAU,
    a: 1 / (1 + i * 0.9),
  }));
  const norm = waves.reduce((s, w) => s + w.a, 0);
  return (x: number) => waves.reduce((s, w) => s + Math.sin(x * w.f + w.p) * w.a, 0) / norm;
}

// Smooth 2D noise (for sunlit / shaded patches on the hills).
function makeNoise2D(rng: RNG): (x: number, y: number) => number {
  const a = 4 + rng() * 3, b = 5 + rng() * 3, c = 6 + rng() * 3, d = 3 + rng() * 3;
  const p = rng() * TAU, q = rng() * TAU, r = rng() * TAU;
  return (x, y) => (Math.sin(x * a + p) * Math.sin(y * b + q) + Math.sin(x * c + y * d + r)) / 2;
}

// ===========================================================================
// Palettes
// ===========================================================================
const ROCK = {
  dark: [30, 46, 66] as RGB,
  mid: [56, 80, 102] as RGB,
  light: [110, 142, 156] as RGB,
  warm: [158, 112, 84] as RGB,
};
const MOSS = {
  dark: [44, 112, 58] as RGB,
  mid: [92, 162, 60] as RGB,
  light: [158, 210, 84] as RGB,
};
const LEAF = {
  dark: [38, 118, 62] as RGB,
  mid: [62, 172, 76] as RGB,
  light: [118, 214, 92] as RGB,
};
const CANOPY = {
  dark: [48, 118, 62] as RGB,
  mid: [98, 168, 66] as RGB,
  light: [166, 214, 96] as RGB,
};

// Flower colours: [main, lighter highlight]. Pushed more saturated than the
// reference art so the foreground really pops.
const PETAL: Record<string, [string, string]> = {
  white: ["#ffffff", "#f0e8ff"],
  yellow: ["#ffd400", "#fff06a"],
  gold: ["#ff9500", "#ffc94d"],
  pink: ["#ff1f7d", "#ff86bd"],
  violet: ["#8a2bff", "#c48cff"],
  blue: ["#2a62ff", "#80aaff"],
};

// ===========================================================================
// Data shapes
// ===========================================================================
interface Rock {
  x: number; y: number; w: number; h: number;
  moss: boolean; tone: number; j: number[];
}
interface Tree {
  x: number; y: number; h: number; phase: number; lean: number;
  blobs: { dx: number; dy: number; r: number; tone: number; jit: number[] }[];
}
interface Fern {
  x: number; y: number; s: number; phase: number;
  fronds: { ang: number; len: number; tone: number }[];
}
type FlowerKind = "daisy" | "buttercup" | "pink" | "aster" | "lupine" | "bluebell";
interface Flower {
  kind: FlowerKind; x: number; y: number; h: number; r: number; lean: number;
  phase: number; speed: number; tilt: number; pal: [string, string];
  petals: number; leafTone: number;
}
interface Streamlet { x: number; y0: number; y1: number; w: number; speed: number; seed: number }
interface Ripple { s: number; l: number; len: number; speed: number; ph: number }
interface Wisp { x: number; y: number; w: number; h: number; speed: number; a: number }

export class WaterfallScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private seed: number;

  private readonly region: Region;
  private full = true;
  private W = 0;
  private H = 0;   // height of the whole valley ("world")
  private vh = 0;  // height of the visible canvas
  private off = 0; // where the visible slice starts inside the world
  private u = 1; // "unit": scales every size with the screen
  private dpr = 1;

  // Static layers (painted once per resize)
  private back!: HTMLCanvasElement;
  private mid!: HTMLCanvasElement;

  // Main waterfall geometry
  private wfCx = 0;
  private wfW = 0;
  private poolY = 0;
  private fallEnd = 0;
  private fallTop = -20;                         // where the water starts (negative = runs off the top of the page)
  private plateauY: (x: number) => number = () => -1e4; // skyline of the clifftop (slice views only)
  private fallLeft: (y: number) => number = () => 0;
  private fallRight: (y: number) => number = () => 0;
  private cliffRight: (y: number) => number = () => 0;
  private cliffBottom: (x: number) => number = () => 0;
  private ridgeB: (x: number) => number = () => 0;

  // Stream centre-line samples and edges
  private sx: number[] = []; private sy: number[] = [];
  private stx: number[] = []; private sty: number[] = [];
  private shw: number[] = [];
  private lx: number[] = []; private ly: number[] = [];
  private rx: number[] = []; private ry: number[] = [];
  private streamLen = 0;
  private streamMinY = 0;
  private streamMaxY = 0;
  private streamGrad!: CanvasGradient;
  private poolGlow!: CanvasGradient;
  private cascades: number[] = [];
  private ripples: Ripple[] = [];
  private streamRocks: Rock[] = [];

  // Other moving things
  private streamlets: Streamlet[] = [];
  private trees: Tree[] = [];
  private ferns: Fern[] = [];
  private flowers: Flower[] = [];
  private wisps: Wisp[] = [];

  // Animation loop state
  private raf = 0;
  private last = 0;
  private time = 0;
  private resizeTimer = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, seed = 7, region: Region = "full") {
    this.canvas = canvas;
    this.seed = seed;
    this.region = region;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;
  }

  // =========================================================================
  // Public API
  // =========================================================================
  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    window.addEventListener("resize", this.onResize);

    // Respect "reduce motion": draw one still frame and stop.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      this.draw(0);
      return;
    }
    const loop = (now: number): void => {
      this.raf = requestAnimationFrame(loop);
      if (this.last === 0) this.last = now;
      // Cap the step so the animation doesn't jump after a tab was hidden.
      this.time += Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.draw(this.time);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.clearTimeout(this.resizeTimer);
  }

  /** Generate a different valley. */
  reseed(seed: number): void {
    this.seed = seed;
    this.resize();
  }

  /** Re-measure the canvas and rebuild the terrain. */
  resize(): void {
    const W = Math.max(320, Math.round(this.canvas.clientWidth || window.innerWidth));
    const H = Math.max(320, Math.round(this.canvas.clientHeight || window.innerHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = W;
    this.vh = H;
    // A slice view builds a world three screens tall and shows one third of it.
    this.full = this.region === "full";
    this.H = this.full ? H : H * 3;
    this.off = H * { full: 0, top: 0, middle: 1, bottom: 2 }[this.region];
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.build();
    this.draw(this.time);
  }

  private onResize = (): void => {
    // Debounce so dragging the window edge doesn't rebuild 60 times a second.
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 150);
  };

  // =========================================================================
  // BUILD: runs once per size change. Lays out terrain and paints static layers.
  // =========================================================================
  private build(): void {
    const { W, H } = this;
    const V = this.vh; // sizes that must not grow with the tall world use V
    const rng = mulberry32(this.seed);
    const u = (this.u = clamp(Math.sqrt(W * V) / 760, 0.6, 2.4));

    // Independent noise curves so each feature varies on its own.
    const nFallL = makeNoise(rng), nFallR = makeNoise(rng);
    const nCliff = makeNoise(rng), nCliffB = makeNoise(rng), nTop = makeNoise(rng);
    const nM1 = makeNoise(rng), nM2 = makeNoise(rng);
    const nHA = makeNoise(rng), nHB = makeNoise(rng);
    const nLight = makeNoise2D(rng);

    // ---- key geometry -----------------------------------------------------
    this.wfW = clamp(100 * u, 56, W * 0.22);
    this.wfCx = clamp(W * 0.22, this.wfW * 0.5 + 30 * u, W * 0.45);
    this.poolY = this.full ? H * 0.58 : H * 0.74; // in slice mode the pool sits in the bottom third
    this.fallEnd = this.poolY + 0.035 * V;
    const wfCx = this.wfCx, wfW = this.wfW, poolY = this.poolY;

    // The fall edges wobble a little and flare out slightly toward the bottom.
    this.fallLeft = (y) => wfCx - (wfW / 2) * (1 + 0.14 * clamp(y / poolY, 0, 1)) + nFallL(y / H) * wfW * 0.05;
    this.fallRight = (y) => wfCx + (wfW / 2) * (1 + 0.14 * clamp(y / poolY, 0, 1)) + nFallR(y / H) * wfW * 0.05;
    // In slice views the cliff has a top: a grassy plateau with a river that runs
    // along it and tips over the edge. (The single-screen view keeps the old look.)
    if (!this.full) {
      const plateau = 0.3 * V;
      this.fallTop = plateau + 0.05 * V;
      this.plateauY = (x) => plateau + nTop(x / W) * 0.02 * V;
    }
    // The cliff to the right of the fall slants down and outward (like the art).
    this.cliffRight = (y) => wfCx + wfW * 0.5 + W * (0.13 + 0.2 * clamp(y / H, 0, 1.2)) + nCliff(y / H) * W * 0.035;
    this.cliffBottom = (x) => poolY + 0.03 * V + nCliffB(x / W) * 0.02 * V;

    // Ridge lines (higher on the sunny right side, with random bumps).
    const ridgeM1 = (x: number) => H * (0.03 + 0.12 * (1 - x / W)) + nM1(x / W) * H * 0.07;
    const ridgeM2 = (x: number) => H * (0.12 + 0.14 * (1 - x / W)) + nM2(x / W) * H * 0.06;
    const ridgeA = (x: number) => H * (0.22 + 0.16 * (1 - x / W)) + nHA(x / W) * H * 0.05;
    this.ridgeB = (x) => H * (0.3 + 0.16 * (1 - x / W)) + nHB(x / W) * H * 0.05;

    this.buildStream(rng);

    // ---- streamlets: thin falls running straight down the cliff -----------
    this.streamlets = [];
    const landingRocks: Rock[] = [];
    const top0 = this.full ? -20 : this.fallTop + 0.03 * V; // streamlets can't start above the clifftop
    const wantStreamlets = clamp(Math.round((W / 300) * (H / V)), 2, 16);
    for (let i = 0; i < wantStreamlets; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y1 = between(rng, Math.max(H * 0.22, top0 + 0.12 * V), poolY - 0.03 * V);
      let lo: number, hi: number;
      if (side < 0) {
        lo = 22 * u;
        hi = this.fallLeft(y1) - 45 * u;
      } else {
        lo = this.fallRight(y1) + 45 * u;
        hi = this.cliffRight(y1) - 70 * u;
      }
      if (hi <= lo) continue; // no room on this side at this size
      const x = between(rng, lo, hi);
      const y0 = rng() < 0.5 ? top0 : Math.max(top0, y1 - between(rng, H * 0.18, H * 0.45));
      this.streamlets.push({ x, y0, y1, w: between(rng, 7, 15) * u, speed: between(rng, 0.8, 1.3), seed: rng() * 10 });
      landingRocks.push(this.makeRock(rng, x, y1 + 4 * u, between(rng, 56, 90) * u, true));
    }

    // =====================================================================
    // BACK LAYER (static)
    // =====================================================================
    this.back = this.makeLayer();
    const b = this.layerCtx(this.back);

    // Sky: cool blue up-left, warm glow toward the sun at the top right.
    const sky = b.createLinearGradient(0, 0, W, H * 0.5);
    sky.addColorStop(0, css([118, 176, 210]));
    sky.addColorStop(0.55, css([190, 224, 228]));
    sky.addColorStop(1, css([250, 232, 176]));
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);
    const glow = b.createRadialGradient(W * 0.88, -H * 0.05, 0, W * 0.88, -H * 0.05, W * 0.55);
    glow.addColorStop(0, "rgba(255,240,180,0.9)");
    glow.addColorStop(1, "rgba(255,240,180,0)");
    b.fillStyle = glow;
    b.fillRect(0, 0, W, H);

    // Faceted mountains and hills, back to front.
    const cell = 44 * u;
    // far mountains: sunlit tan fading into cool grey-teal
    this.faceMesh(b, rng, 0, 0, W, H * 0.5, cell * 1.3, (x, y) => y > ridgeM1(x), (x, y) => {
      const t = clamp((y - ridgeM1(x)) / (H * 0.22), 0, 1);
      return css(shade(mix([232, 208, 160], [118, 160, 162], t), between(rng, 0.88, 1.1)));
    });
    // mid mountains
    this.faceMesh(b, rng, 0, H * 0.05, W, H * 0.6, cell * 1.2, (x, y) => y > ridgeM2(x), (x, y) => {
      const t = clamp((y - ridgeM2(x)) / (H * 0.22), 0, 1);
      return css(shade(mix([150, 188, 142], [56, 118, 114], t), between(rng, 0.86, 1.12)));
    });
    // far green hills
    this.faceMesh(b, rng, 0, H * 0.1, W, H * 0.8, cell * 1.1, (x, y) => y > ridgeA(x), (x, y) => {
      const t = clamp((y - ridgeA(x)) / (H * 0.2), 0, 1);
      return css(shade(mix([96, 158, 96], [52, 118, 96], t), 0.88 + 0.2 * rng() + 0.06 * nLight(x / W, y / H)));
    });
    // near hills + meadow (runs all the way down to the bottom of the page)
    this.faceMesh(b, rng, 0, H * 0.2, W, H, cell, (x, y) => y > this.ridgeB(x), (x, y) => {
      const t = clamp((y - H * 0.3) / (H * 0.7), 0, 1);
      return css(shade(mix([70, 140, 88], [118, 192, 60], t), 0.84 + 0.26 * rng() + 0.1 * nLight(x / W, y / H)));
    });

    // Cliff: a jittered triangle mesh of slate with warm, sunlit facets.
    const cliffMaxX = Math.min(W, this.cliffRight(H) + 60 * u);
    this.faceMesh(b, rng, 0, 0, cliffMaxX, poolY + 0.1 * V, 54 * u,
      (x, y) => x < this.cliffRight(y) && y < this.cliffBottom(x) && y > this.plateauY(x),
      (x, y) => {
        // all random draws first, so the sequence is the same whichever branch is used
        const r = rng();
        const lit = clamp(0.25 + 0.5 * (x / (W * 0.6)) + (rng() - 0.5) * 0.5, 0, 1);
        const sh = rng();
        // the top strip of the cliff is grass; below it is rock
        if (y < this.plateauY(x) + 0.085 * V) return css(shade(mix(MOSS.mid, MOSS.light, sh), 0.85 + 0.25 * lit));
        let col = mix(ROCK.dark, ROCK.light, lit * 0.8);
        if (r < 0.1) col = mix(col, ROCK.warm, 0.7);
        else if (r < 0.18) col = mix(col, ROCK.mid, 0.4);
        return css(shade(col, 0.85 + 0.3 * sh));
      });

    // Rocks: ledges down the right cliff edge, scattered boulders, and landing
    // rocks where each thin stream hits the cliff.
    const rocks: Rock[] = [...landingRocks];
    for (let y = Math.max(H * 0.06, this.fallTop + 0.08 * V); y < poolY; y += between(rng, 55, 95) * u) {
      rocks.push(this.makeRock(rng, this.cliffRight(y) - between(rng, 0, 30) * u, y, between(rng, 80, 150) * u, rng() < 0.8));
    }
    const nBoulders = Math.round((W * poolY) / (130 * u * 130 * u) * 1.5);
    for (let i = 0; i < nBoulders * 3 && rocks.length < nBoulders + landingRocks.length + 30; i++) {
      const x = between(rng, 0, W * 0.7);
      const y = between(rng, Math.max(0.02 * H, this.fallTop + 0.08 * V), poolY);
      if (x >= this.cliffRight(y) - 20 * u) continue;
      if (x > this.fallLeft(y) - 30 * u && x < this.fallRight(y) + 30 * u) continue; // keep the fall clear
      rocks.push(this.makeRock(rng, x, y, between(rng, 50, 120) * u, rng() < 0.65));
    }
    // Boulders along the cliff foot to the left of the pool.
    for (let x = 0; x < wfCx - wfW; x += between(rng, 55, 90) * u) {
      rocks.push(this.makeRock(rng, x, this.cliffBottom(x), between(rng, 60, 105) * u, rng() < 0.6));
    }
    rocks.sort((p, q) => p.y - q.y);

    // A few small trees growing on cliff ledges (left of the fall).
    this.trees = [];
    for (const r of rocks) {
      if (r.moss && r.w > 90 * u && r.x < this.fallLeft(r.y) - 20 * u && rng() < 0.3) {
        this.trees.push(this.makeTree(rng, r.x, r.y - r.h * 0.4, r.w * 0.95));
      }
    }
    // Trees up on the clifftop, either side of the river.
    if (!this.full) {
      const nPlateau = clamp(Math.round(W / 450), 2, 6);
      for (let i = 0; i < nPlateau; i++) {
        const left = i % 2 === 0;
        const lo = left ? 30 * u : this.fallRight(this.fallTop) + 50 * u;
        const hi = left ? this.fallLeft(this.fallTop) - 60 * u : this.cliffRight(this.fallTop) - 40 * u;
        const x = between(rng, lo, Math.max(lo, hi));
        if (hi <= lo) continue;
        this.trees.push(this.makeTree(rng, x, this.plateauY(x) + 0.05 * V, between(rng, 55, 95) * u));
      }
    }
    for (const r of rocks) this.drawRock(b, r);

    // Moss and hanging vines along both edges of the fall.
    for (let y = Math.max(0, this.fallTop + 0.03 * V); y < poolY; y += 38 * u) {
      for (const side of [-1, 1]) {
        if (rng() > 0.55) continue;
        const x = side < 0 ? this.fallLeft(y) - between(rng, 0, 10) * u : this.fallRight(y) + between(rng, 0, 10) * u;
        this.drawMoss(b, rng, x, y, between(rng, 10, 24) * u);
      }
    }

    // Tiny meadow flowers dotted on the far hillside (the bigger ones are live).
    const dots: [number, number, number][] = [[150, 80, 230], [255, 214, 40], [255, 120, 190], [255, 255, 255]].map(
      (c) => c as [number, number, number],
    );
    const nDots = Math.round((W * H) / 3500);
    for (let i = 0; i < nDots; i++) {
      const x = between(rng, W * 0.3, W);
      const y = between(rng, H * 0.34, poolY + 0.22 * V);
      if (x < this.cliffRight(y) + 20 * u || y < this.ridgeB(x) + 6 * u || this.inStream(x, y, 12 * u)) continue;
      const col = dots[Math.floor(rng() * dots.length)];
      b.fillStyle = css(col, 0.95);
      b.beginPath();
      b.arc(x, y, between(rng, 1.6, 4.2) * u * (0.6 + (y / H) * 0.6), 0, TAU);
      b.fill();
    }

    // =====================================================================
    // MID LAYER (static, drawn after the water): shoreline rocks, grass tufts
    // =====================================================================
    this.mid = this.makeLayer();
    const m = this.layerCtx(this.mid);
    const shore: Rock[] = [];
    const M = this.sx.length;
    for (let i = 0; i < M; i += 2) {
      for (const side of [-1, 1]) {
        if (rng() > 0.55) continue;
        const px = (side < 0 ? this.lx[i] : this.rx[i]) + (rng() - 0.5) * 8 * u;
        const py = (side < 0 ? this.ly[i] : this.ry[i]) + (rng() - 0.5) * 8 * u;
        // keep the splash zone under the fall free
        if (Math.abs(px - wfCx) < wfW * 0.75 && py < poolY + 0.1 * V) continue;
        shore.push(this.makeRock(rng, px, py, between(rng, 24, 62) * u, rng() < 0.4));
      }
    }
    // Clifftop: boulders along both river banks and on either side of the lip.
    if (!this.full) {
      const ry = this.fallTop;
      const hwR = 0.03 * V;
      const edgeL = this.fallLeft(ry) - 10 * u;
      for (let x = 10 * u; x < edgeL; x += between(rng, 60, 110) * u) {
        shore.push(this.makeRock(rng, x, ry - hwR, between(rng, 34, 70) * u, rng() < 0.6));
        shore.push(this.makeRock(rng, x + 30 * u, ry + hwR, between(rng, 34, 70) * u, rng() < 0.6));
      }
      shore.push(this.makeRock(rng, this.fallLeft(ry) - 34 * u, ry + hwR * 0.6, 96 * u, true));
      shore.push(this.makeRock(rng, this.fallRight(ry) + 34 * u, ry + hwR * 0.6, 96 * u, true));
    }
    // Rocks sitting in the stream itself (they get live foam rings).
    this.streamRocks = [];
    const nStreamRocks = clamp(Math.round(this.streamLen / (110 * u)), 5, 18);
    for (let i = 0; i < nStreamRocks; i++) {
      const k = Math.floor(between(rng, M * 0.1, M * 0.96));
      const off = between(rng, -0.6, 0.6) * this.shw[k];
      const px = this.sx[k] - this.sty[k] * off;
      const py = this.sy[k] + this.stx[k] * off;
      if (px > W + 20) continue;
      const rock = this.makeRock(rng, px, py, between(rng, 24, 52) * u, rng() < 0.5);
      this.streamRocks.push(rock);
      shore.push(rock);
    }
    // A few big foreground rocks near the bottom.
    for (let i = 0; i < clamp(Math.round(W / 420), 2, 6); i++) {
      const x = between(rng, 0, W);
      const y = between(rng, H - 0.1 * V, H - 0.01 * V);
      if (this.inStream(x, y, 20 * u)) continue;
      shore.push(this.makeRock(rng, x, y, between(rng, 50, 110) * u, rng() < 0.6));
    }
    shore.sort((p, q) => p.y - q.y);
    for (const r of shore) this.drawRock(m, r);

    // Grass tufts across the lower half.
    const tufts: { x: number; y: number }[] = [];
    const tuftTop = poolY + 0.06 * V;
    const nTufts = Math.round((W * H) / 9000);
    for (let i = 0; i < nTufts; i++) {
      const x = between(rng, -10, W + 10);
      const y = between(rng, tuftTop, H + 0.01 * V);
      if (this.inStream(x, y, 8 * u)) continue;
      tufts.push({ x, y });
    }
    tufts.sort((p, q) => p.y - q.y);
    for (const t of tufts) {
      const d = clamp((t.y - tuftTop) / (H + 0.01 * V - tuftTop), 0, 1);
      const blades = 5 + Math.floor(rng() * 5);
      for (let k = 0; k < blades; k++) {
        const hgt = between(rng, 14, 46) * u * (0.5 + d * 0.7);
        const bx = t.x + (rng() - 0.5) * 14 * u;
        const lean = (rng() - 0.5) * hgt * 0.5;
        m.fillStyle = css(shade(mix(LEAF.dark, LEAF.light, rng()), 0.9 + 0.2 * d));
        m.beginPath();
        m.moveTo(bx - 1.6 * u, t.y);
        m.lineTo(bx + lean, t.y - hgt);
        m.lineTo(bx + 1.6 * u, t.y);
        m.closePath();
        m.fill();
      }
    }
    // Soft darkening at the very bottom for depth.
    const fg = m.createLinearGradient(0, H - 0.18 * V, 0, H);
    fg.addColorStop(0, "rgba(10,50,30,0)");
    fg.addColorStop(1, "rgba(10,50,30,0.3)");
    m.fillStyle = fg;
    m.fillRect(0, H - 0.18 * V, W, 0.18 * V);

    // =====================================================================
    // LIVE OBJECTS (positions only; drawn every frame)
    // =====================================================================
    // Trees on the hillside right of the cliff, bigger the closer they are.
    const wantTrees = clamp(Math.round((W * (this.full ? H : V * 1.6)) / 52000), 6, 60);
    for (let tries = 0; tries < wantTrees * 30 && this.trees.length < wantTrees; tries++) {
      const x = between(rng, 0, W);
      const y = between(rng, H * 0.3, poolY + 0.22 * V);
      if (x < this.cliffRight(y) + 40 * u) continue;
      if (y < this.ridgeB(x) + 10 * u) continue;
      if (this.inStream(x, y, 30 * u)) continue;
      const d = clamp((y - H * 0.3) / (poolY + 0.22 * V - H * 0.3), 0, 1);
      const h = lerp(60, 135, d) * u * between(rng, 0.85, 1.15);
      if (this.trees.some((t) => Math.hypot(t.x - x, (t.y - y) * 1.6) < (t.h + h) * 0.28)) continue;
      this.trees.push(this.makeTree(rng, x, y, h));
    }
    this.trees.sort((p, q) => p.y - q.y);

    // Ferns around the pool, along the bank and in the meadow.
    this.ferns = [];
    const wantFerns = clamp(Math.round((W * H) / 60000), 8, 44);
    for (let tries = 0; tries < wantFerns * 20 && this.ferns.length < wantFerns; tries++) {
      const x = between(rng, 0, W);
      const y = between(rng, poolY + 0.04 * V, H - 0.02 * V);
      if (this.inStream(x, y, 16 * u)) continue;
      const d = clamp((y - poolY) / (H - poolY), 0, 1);
      const s = lerp(26, 76, d) * u * between(rng, 0.8, 1.25);
      const n = 6 + Math.floor(rng() * 4);
      const fronds = Array.from({ length: n }, (_, k) => ({
        ang: lerp(-Math.PI + 0.25, -0.25, (k + 0.5) / n) + (rng() - 0.5) * 0.2,
        len: s * between(rng, 0.7, 1.15),
        tone: between(rng, 0.8, 1.15),
      }));
      this.ferns.push({ x, y, s, phase: rng() * TAU, fronds });
    }
    this.ferns.sort((p, q) => p.y - q.y);

    // Foreground flowers: bigger and more saturated than the reference art.
    this.flowers = [];
    const wantFlowers = clamp(Math.round((W * V) / 9500), 50, 380); // V (not H) so slices aren't 3x denser
    const yTop = poolY + 0.12 * V;
    const yBot = H + 0.02 * V;
    for (let tries = 0; tries < wantFlowers * 8 && this.flowers.length < wantFlowers; tries++) {
      const x = between(rng, -0.02 * W, 1.02 * W);
      // bias toward the bottom so the front is lush
      const y = lerp(yTop, yBot, 1 - Math.pow(rng(), 1.5));
      if (this.inStream(x, y, 14 * u)) continue;
      const d = clamp((y - yTop) / (yBot - yTop), 0, 1);
      this.flowers.push(this.makeFlower(rng, x, y, d));
    }
    this.flowers.sort((p, q) => p.y - q.y);

    // Drifting haze streaks across the mountains.
    this.wisps = [];
    const nWisps = Math.round((5 + W / 500) * (H / V));
    for (let i = 0; i < nWisps; i++) {
      this.wisps.push({
        x: rng() * W, y: between(rng, H * 0.04, H * 0.42),
        w: between(rng, 120, 280) * u, h: between(rng, 22, 60) * u,
        speed: between(rng, 3, 9) * u, a: between(rng, 0.12, 0.26),
      });
    }
  }

  // =========================================================================
  // Stream: centre line (smooth curve), widths, edges, ripples
  // =========================================================================
  private buildStream(rng: RNG): void {
    const { W, u } = this;
    const V = this.vh;
    const P = this.poolY;
    const nW = makeNoise(rng), nE1 = makeNoise(rng), nE2 = makeNoise(rng);
    const j = (): number => (rng() - 0.5) * 0.05 * V;
    // Rough path: from under the fall, curving right and slightly down.
    const ctrl: [number, number][] = [
      [this.wfCx - this.wfW * 0.9, P + 0.04 * V],
      [this.wfCx + this.wfW * 0.4, P + 0.055 * V + j()],
      [W * 0.36, P + 0.09 * V + j()],
      [W * 0.55, P + 0.165 * V + j()],
      [W * 0.76, P + 0.195 * V + j()],
      [W * 1.15, P + 0.22 * V + j()],
    ];
    // Catmull-Rom spline through the control points.
    const pts: [number, number][] = [];
    const steps = 16;
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
      for (let k = 0; k < steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number): number =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    pts.push(ctrl[ctrl.length - 1]);

    const M = pts.length;
    this.sx = []; this.sy = []; this.stx = []; this.sty = []; this.shw = [];
    this.lx = []; this.ly = []; this.rx = []; this.ry = [];
    let len = 0;
    for (let i = 0; i < M; i++) {
      const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, M - 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      const tx = dx / d, ty = dy / d;
      if (i > 0) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const s = i / (M - 1);
      // Wide pool under the fall, narrowing as it runs off right. The start is
      // pinched so the pool has a rounded end instead of a straight cut.
      const hw = V * (0.06 + 0.032 * (1 - s) * (1 - s) + 0.012 * nW(s * 3)) * (0.38 + 0.62 * smooth(s / 0.12));
      this.sx.push(pts[i][0]); this.sy.push(pts[i][1]);
      this.stx.push(tx); this.sty.push(ty); this.shw.push(hw);
      // normal = (-ty, tx); left edge is "up", right edge is "down"
      this.lx.push(pts[i][0] + ty * (hw + nE1(s * 9) * 3 * u));
      this.ly.push(pts[i][1] - tx * (hw + nE1(s * 9) * 3 * u));
      this.rx.push(pts[i][0] - ty * (hw + nE2(s * 9) * 3 * u));
      this.ry.push(pts[i][1] + tx * (hw + nE2(s * 9) * 3 * u));
    }
    this.streamLen = len;
    this.streamMinY = Math.min(...this.ly) - 20;
    this.streamMaxY = Math.max(...this.ry) + 20;

    // Water colour gradient + bright pool under the fall.
    const g = this.ctx.createLinearGradient(this.sx[0], 0, W, 0);
    g.addColorStop(0, "rgb(92,196,204)");
    g.addColorStop(0.5, "rgb(52,158,192)");
    g.addColorStop(1, "rgb(66,170,208)");
    this.streamGrad = g;
    const pg = this.ctx.createRadialGradient(this.wfCx + this.wfW * 0.2, P + 0.045 * V, 0,
      this.wfCx + this.wfW * 0.2, P + 0.045 * V, W * 0.2);
    pg.addColorStop(0, "rgba(236,252,255,0.75)");
    pg.addColorStop(0.5, "rgba(160,226,236,0.35)");
    pg.addColorStop(1, "rgba(160,226,236,0)");
    this.poolGlow = pg;

    // Two small cascades where the water steps down.
    this.cascades = [Math.floor(M * 0.3), Math.floor(M * 0.7)];

    // Ripples slide downstream with the current.
    this.ripples = [];
    const nR = clamp(Math.round(len / (22 * u)), 20, 140);
    for (let i = 0; i < nR; i++) {
      this.ripples.push({
        s: rng(), l: between(rng, -0.85, 0.85), len: between(rng, 14, 46) * u,
        speed: between(rng, 30, 70) * u, ph: rng() * TAU,
      });
    }
  }

  /** True when (x, y) is on the stream (plus a margin). Used to keep flowers/trees out of the water. */
  private inStream(x: number, y: number, margin: number): boolean {
    for (let i = 0; i < this.sx.length; i++) {
      const dx = x - this.sx[i], dy = y - this.sy[i];
      const r = this.shw[i] + margin;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  private tracePool(c: CanvasRenderingContext2D): void {
    c.beginPath();
    c.moveTo(this.lx[0], this.ly[0]);
    for (let i = 1; i < this.lx.length; i++) c.lineTo(this.lx[i], this.ly[i]);
    for (let i = this.rx.length - 1; i >= 0; i--) c.lineTo(this.rx[i], this.ry[i]);
    c.closePath();
  }

  // =========================================================================
  // Static painting helpers
  // =========================================================================
  private makeLayer(): HTMLCanvasElement {
    const l = document.createElement("canvas");
    l.width = Math.round(this.W * this.dpr);
    l.height = Math.round(this.vh * this.dpr); // layers only hold the visible slice
    return l;
  }
  private layerCtx(l: HTMLCanvasElement): CanvasRenderingContext2D {
    const c = l.getContext("2d");
    if (!c) throw new Error("2D canvas not supported");
    // paint in world coordinates; the offset shifts the visible slice into the layer
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, -this.off * this.dpr);
    return c;
  }

  /**
   * Paints a low-poly surface: a jittered grid split into triangles. A triangle
   * is only drawn when its centre passes `inside`, and its colour comes from
   * `colour`. This is what gives the cliffs, hills and mountains their facets.
   */
  private faceMesh(
    c: CanvasRenderingContext2D, rng: RNG, x0: number, y0: number, x1: number, y1: number, cell: number,
    inside: (x: number, y: number) => boolean, colour: (x: number, y: number) => string,
  ): void {
    const cols = Math.ceil((x1 - x0) / cell) + 3;
    const rows = Math.ceil((y1 - y0) / cell) + 3;
    const grid: [number, number][][] = [];
    for (let j = 0; j < rows; j++) {
      const row: [number, number][] = [];
      for (let i = 0; i < cols; i++) {
        row.push([x0 + (i - 1) * cell + (rng() - 0.5) * cell * 0.7, y0 + (j - 1) * cell + (rng() - 0.5) * cell * 0.7]);
      }
      grid.push(row);
    }
    c.lineWidth = 0.8;
    c.lineJoin = "round";
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = grid[j][i], b = grid[j][i + 1], d = grid[j + 1][i], e = grid[j + 1][i + 1];
        // random diagonal so the facets don't line up in obvious rows
        const tris = rng() < 0.5 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]];
        for (const t of tris) {
          const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
          const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
          if (!inside(cx, cy)) continue;
          const col = colour(cx, cy); // always evaluated so the random sequence is identical in every slice
          if (cy < this.off - cell * 2 || cy > this.off + this.vh + cell * 2) continue; // off-screen: skip the paint
          c.fillStyle = col;
          c.strokeStyle = col; // same-colour stroke hides hairline seams between triangles
          c.beginPath();
          c.moveTo(t[0][0], t[0][1]);
          c.lineTo(t[1][0], t[1][1]);
          c.lineTo(t[2][0], t[2][1]);
          c.closePath();
          c.fill();
          c.stroke();
        }
      }
    }
  }

  private makeRock(rng: RNG, x: number, y: number, w: number, moss: boolean): Rock {
    return { x, y, w, h: w * between(rng, 0.5, 0.75), moss, tone: between(rng, 0.85, 1.2), j: Array.from({ length: 8 }, () => rng()) };
  }

  /** A chunky faceted boulder: six outline points fanned around a centre point. */
  private drawRock(c: CanvasRenderingContext2D, r: Rock): void {
    const { x, y, w, h, j } = r;
    const p: [number, number][] = [
      [x - w * 0.5, y + h * 0.05 + (j[0] - 0.5) * h * 0.2],
      [x - w * (0.32 + j[1] * 0.08), y - h * 0.5],
      [x + w * (0.22 + j[2] * 0.1), y - h * 0.52],
      [x + w * 0.5, y - h * 0.02 + (j[3] - 0.5) * h * 0.2],
      [x + w * (0.38 + j[4] * 0.06), y + h * 0.5],
      [x - w * (0.4 + j[5] * 0.06), y + h * 0.5],
    ];
    const ctr: [number, number] = [x + (j[6] - 0.5) * w * 0.2, y - h * 0.05 + (j[7] - 0.5) * h * 0.2];
    // Sun is top-right: top and right faces lit, bottom faces in shadow.
    const faces: RGB[] = [
      mix(ROCK.mid, ROCK.dark, 0.3),
      mix(ROCK.light, ROCK.mid, 0.2),
      mix(ROCK.warm, ROCK.light, 0.25),
      mix(ROCK.dark, ROCK.mid, 0.4),
      shade(ROCK.dark, 0.8),
      mix(ROCK.dark, ROCK.mid, 0.6),
    ].map((f) => shade(f, r.tone));
    if (r.moss) {
      faces[1] = shade(MOSS.light, r.tone);
      faces[j[0] > 0.5 ? 0 : 2] = shade(MOSS.mid, r.tone);
    }
    c.lineWidth = 0.8;
    c.lineJoin = "round";
    for (let i = 0; i < 6; i++) {
      const a = p[i], b = p[(i + 1) % 6];
      const col = css(faces[i]); // triangle i uses face colour i
      c.fillStyle = col;
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.lineTo(ctr[0], ctr[1]);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }

  /** A faceted moss clump with a couple of vines hanging down. */
  private drawMoss(c: CanvasRenderingContext2D, rng: RNG, x: number, y: number, r: number): void {
    const n = 7;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = r * between(rng, 0.7, 1.15);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75]);
    }
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const lit = (Math.cos((i / n) * TAU + 0.4) + 1) / 2;
      const col = css(mix(MOSS.dark, MOSS.light, lit * 0.8 + 0.1));
      c.fillStyle = col;
      c.strokeStyle = col;
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x - r * 0.1, y - r * 0.15);
      c.lineTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.closePath();
      c.fill();
      c.stroke();
    }
    const vines = 1 + Math.floor(rng() * 3);
    for (let v = 0; v < vines; v++) {
      const vx = x + (rng() - 0.5) * r * 1.2;
      const len = between(rng, 24, 80) * this.u;
      c.fillStyle = css(mix(MOSS.dark, MOSS.mid, rng()));
      c.beginPath();
      c.moveTo(vx - 2.5 * this.u, y + r * 0.3);
      c.lineTo(vx + (rng() - 0.5) * 8 * this.u, y + r * 0.3 + len);
      c.lineTo(vx + 2.5 * this.u, y + r * 0.3);
      c.closePath();
      c.fill();
    }
  }

  // =========================================================================
  // Object factories
  // =========================================================================
  private makeTree(rng: RNG, x: number, y: number, h: number): Tree {
    const nBlobs = 2 + Math.floor(rng() * 2);
    const blobs = Array.from({ length: nBlobs }, () => ({
      dx: (rng() - 0.5) * h * 0.4,
      dy: (rng() - 0.5) * h * 0.25,
      r: h * between(rng, 0.26, 0.36),
      tone: between(rng, 0.88, 1.12),
      jit: Array.from({ length: 7 }, () => between(rng, 0.8, 1.15)),
    }));
    return { x, y, h, phase: rng() * TAU, lean: (rng() - 0.5) * h * 0.12, blobs };
  }

  private makeFlower(rng: RNG, x: number, y: number, d: number): Flower {
    const u = this.u;
    // Head radius grows toward the camera. The 1.25 factor is the "a little bigger" bump.
    const r = lerp(8, 30, Math.pow(d, 1.15)) * u * between(rng, 0.85, 1.2) * 1.2;
    const roll = rng();
    let kind: FlowerKind;
    let pal: [string, string];
    let petals = 5;
    if (roll < 0.28) { kind = "daisy"; pal = PETAL.white; petals = 13 + Math.floor(rng() * 4); }
    else if (roll < 0.52) { kind = "buttercup"; pal = rng() < 0.75 ? PETAL.yellow : PETAL.gold; }
    else if (roll < 0.62) { kind = "lupine"; pal = rng() < 0.5 ? PETAL.violet : rng() < 0.5 ? PETAL.pink : PETAL.blue; }
    else if (roll < 0.74) { kind = "bluebell"; pal = rng() < 0.7 ? PETAL.blue : PETAL.violet; }
    else if (roll < 0.88) { kind = "pink"; pal = PETAL.pink; }
    else { kind = "aster"; pal = rng() < 0.7 ? PETAL.violet : PETAL.pink; petals = 15 + Math.floor(rng() * 4); }

    let h = r * between(rng, 1.8, 3.2);
    if (kind === "lupine") h = r * between(rng, 3.8, 5.5);
    if (kind === "bluebell") h = r * between(rng, 2.4, 3.6);
    const lean = (rng() - 0.5) * h * (kind === "bluebell" ? 0.7 : 0.4);
    return {
      kind, x, y, h, r, lean, pal, petals,
      phase: rng() * TAU, speed: between(rng, 0.8, 1.6), tilt: (rng() - 0.5) * 0.5,
      leafTone: between(rng, 0.9, 1.15),
    };
  }

  // =========================================================================
  // DRAW: runs every frame
  // =========================================================================
  draw(t: number): void {
    const c = this.ctx;
    const { W, u, vh, off, dpr } = this;
    // clear in screen space, then switch to world space (shifted by the slice offset)
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, vh);
    c.setTransform(dpr, 0, 0, dpr, 0, -off * dpr);
    c.drawImage(this.back, 0, off, W, vh);

    this.drawWisps(t);
    if (this.streamMaxY > off && this.streamMinY < off + vh) this.drawStream(t);

    // Main fall: runs from above the top of the page down into the pool.
    if (!this.full) this.drawRiver(t);
    if (this.fallEnd > off - 40 && off + vh + 40 > this.fallTop) {
      this.drawWaterColumn(this.fallLeft, this.fallRight, this.fallTop, this.fallEnd, 1, t, 1, 1);
    }
    // Thin streams falling straight down the cliff (the terrain "filler").
    for (const s of this.streamlets) {
      if (s.y1 < off - 40 || s.y0 > off + vh + 40) continue; // not on screen
      const left = (y: number): number => {
        const taper = clamp((y - s.y0) / (60 * u), 0.35, 1);
        return s.x - (s.w * taper) / 2 + Math.sin(y * 0.011 + s.seed) * 2.5 * u;
      };
      const right = (y: number): number => {
        const taper = clamp((y - s.y0) / (60 * u), 0.35, 1);
        return s.x + (s.w * taper) / 2 + Math.sin(y * 0.011 + s.seed) * 2.5 * u;
      };
      this.drawWaterColumn(left, right, s.y0, s.y1, s.seed, t, s.speed, 0.9);
    }

    c.drawImage(this.mid, 0, off, W, vh);
    this.drawFoamRings(t);

    // Mist and spray where the water lands.
    const onScreen = (y: number): boolean => y > off - 200 * u && y < off + vh + 200 * u;
    if (onScreen(this.fallEnd)) this.drawSplash(this.wfCx, this.fallEnd, 1, t, 0);
    for (const s of this.streamlets) {
      if (onScreen(s.y1)) this.drawSplash(s.x, s.y1 + 4 * u, 0.3, t, s.seed);
    }

    // Skip anything that sits entirely above or below the visible slice.
    for (const tr of this.trees) {
      if (tr.y < off - 20 * u || tr.y - tr.h > off + vh) continue;
      this.drawTree(tr, t);
    }
    for (const f of this.ferns) {
      if (f.y < off - 20 * u || f.y - f.s * 1.3 > off + vh) continue;
      this.drawFern(f, t);
    }
    for (const f of this.flowers) {
      if (f.y < off - 20 * u || f.y - f.h * 1.1 - f.r > off + vh) continue;
      this.drawFlower(f, t);
    }

    this.drawMotes(t);
    this.drawLight(t);
  }

  // ---- haze streaks ---------------------------------------------------------
  private drawWisps(t: number): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = "screen";
    for (const w of this.wisps) {
      // drift right, wrap around
      const span = this.W + w.w * 3;
      // the skew below shifts x by -0.8*y, so pre-compensate to land where we mean to
      const x = ((w.x + t * w.speed) % span) - w.w + 0.8 * (w.y + w.h / 2);
      c.save();
      c.transform(1, 0, -0.8, 1, 0, 0); // skew into a slanted parallelogram
      const g = c.createLinearGradient(x, 0, x + w.w, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(255,255,255,${w.a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(x, w.y, w.w, w.h);
      c.restore();
    }
    c.restore();
  }

  // ---- falling water ----------------------------------------------------------
  /**
   * Draws one vertical sheet of water between two edge curves, with streaks
   * sliding straight down. Used for the big fall and the thin streams.
   */
  private drawWaterColumn(
    left: (y: number) => number, right: (y: number) => number, y0: number, y1: number,
    seed: number, t: number, speed: number, alpha: number,
  ): void {
    const c = this.ctx;
    const u = this.u;
    const span = y1 - y0;
    if (span <= 0) return;
    const steps = Math.max(8, Math.ceil(span / 24));

    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    for (let k = 0; k <= steps; k++) {
      const y = lerp(y0, y1, k / steps);
      if (k === 0) c.moveTo(left(y), y); else c.lineTo(left(y), y);
    }
    for (let k = steps; k >= 0; k--) {
      const y = lerp(y0, y1, k / steps);
      c.lineTo(right(y), y);
    }
    c.closePath();

    // body colour: light teal up top -> whiter at the base
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(138,206,226,0.92)");
    g.addColorStop(0.5, "rgba(104,176,210,0.95)");
    g.addColorStop(1, "rgba(206,240,248,0.98)");
    c.fillStyle = g;
    c.fill();
    c.clip();

    // streaks sliding down
    const mid = (y0 + y1) / 2;
    const width = right(mid) - left(mid);
    const n = clamp(Math.round(width / (4.5 * u)), 4, 40);
    c.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const fx = hash(i * 7.31 + seed * 13.7);
      const len = (40 + hash(i * 3.17 + seed) * 120) * u;
      const v = (140 + hash(i * 5.91 + seed * 2.1) * 200) * u * speed;
      const cycle = span + len;
      const ys = y0 - len + ((t * v + hash(i * 1.77 + seed) * cycle) % cycle);
      const dark = i % 3 === 0;
      c.strokeStyle = dark ? "rgba(26,88,140,0.32)" : "rgba(255,255,255,0.55)";
      c.lineWidth = (1.2 + hash(i * 9.13 + seed) * 3.2) * u;
      c.beginPath();
      for (let k = 0; k <= 4; k++) {
        const y = ys + (len * k) / 4;
        const x = lerp(left(y), right(y), fx) + Math.sin(y * 0.02 + i) * 1.5 * u;
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();

    // bright foam along the two edges
    c.save();
    c.globalAlpha = alpha * 0.55;
    c.strokeStyle = "#ffffff";
    c.lineWidth = 1.6 * u;
    for (const edge of [left, right]) {
      c.beginPath();
      for (let k = 0; k <= steps; k++) {
        const y = lerp(y0, y1, k / steps);
        if (k === 0) c.moveTo(edge(y), y); else c.lineTo(edge(y), y);
      }
      c.stroke();
    }
    c.restore();
  }

  // ---- clifftop river: flows along the plateau and tips over the edge ----------
  private drawRiver(t: number): void {
    const c = this.ctx;
    const { u, vh, off } = this;
    const y0 = this.fallTop;
    const hw = 0.03 * vh;
    if (y0 + hw < off - 20 || y0 - hw > off + vh) return; // not on screen
    const x1 = this.fallRight(y0);

    c.save();
    c.beginPath();
    c.moveTo(-10, y0 - hw);
    const n = 28;
    for (let k = 0; k <= n; k++) c.lineTo(lerp(-10, x1, k / n), y0 - hw + Math.sin(k * 1.7) * 2 * u);
    c.lineTo(x1, y0 + hw * 0.5);
    for (let k = n; k >= 0; k--) c.lineTo(lerp(-10, x1, k / n), y0 + hw + Math.sin(k * 2.3) * 2 * u);
    c.closePath();
    const g = c.createLinearGradient(0, y0 - hw, 0, y0 + hw);
    g.addColorStop(0, "rgb(108,188,214)");
    g.addColorStop(1, "rgb(138,206,226)");
    c.fillStyle = g;
    c.fill();
    c.clip();

    // ripples sliding toward the edge
    c.lineCap = "round";
    const span = x1 + 80 * u;
    for (let i = 0; i < 16; i++) {
      const sp = (50 + hash(i * 1.7) * 70) * u;
      const x = ((hash(i * 3.1) * span + t * sp) % span) - 40 * u;
      const y = y0 + (hash(i * 7.7) - 0.5) * hw * 1.5;
      const len = (20 + hash(i * 5.3) * 36) * u;
      c.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(t * 1.5 + i)})`;
      c.lineWidth = 1.6 * u;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len, y + Math.sin(t * 2 + i) * 1.5 * u);
      c.stroke();
    }
    c.restore();

    // darker outline so the river reads against the grass
    c.save();
    c.strokeStyle = "rgba(14,70,90,0.4)";
    c.lineWidth = 2.5 * u;
    c.beginPath();
    c.moveTo(-10, y0 - hw);
    for (let k = 0; k <= n; k++) c.lineTo(lerp(-10, x1, k / n), y0 - hw + Math.sin(k * 1.7) * 2 * u);
    c.stroke();
    c.restore();
  }

  // ---- pool + stream ----------------------------------------------------------
  private drawStream(t: number): void {
    const c = this.ctx;
    const u = this.u;
    const M = this.sx.length;

    c.save();
    this.tracePool(c);
    c.fillStyle = this.streamGrad;
    c.fill();
    c.clip();

    c.fillStyle = this.poolGlow;
    c.fillRect(0, 0, this.W, this.H);

    // ripples drifting downstream
    c.lineCap = "round";
    for (const r of this.ripples) {
      const s = (r.s + (t * r.speed) / this.streamLen) % 1;
      const i = Math.min(M - 1, Math.floor(s * (M - 1)));
      const off = r.l * this.shw[i];
      const px = this.sx[i] - this.sty[i] * off;
      const py = this.sy[i] + this.stx[i] * off;
      const tx = this.stx[i], ty = this.sty[i];
      const fade = Math.min(s / 0.05, 1) * Math.min((1 - s) / 0.05, 1);
      const wob = Math.sin(t * 2 + r.ph) * 3 * u;
      c.strokeStyle = `rgba(255,255,255,${0.35 * fade * (0.6 + 0.4 * Math.sin(t * 1.5 + r.ph))})`;
      c.lineWidth = 1.6 * u;
      c.beginPath();
      c.moveTo(px - tx * r.len * 0.5, py - ty * r.len * 0.5);
      c.quadraticCurveTo(px - ty * wob, py + tx * wob, px + tx * r.len * 0.5, py + ty * r.len * 0.5);
      c.stroke();
    }

    // small cascades: a white band across the stream with dashes racing downstream
    for (const i of this.cascades) {
      const ax = this.lx[i], ay = this.ly[i], bx = this.rx[i], by = this.ry[i];
      c.strokeStyle = "rgba(236,250,255,0.75)";
      c.lineWidth = 12 * u;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
      const tx = this.stx[i], ty = this.sty[i];
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.lineWidth = 2.4 * u;
      const n = 16;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        const run = ((t * 40 * u + k * 5 * u) % (22 * u)) - 8 * u;
        const px = lerp(ax, bx, f) + tx * run;
        const py = lerp(ay, by, f) + ty * run;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + tx * 8 * u, py + ty * 8 * u);
        c.stroke();
      }
    }
    c.restore();

    // shoreline shadow
    c.save();
    c.strokeStyle = "rgba(14,70,90,0.45)";
    c.lineWidth = 3 * u;
    this.tracePool(c);
    c.stroke();
    c.restore();
  }

  private drawFoamRings(t: number): void {
    const c = this.ctx;
    for (const r of this.streamRocks) {
      const k = Math.sin(t * 2 + r.x * 0.05);
      c.strokeStyle = `rgba(255,255,255,${0.55 + 0.2 * k})`;
      c.lineWidth = 2 * this.u;
      c.beginPath();
      c.ellipse(r.x, r.y + r.h * 0.35, r.w * (0.62 + 0.04 * k), r.h * (0.3 + 0.03 * k), 0, 0, TAU);
      c.stroke();
    }
  }

  // ---- mist, bubbles and spray where water lands ------------------------------
  private drawSplash(cx: number, cy: number, sc: number, t: number, seed: number): void {
    const c = this.ctx;
    const u = this.u;
    const wide = this.wfW * sc;

    // foam where the water meets the pool (also hides the bottom cut of the fall)
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.beginPath();
    c.ellipse(cx, cy, wide * 0.65 + 6 * u, 12 * u * sc + 3 * u, 0, 0, TAU);
    c.fill();

    // rising mist puffs
    for (let k = 0; k < 5; k++) {
      const ph = (t * 0.12 + k / 5 + seed * 0.37) % 1;
      const px = cx + (hash(k + seed * 7) - 0.5) * wide * 1.6;
      const py = cy - ph * 60 * u * sc;
      const r = (36 + 40 * ph) * u * sc;
      const a = 0.26 * (1 - ph) * Math.min(ph * 6, 1);
      const g = c.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(px, py, r, 0, TAU);
      c.fill();
    }

    // translucent bubble rings, like the spray in the artwork
    const nB = Math.max(3, Math.round(8 * sc));
    for (let k = 0; k < nB; k++) {
      const r = (14 + hash(k * 2.3 + seed) * 26) * u * sc * (1 + 0.05 * Math.sin(t * 2 + k));
      const bx = cx + (hash(k * 3.1 + seed) - 0.5) * wide * 1.3;
      const by = cy - hash(k * 4.7 + seed) * 22 * u * sc;
      c.fillStyle = "rgba(255,255,255,0.14)";
      c.strokeStyle = "rgba(255,255,255,0.38)";
      c.lineWidth = 1.2 * u;
      c.beginPath();
      c.arc(bx, by, r, 0, TAU);
      c.fill();
      c.stroke();
    }

    // droplets thrown up and falling back (stateless: position comes from time)
    const nD = Math.max(8, Math.round(60 * sc));
    const grav = 420 * u;
    for (let k = 0; k < nD; k++) {
      const life = 0.8 + hash(k * 1.9 + seed) * 0.8;
      const ph = (t + hash(k * 6.1 + seed) * life) % life;
      const vx = (hash(k * 2.7 + seed) - 0.5) * 120 * u * sc;
      const vy = -(90 + hash(k * 8.3 + seed) * 150) * u * sc;
      const px = cx + (hash(k * 5.3 + seed) - 0.5) * wide * 0.8 + vx * ph;
      const py = cy + vy * ph + 0.5 * grav * sc * ph * ph;
      c.fillStyle = `rgba(255,255,255,${0.85 * (1 - ph / life)})`;
      c.beginPath();
      c.arc(px, py, (1 + hash(k * 3.3) * 2) * u * Math.max(sc, 0.6), 0, TAU);
      c.fill();
    }
  }

  // ---- trees: low-poly canopies that sway ----------------------------------
  private drawTree(tr: Tree, t: number): void {
    const c = this.ctx;
    const sway = Math.sin(t * 0.9 + tr.phase) * 0.025 + Math.sin(t * 0.37 + tr.x * 0.01) * 0.012;
    c.save();
    c.translate(tr.x, tr.y);
    c.rotate(sway);
    const h = tr.h;
    // trunk (two-tone) bending slightly
    const bw = h * 0.07;
    c.fillStyle = css([112, 72, 52]);
    c.beginPath();
    c.moveTo(-bw, 0);
    c.quadraticCurveTo(tr.lean * 0.3 - bw * 0.7, -h * 0.4, tr.lean - bw * 0.4, -h * 0.8);
    c.lineTo(tr.lean + bw * 0.4, -h * 0.8);
    c.quadraticCurveTo(tr.lean * 0.3 + bw * 0.7, -h * 0.4, bw, 0);
    c.closePath();
    c.fill();
    c.fillStyle = css([82, 52, 42]);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(tr.lean * 0.3, -h * 0.4, tr.lean, -h * 0.8);
    c.lineTo(tr.lean + bw * 0.4, -h * 0.8);
    c.quadraticCurveTo(tr.lean * 0.3 + bw * 0.7, -h * 0.4, bw, 0);
    c.closePath();
    c.fill();

    // canopy blobs: faces facing the top-left (the sun side) are lighter
    for (const b of tr.blobs) {
      const bx = tr.lean + b.dx + Math.sin(t * 1.3 + tr.phase + b.dx) * h * 0.01;
      const by = -h * 0.8 + b.dy;
      const n = b.jit.length;
      const pts: [number, number][] = b.jit.map((jv, i) => {
        const a = (i / n) * TAU - Math.PI / 2;
        return [bx + Math.cos(a) * b.r * jv, by + Math.sin(a) * b.r * jv * 0.92];
      });
      const cxp = bx - b.r * 0.12, cyp = by - b.r * 0.18;
      for (let i = 0; i < n; i++) {
        const a = pts[i], d = pts[(i + 1) % n];
        const ang = ((i + 0.5) / n) * TAU - Math.PI / 2;
        const lit = (Math.cos(ang + (3 * Math.PI) / 4) + 1) / 2; // 1 when facing up-left
        const col = css(shade(mix(CANOPY.dark, CANOPY.light, lit), b.tone));
        c.fillStyle = col;
        c.strokeStyle = col;
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(cxp, cyp);
        c.lineTo(a[0], a[1]);
        c.lineTo(d[0], d[1]);
        c.closePath();
        c.fill();
        c.stroke();
      }
    }
    c.restore();
  }

  // ---- ferns ----------------------------------------------------------------
  private drawFern(f: Fern, t: number): void {
    const c = this.ctx;
    // Two passes (dark back fronds, then lighter) so each is a single fill.
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      f.fronds.forEach((fr, i) => {
        if (i % 2 !== pass) return;
        const ang = fr.ang + Math.sin(t * 1.1 + f.phase + i * 0.4) * 0.04;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        // tip droops a little
        const tipX = f.x + dx * fr.len + Math.sign(dx) * fr.len * 0.15;
        const tipY = f.y + dy * fr.len + fr.len * 0.25;
        const ctrlX = f.x + dx * fr.len * 0.6;
        const ctrlY = f.y + dy * fr.len * 0.6;
        const bez = (u: number): [number, number] => {
          const v = 1 - u;
          return [v * v * f.x + 2 * v * u * ctrlX + u * u * tipX, v * v * f.y + 2 * v * u * ctrlY + u * u * tipY];
        };
        const n = 7;
        for (let k = 1; k <= n; k++) {
          const u0 = k / (n + 1);
          const a = bez(u0), b = bez(u0 + 0.05);
          const tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1;
          const ll = fr.len * 0.24 * (1 - u0 * 0.75);
          for (const side of [-1, 1]) {
            const nx = (-ty / tl) * side, ny = (tx / tl) * side;
            c.moveTo(a[0], a[1]);
            c.lineTo(b[0], b[1]);
            c.lineTo((a[0] + b[0]) / 2 + nx * ll + (tx / tl) * ll * 0.4, (a[1] + b[1]) / 2 + ny * ll + (ty / tl) * ll * 0.4);
            c.closePath();
          }
        }
      });
      c.fillStyle = css(pass === 0 ? LEAF.dark : LEAF.mid);
      c.fill();
    }
  }

  // ---- flowers --------------------------------------------------------------
  private drawFlower(f: Flower, t: number): void {
    const c = this.ctx;
    const sway = Math.sin(t * f.speed + f.phase) * 0.06 + Math.sin(t * 0.45 + f.x * 0.004) * 0.03;
    const r = f.r;

    c.save();
    c.translate(f.x, f.y);
    c.rotate(sway);

    // two leaves near the base
    c.fillStyle = css(shade(LEAF.mid, f.leafTone));
    for (const dir of [-0.9, -(Math.PI - 0.9)]) {
      c.save();
      c.translate(0, -f.h * 0.12);
      c.rotate(dir);
      c.beginPath();
      c.ellipse(r * 0.7, 0, r * 0.85, r * 0.2, 0, 0, TAU);
      c.fill();
      c.restore();
    }

    // stem (a gentle curve ending at the flower head)
    c.strokeStyle = css(shade(LEAF.dark, f.leafTone));
    c.lineWidth = Math.max(1.5, r * 0.14);
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(f.lean * 0.15, -f.h * 0.55, f.lean, -f.h);
    c.stroke();

    if (f.kind === "lupine") {
      this.drawLupine(f);
    } else if (f.kind === "bluebell") {
      this.drawBluebell(f);
    } else {
      // round flower heads, tilted a little and squashed for perspective
      c.translate(f.lean, -f.h);
      c.rotate(f.tilt - sway * 1.2);
      c.scale(1, 0.82);
      this.drawHead(f);
    }
    c.restore();
  }

  /** Daisy / buttercup / pink bloom / aster heads. */
  private drawHead(f: Flower): void {
    const c = this.ctx;
    const r = f.r;
    const n = f.petals;
    const step = TAU / n;
    c.fillStyle = f.pal[0];
    c.save();
    for (let i = 0; i < n; i++) {
      c.beginPath();
      if (f.kind === "daisy") c.ellipse(r * 0.62, 0, r * 0.42, r * 0.14, 0, 0, TAU);       // long thin petals
      else if (f.kind === "aster") c.ellipse(r * 0.58, 0, r * 0.45, r * 0.1, 0, 0, TAU);    // finer petals
      else c.ellipse(r * 0.5, 0, r * 0.5, r * 0.46, 0, 0, TAU);                              // round petals
      c.fill();
      c.rotate(step);
    }
    c.restore();
    // lighter glow in the middle of the petals makes the colour look lit
    c.fillStyle = f.pal[1];
    c.globalAlpha = 0.55;
    c.beginPath();
    c.arc(0, 0, r * 0.6, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
    // centre
    c.fillStyle = f.kind === "pink" || f.kind === "buttercup" ? "#ff9d00" : "#ffc800";
    c.beginPath();
    c.arc(0, 0, r * (f.kind === "daisy" ? 0.3 : 0.2), 0, TAU);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.arc(-r * 0.06, -r * 0.06, r * 0.08, 0, TAU);
    c.fill();
  }

  /** Tall spike of florets that shrink toward the tip. Called in the stem's frame. */
  private drawLupine(f: Flower): void {
    const c = this.ctx;
    const n = 9;
    // base leaflets fan out near the ground
    c.fillStyle = css(shade(LEAF.mid, f.leafTone));
    for (let k = 0; k < 7; k++) {
      c.save();
      c.rotate(-Math.PI + 0.35 + (k / 6) * (Math.PI - 0.7));
      c.beginPath();
      c.ellipse(f.r * 0.9, 0, f.r * 0.95, f.r * 0.14, 0, 0, TAU);
      c.fill();
      c.restore();
    }
    const dark = hexToRgb(f.pal[0]), light = hexToRgb(f.pal[1]);
    for (let i = 0; i < n; i++) {
      const v = 0.3 + 0.7 * (i / (n - 1)); // position along the stem
      const w = 1 - v;
      const px = 2 * w * v * f.lean * 0.15 + v * v * f.lean;
      const py = 2 * w * v * (-f.h * 0.55) + v * v * -f.h;
      const fs = f.r * (0.62 - 0.32 * (i / (n - 1)));
      c.fillStyle = css(mix(dark, light, (i / (n - 1)) * 0.7));
      c.beginPath();
      c.ellipse(px - fs * 0.55, py, fs * 0.6, fs * 0.45, -0.3, 0, TAU);
      c.ellipse(px + fs * 0.55, py, fs * 0.6, fs * 0.45, 0.3, 0, TAU);
      c.fill();
    }
    c.fillStyle = css(light);
    c.beginPath();
    c.ellipse(f.lean, -f.h, f.r * 0.16, f.r * 0.26, 0, 0, TAU);
    c.fill();
  }

  /** Drooping bells hanging from an arched stem. Called in the stem's frame. */
  private drawBluebell(f: Flower): void {
    const c = this.ctx;
    const b = f.r * 0.55;
    for (const v of [0.55, 0.72, 0.88, 1]) {
      const w = 1 - v;
      const px = 2 * w * v * f.lean * 0.15 + v * v * f.lean;
      const py = 2 * w * v * (-f.h * 0.55) + v * v * -f.h;
      // small stalk, then the bell
      c.strokeStyle = css(LEAF.dark);
      c.lineWidth = Math.max(1, b * 0.15);
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px, py + b * 0.3);
      c.stroke();
      c.save();
      c.translate(px, py + b * 0.3);
      c.fillStyle = f.pal[0];
      c.beginPath();
      c.moveTo(-b * 0.28, 0);
      c.quadraticCurveTo(-b * 0.35, b * 0.7, -b * 0.7, b * 1.1);
      c.quadraticCurveTo(0, b * 1.35, b * 0.7, b * 1.1);
      c.quadraticCurveTo(b * 0.35, b * 0.7, b * 0.28, 0);
      c.closePath();
      c.fill();
      c.fillStyle = f.pal[1];
      c.globalAlpha = 0.7;
      c.beginPath();
      c.ellipse(0, b * 1.12, b * 0.5, b * 0.14, 0, 0, TAU);
      c.fill();
      c.restore();
    }
  }

  // ---- floating pollen / seed motes ---------------------------------------
  private drawMotes(t: number): void {
    const c = this.ctx;
    const { W, u, vh, off } = this;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const cycle = 18 + hash(i * 1.3) * 14;
      const ph = ((t + hash(i * 2.9) * cycle) % cycle) / cycle;
      const x = ((hash(i * 4.1) + Math.sin(t * 0.2 + i) * 0.03 + ph * 0.08) % 1) * W;
      const y = off + vh * (1.0 - ph * 0.55); // always rises through the visible slice
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 2);
      c.fillStyle = `rgba(255,252,210,${0.55 * tw * Math.min(ph * 8, 1) * (1 - ph)})`;
      c.beginPath();
      c.arc(x, y, (1.4 + hash(i) * 1.8) * u, 0, TAU);
      c.fill();
    }
  }

  // ---- light shafts + soft vignette ---------------------------------------------
  private drawLight(t: number): void {
    const c = this.ctx;
    const { W, H, u, vh, off, dpr } = this;
    c.save();
    c.globalCompositeOperation = "screen";

    // Light shafts are drawn relative to the visible slice so they look the same in every region.
    c.translate(0, off);
    const shafts = [
      { x: 0.5, w: 0.1, ph: 0 },
      { x: 0.66, w: 0.07, ph: 2 },
      { x: 0.82, w: 0.12, ph: 4 },
    ];
    for (const s of shafts) {
      const a = 0.09 + 0.05 * Math.sin(t * 0.25 + s.ph);
      const x0 = s.x * W + Math.sin(t * 0.07 + s.ph) * 30 * u;
      const wd = s.w * W;
      c.save();
      c.transform(1, 0, -0.55, 1, 0, 0); // slant down-left, away from the sun
      const g = c.createLinearGradient(x0, 0, x0 + wd, 0);
      g.addColorStop(0, "rgba(255,248,215,0)");
      g.addColorStop(0.5, `rgba(255,248,215,${a})`);
      g.addColorStop(1, "rgba(255,248,215,0)");
      c.fillStyle = g;
      c.fillRect(x0, 0, wd, vh);
      c.restore();
    }
    c.translate(0, -off);

    // sun bloom that breathes slowly (world coordinates: only the top slice sees the sun)
    const bloom = c.createRadialGradient(W * 0.88, -H * 0.05, 0, W * 0.88, -H * 0.05, W * 0.45);
    bloom.addColorStop(0, `rgba(255,236,170,${0.22 + 0.06 * Math.sin(t * 0.3)})`);
    bloom.addColorStop(1, "rgba(255,236,170,0)");
    c.fillStyle = bloom;
    c.fillRect(0, 0, W, H);
    c.restore();

    // gentle vignette (screen space) keeps the corners calm so page content stays readable
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = c.createRadialGradient(W / 2, vh / 2, Math.min(W, vh) * 0.45, W / 2, vh / 2, Math.max(W, vh) * 0.75);
    v.addColorStop(0, "rgba(8,32,40,0)");
    v.addColorStop(1, "rgba(8,32,40,0.28)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, vh);
  }
}

// "#rrggbb" -> RGB
function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ===========================================================================
// Convenience: full-page background
// ===========================================================================
export interface BackgroundOptions {
  container?: HTMLElement; // where to put the canvas (default: document.body)
  seed?: number;           // terrain seed
  region?: Region;         // "full" (default) or "top" | "middle" | "bottom" slice
  zIndex?: number;         // default -1 (behind everything)
}

export function mountWaterfallBackground(options: BackgroundOptions = {}): { scene: WaterfallScene; destroy: () => void } {
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: String(options.zIndex ?? -1),
    pointerEvents: "none", // clicks pass through to your page
  });
  (options.container ?? document.body).prepend(canvas);
  const scene = new WaterfallScene(canvas, options.seed ?? 7, options.region ?? "full");
  scene.start();
  return {
    scene,
    destroy: () => {
      scene.stop();
      canvas.remove();
    },
  };
}