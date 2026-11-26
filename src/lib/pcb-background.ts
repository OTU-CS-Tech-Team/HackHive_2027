/**
 * pcb-background.ts
 *
 * A procedurally generated PCB drawn on a <canvas>, with glowing signal
 * pulses travelling along the copper traces. No dependencies.
 *
 * Usage:
 *   import { PCBBackground } from "./pcb-background";
 *   const bg = new PCBBackground(document.body);   // fixed, behind your UI
 *   // bg.pause(); bg.resume(); bg.destroy();
 */

export interface PCBColors {
  board: string;
  trace: string;
  traceHighlight: string;
  pad: string;
  chip: string;
  chipEdge: string;
  pin: string;
  signal: string;
}

export interface PCBBackgroundOptions {
  /** Grid cell size in CSS px. Smaller = denser routing. Default 14. */
  cell?: number;
  /** Trace width in CSS px. Default 2. */
  traceWidth?: number;
  /** 0..1 amount of free-routed traces. Default 0.6. */
  density?: number;
  /** Number of simultaneous pulses. Default scales with screen area. */
  signals?: number;
  /** Pulse speed in px/s. Default 150. */
  speed?: number;
  /** Pulse tail length in px. Default 100. */
  tailLength?: number;
  /** Seed for a repeatable layout. Default 7. */
  seed?: number;
  /** Override any of the colors (hex strings). */
  colors?: Partial<PCBColors>;
  /** Draw a static board only when the OS asks for reduced motion. Default true. */
  respectReducedMotion?: boolean;
}

const DEFAULT_COLORS: PCBColors = {
  board: "#07130f",
  trace: "#0e5a45",
  traceHighlight: "#1f8a6a",
  pad: "#127556",
  chip: "#0b1b16",
  chipEdge: "#1b4a3b",
  pin: "#2f7d63",
  signal: "#5dffc4",
};

type Pt = { x: number; y: number };

interface Trace {
  pts: Pt[];
  cum: number[]; // cumulative length at each point
  total: number;
}

interface Pad {
  x: number;
  y: number;
  via: boolean;
}

interface Chip {
  x: number;
  y: number;
  w: number;
  h: number;
  pins: Pt[];
}

interface Layout {
  traces: Trace[];
  pads: Pad[];
  chips: Chip[];
}

interface Signal {
  trace: Trace;
  dist: number; // distance travelled along the trace (can start negative = delay)
  dir: 1 | -1;
  speed: number;
  tail: number;
}

// 8 directions, clockwise from east. Even = orthogonal, odd = 45° diagonal.
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeTrace(pts: Pt[]): Trace {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, cum, total: cum[cum.length - 1] };
}

function pointAt(trace: Trace, d: number): Pt {
  const { pts, cum, total } = trace;
  if (d <= 0) return pts[0];
  if (d >= total) return pts[pts.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const segLen = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / segLen;
  return {
    x: pts[lo].x + (pts[hi].x - pts[lo].x) * t,
    y: pts[lo].y + (pts[hi].y - pts[lo].y) * t,
  };
}

/* -------------------------------------------------------------------------- */
/*                                Layout builder                              */
/* -------------------------------------------------------------------------- */

function buildLayout(
  w: number,
  h: number,
  cell: number,
  density: number,
  rand: () => number
): Layout {
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  // 0 = empty, -1 = chip body, >0 = trace id
  const grid = new Int16Array(cols * rows);
  const idx = (x: number, y: number) => y * cols + x;
  const center = (x: number, y: number): Pt => ({ x: (x + 0.5) * cell, y: (y + 0.5) * cell });
  const inBounds = (x: number, y: number) => x >= 1 && y >= 1 && x < cols - 1 && y < rows - 1;

  const traces: Trace[] = [];
  const pads: Pad[] = [];
  const chips: Chip[] = [];
  let nextId = 1;

  // A cell is enterable if it's empty and has no foreign trace in its 8
  // neighbours (keeps clearance and prevents diagonal crossings). Chip
  // bodies may be adjacent so pin escape routes work.
  const canEnter = (x: number, y: number, id: number, recent: number[]): boolean => {
    if (!inBounds(x, y)) return false;
    if (grid[idx(x, y)] !== 0) return false;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const i = idx(x + ox, y + oy);
        const v = grid[i];
        if (v > 0 && !(v === id && recent.includes(i))) return false;
      }
    }
    return true;
  };

  const walk = (
    sx: number,
    sy: number,
    dir0: number,
    minLen: number,
    maxLen: number,
    prefix?: Pt
  ): { trace: Trace; end: Pt } | null => {
    const id = nextId;
    if (!canEnter(sx, sy, id, [])) return null;

    const cells: number[] = [idx(sx, sy)];
    grid[cells[0]] = id;

    const pts: Pt[] = [];
    const push = (p: Pt) => {
      const last = pts[pts.length - 1];
      if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) pts.push(p);
    };
    if (prefix) push(prefix);
    push(center(sx, sy));

    let x = sx;
    let y = sy;
    let dir = dir0;
    let run = 0;

    while (cells.length < maxLen) {
      const wantTurn = run >= 3 && rand() < 0.18;
      const s = rand() < 0.5 ? 1 : -1;
      const order = wantTurn ? [s, 0, -s] : [0, s, -s];
      let moved = false;
      for (const o of order) {
        const nd = (dir + o + 8) % 8;
        const nx = x + DIRS[nd][0];
        const ny = y + DIRS[nd][1];
        if (!canEnter(nx, ny, id, cells.slice(-3))) continue;
        if (nd !== dir) {
          push(center(x, y));
          dir = nd;
          run = 0;
        }
        x = nx;
        y = ny;
        const i = idx(x, y);
        cells.push(i);
        grid[i] = id;
        run++;
        moved = true;
        break;
      }
      if (!moved) break;
    }
    push(center(x, y));

    if (cells.length < minLen || pts.length < 2) {
      for (const c of cells) grid[c] = 0;
      return null;
    }
    nextId++;
    const trace = makeTrace(pts);
    traces.push(trace);
    return { trace, end: pts[pts.length - 1] };
  };

  // --- Chips ---------------------------------------------------------------
  const chipCount = Math.max(1, Math.min(8, Math.round((cols * rows) / 1100)));
  for (let attempt = 0; attempt < chipCount * 12 && chips.length < chipCount; attempt++) {
    const cw = 5 + Math.floor(rand() * 5);
    const ch = 5 + Math.floor(rand() * 4);
    const cx0 = 5 + Math.floor(rand() * Math.max(1, cols - cw - 10));
    const cy0 = 5 + Math.floor(rand() * Math.max(1, rows - ch - 10));
    if (cx0 + cw + 5 >= cols || cy0 + ch + 5 >= rows) continue;

    let clear = true;
    for (let y = cy0 - 3; y < cy0 + ch + 3 && clear; y++)
      for (let x = cx0 - 3; x < cx0 + cw + 3; x++)
        if (grid[idx(x, y)] !== 0) {
          clear = false;
          break;
        }
    if (!clear) continue;

    for (let y = cy0; y < cy0 + ch; y++) for (let x = cx0; x < cx0 + cw; x++) grid[idx(x, y)] = -1;

    const pinDefs: Array<{ ex: number; ey: number; dir: number; pin: Pt }> = [];
    for (let i = 1; i < cw - 1; i += 2) {
      const px = cx0 + i;
      pinDefs.push({ ex: px, ey: cy0 - 1, dir: 6, pin: { x: (px + 0.5) * cell, y: cy0 * cell } });
      pinDefs.push({ ex: px, ey: cy0 + ch, dir: 2, pin: { x: (px + 0.5) * cell, y: (cy0 + ch) * cell } });
    }
    for (let j = 1; j < ch - 1; j += 2) {
      const py = cy0 + j;
      pinDefs.push({ ex: cx0 - 1, ey: py, dir: 4, pin: { x: cx0 * cell, y: (py + 0.5) * cell } });
      pinDefs.push({ ex: cx0 + cw, ey: py, dir: 0, pin: { x: (cx0 + cw) * cell, y: (py + 0.5) * cell } });
    }

    const chip: Chip = { x: cx0 * cell, y: cy0 * cell, w: cw * cell, h: ch * cell, pins: [] };
    for (const p of pinDefs) {
      chip.pins.push(p.pin);
      if (rand() < 0.75) {
        const res = walk(p.ex, p.ey, p.dir, 6, 20 + Math.floor(rand() * 60), p.pin);
        if (res) pads.push({ x: res.end.x, y: res.end.y, via: rand() < 0.55 });
      }
    }
    chips.push(chip);
  }

  // --- Free-routed traces --------------------------------------------------
  const attempts = Math.floor((cols * rows * density) / 30);
  for (let a = 0; a < attempts; a++) {
    const sx = 1 + Math.floor(rand() * (cols - 2));
    const sy = 1 + Math.floor(rand() * (rows - 2));
    const dir = rand() < 0.7 ? 2 * Math.floor(rand() * 4) : 1 + 2 * Math.floor(rand() * 4);
    const res = walk(sx, sy, dir, 8, 25 + Math.floor(rand() * 70));
    if (res) {
      const start = res.trace.pts[0];
      pads.push({ x: start.x, y: start.y, via: rand() < 0.4 });
      pads.push({ x: res.end.x, y: res.end.y, via: rand() < 0.5 });
    }
  }

  return { traces, pads, chips };
}

/* -------------------------------------------------------------------------- */
/*                                  Renderer                                  */
/* -------------------------------------------------------------------------- */

export class PCBBackground {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly staticLayer: HTMLCanvasElement;
  private readonly opts: Required<Omit<PCBBackgroundOptions, "colors">>;
  private readonly colors: PCBColors;
  private readonly signalRgb: [number, number, number];

  private layout: Layout = { traces: [], pads: [], chips: [] };
  private signals: Signal[] = [];
  private rand: () => number;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private raf = 0;
  private lastT = 0;
  private running = false;
  private reduced = false;
  private resizeTimer = 0;
  private ro?: ResizeObserver;

  constructor(container: HTMLElement = document.body, options: PCBBackgroundOptions = {}) {
    this.container = container;
    this.colors = { ...DEFAULT_COLORS, ...(options.colors ?? {}) };
    this.signalRgb = hexToRgb(this.colors.signal);
    this.opts = {
      cell: options.cell ?? 14,
      traceWidth: options.traceWidth ?? 2,
      density: options.density ?? 0.6,
      signals: options.signals ?? 0,
      speed: options.speed ?? 150,
      tailLength: options.tailLength ?? 100,
      seed: options.seed ?? 7,
      respectReducedMotion: options.respectReducedMotion ?? true,
    };
    this.rand = mulberry32(this.opts.seed);

    const isBody = container === document.body;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText = [
      `position:${isBody ? "fixed" : "absolute"}`,
      "inset:0",
      "width:100%",
      "height:100%",
      "pointer-events:none",
      "z-index:-1",
    ].join(";");
    if (!isBody && getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }
    container.prepend(this.canvas);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("PCBBackground: 2D canvas not supported");
    this.ctx = ctx;
    this.staticLayer = document.createElement("canvas");

    this.reduced =
      this.opts.respectReducedMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.resize();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    if (!isBody && typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(this.onResize);
      this.ro.observe(container);
    }
    this.resume();
  }

  /** Start / continue the animation. */
  resume(): void {
    if (this.running || this.reduced) return;
    this.running = true;
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Pause the animation (the board stays visible). */
  pause(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Remove the canvas and all listeners. */
  destroy(): void {
    this.pause();
    window.clearTimeout(this.resizeTimer);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ro?.disconnect();
    this.canvas.remove();
  }

  /* ------------------------------ internals ------------------------------ */

  private onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 150);
  };

  private onVisibility = (): void => {
    if (document.hidden) this.pause();
    else this.resume();
  };

  private resize(): void {
    const isBody = this.container === document.body;
    const w = Math.max(1, isBody ? window.innerWidth : this.container.clientWidth);
    const h = Math.max(1, isBody ? window.innerHeight : this.container.clientHeight);
    this.width = w;
    this.height = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    for (const c of [this.canvas, this.staticLayer]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
    }
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";

    this.rand = mulberry32(this.opts.seed);
    this.layout = buildLayout(w, h, this.opts.cell, this.opts.density, this.rand);
    this.paintStatic();

    const count =
      this.opts.signals > 0
        ? this.opts.signals
        : Math.max(4, Math.min(40, Math.round((w * h) / 70000)));
    this.signals = [];
    for (let i = 0; i < count; i++) {
      const s = this.spawn();
      if (s) this.signals.push(s);
    }

    if (this.reduced) this.drawFrame();
  }

  private spawn(): Signal | null {
    const { traces } = this.layout;
    if (!traces.length) return null;
    const trace = traces[Math.floor(this.rand() * traces.length)];
    const jitter = 0.7 + this.rand() * 0.6;
    const speed = this.opts.speed * jitter;
    return {
      trace,
      dir: this.rand() < 0.5 ? 1 : -1,
      speed,
      tail: this.opts.tailLength * (0.7 + this.rand() * 0.6),
      dist: -this.rand() * speed * 3, // staggered start
    };
  }

  /** Draw board, traces, pads and chips once into an offscreen layer. */
  private paintStatic(): void {
    const ctx = this.staticLayer.getContext("2d");
    if (!ctx) return;
    const { colors, opts, width, height, dpr } = this;
    const tw = opts.traceWidth;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = colors.board;
    ctx.fillRect(0, 0, width, height);

    // soft vignette so UI content in the middle stays readable
    const vg = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.2,
      width / 2, height / 2, Math.hypot(width, height) * 0.6
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.45)");

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const strokeAll = (style: string, lw: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (const t of this.layout.traces) {
        ctx.moveTo(t.pts[0].x, t.pts[0].y);
        for (let i = 1; i < t.pts.length; i++) ctx.lineTo(t.pts[i].x, t.pts[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    strokeAll(colors.trace, tw);
    strokeAll(colors.traceHighlight, Math.max(0.6, tw * 0.35), 0.35);

    // pads & vias
    for (const p of this.layout.pads) {
      ctx.fillStyle = colors.pad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, tw * (p.via ? 2.2 : 1.6), 0, Math.PI * 2);
      ctx.fill();
      if (p.via) {
        ctx.fillStyle = colors.board;
        ctx.beginPath();
        ctx.arc(p.x, p.y, tw * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // chips
    for (const c of this.layout.chips) {
      ctx.fillStyle = colors.pin;
      const ps = this.opts.cell * 0.5;
      for (const p of c.pins) ctx.fillRect(p.x - ps / 2, p.y - ps / 2, ps, ps);

      ctx.fillStyle = colors.chip;
      ctx.strokeStyle = colors.chipEdge;
      ctx.lineWidth = 1.5;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeRect(c.x + 0.75, c.y + 0.75, c.w - 1.5, c.h - 1.5);

      ctx.fillStyle = colors.chipEdge;
      ctx.beginPath();
      ctx.arc(c.x + this.opts.cell * 0.9, c.y + this.opts.cell * 0.9, this.opts.cell * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;

    for (let i = 0; i < this.signals.length; i++) {
      const s = this.signals[i];
      s.dist += s.speed * dt;
      if (s.dist - s.tail > s.trace.total) {
        const n = this.spawn();
        if (n) {
          n.dist = -this.rand() * n.speed * 1.5;
          this.signals[i] = n;
        }
      }
    }
    this.drawFrame();
    this.raf = requestAnimationFrame(this.frame);
  };

  private drawFrame(): void {
    const { ctx, dpr, width, height, opts } = this;
    const [r, g, b] = this.signalRgb;
    const tw = opts.traceWidth;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.staticLayer, 0, 0, width, height);
    if (this.reduced) return;

    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const STEPS = 10;
    for (const s of this.signals) {
      const { trace, dir } = s;
      const total = trace.total;
      if (s.dist < 0 || s.dist - s.tail > total) continue;

      // position along the *geometry* given travel direction
      const at = (d: number): Pt => pointAt(trace, dir === 1 ? d : total - d);
      const clamp = (d: number) => Math.max(0, Math.min(total, d));

      // fading tail
      for (let i = 0; i < STEPS; i++) {
        const d0 = clamp(s.dist - (s.tail * i) / STEPS);
        const d1 = clamp(s.dist - (s.tail * (i + 1)) / STEPS);
        if (d0 === d1) continue;
        const a = Math.pow(1 - i / STEPS, 1.6);
        const p0 = at(d0);
        const p1 = at(d1);
        ctx.strokeStyle = `rgba(${r},${g},${b},${(a * 0.9).toFixed(3)})`;
        ctx.lineWidth = tw * (1.1 + a * 0.5);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }

      // glowing head
      if (s.dist <= total) {
        const h = at(s.dist);
        const rad = tw * 6;
        const grad = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, rad);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
        grad.addColorStop(0.35, `rgba(${r},${g},${b},0.35)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(h.x, h.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
