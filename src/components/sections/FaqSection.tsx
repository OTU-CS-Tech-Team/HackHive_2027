"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./faqSection.css";

// The same address as CLUB_EMAIL on the CS Club website.
const CLUB_EMAIL = "otu.csclub@gmail.com";
const CONTACT_SUBJECT = "Hackhive 2027 question";

// Clicking the address opens Gmail's compose window with the address and subject
// filled in. A mailto: link does nothing for the many people with no email app set
// up, so this is more reliable. The copy button covers everyone else.
const GMAIL_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CLUB_EMAIL)}&su=${encodeURIComponent(CONTACT_SUBJECT)}`;

function ContactLine() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CLUB_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the address is still on screen to copy by hand.
    }
  };

  return (
    <div className="faq-contact">
      <p>
        <span>
          Have more questions? Email us at{" "}
          <a href={GMAIL_URL} target="_blank" rel="noopener noreferrer">
            {CLUB_EMAIL}
          </a>
        </span>
        <button type="button" onClick={copy}>
          {copied ? "Copied!" : "Copy email"}
        </button>
      </p>
      <span className="sr-only" aria-live="polite">
        {copied ? "Email address copied" : ""}
      </span>
    </div>
  );
}

type Faq = {
  question: string;
  answer: string;
};

const faqs: Faq[] = [
  {
    question: "Do I need to be experienced to join?",
    answer: "First-time hackers are welcome, you do not need previous experience to join.",
  },
  {
    question: "Do I need to be an Ontario Tech student?",
    answer: "Nope, we encourage students from all colleges/universities to apply.",
  },
  {
    question: "If I have graduated university, can I participate?",
    answer:
      "Unfortunately no, you can only participate if you have not yet graduated from university but are studying as a student.",
  },
  {
    question: "Do I need to be in-person for the event?",
    answer:
      "Yes, every team member needs to have attended at least one of the days in-person. Each team additionally needs to have at least one team member present for the opening ceremony and closing ceremony.",
  },
  {
    question: "I have dietary restrictions or allergies, will there be accommodations?",
    answer:
      "We try our best to accommodate everyone's dietary restrictions and allergies, please make sure to include it when you register!",
  },
  {
    question: "How many people can I have on my team?",
    answer: "The maximum amount of team members for this challenge is 4, so that's 3 other team members including you!",
  },
];

// The amber hexes clinging to the cards. There are only a couple for the whole
// section, on opposite corners of the grid, so they don't compete with the questions.
// Numbers are in hex widths from the card's edge (negative hangs off it); strings are
// used as-is. `size` scales a hex, and `melt` ones sit on the bottom edge and melt
// away when the answer opens beneath them.
type HexSpot = {
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  size?: number;
  melt?: boolean;
};

// Keyed by the card's position in the list; cards not listed get none.
const HEX_LAYOUTS: Record<number, HexSpot[]> = {
  // One big hex on the first card's top-left corner.
  0: [{ top: -0.55, left: -0.45, size: 1.25 }],
  // And one on the last card's bottom-right corner.
  5: [{ bottom: -0.45, right: -0.4, melt: true }],
};

// Numbers become multiples of the card's hex size.
const cellOffset = (value?: number | string) =>
  typeof value === "number" ? `calc(var(--cell) * ${value})` : value;

function hexStyle({ top, bottom, left, right, size = 1 }: HexSpot) {
  return {
    top: cellOffset(top),
    bottom: cellOffset(bottom),
    left: cellOffset(left),
    right: cellOffset(right),
    "--size": size,
  } as CSSProperties;
}

// The honey drips on each card, so no two cards drip alike. Each runs down the left
// or right edge from the top of the bar: `inset` and `width` are in rem and keep it
// within the card's edge (inset + width stays under 1.2rem, clear of the question,
// the +/- and the text box), `length` is a percentage of the open card, and `delay`
// is how long after opening it starts to ooze.
type DripSpot = {
  side: "left" | "right";
  inset: number;
  width: number;
  length: number;
  delay: number;
};

const DRIP_LAYOUTS: DripSpot[][] = [
  [
    { side: "right", inset: 0.4, width: 0.8, length: 72, delay: 150 },
    { side: "left", inset: 0.45, width: 0.7, length: 45, delay: 350 },
  ],
  [
    { side: "left", inset: 0.35, width: 0.85, length: 82, delay: 100 },
    { side: "right", inset: 0.5, width: 0.6, length: 30, delay: 450 },
  ],
  [{ side: "right", inset: 0.3, width: 0.9, length: 88, delay: 200 }],
  [
    { side: "left", inset: 0.25, width: 0.95, length: 58, delay: 250 },
    { side: "right", inset: 0.25, width: 0.95, length: 40, delay: 100 },
  ],
  [
    { side: "left", inset: 0.5, width: 0.6, length: 28, delay: 400 },
    { side: "right", inset: 0.45, width: 0.65, length: 92, delay: 150 },
  ],
  [{ side: "left", inset: 0.4, width: 0.75, length: 68, delay: 200 }],
];

function dripStyle({ side, inset, width, length, delay }: DripSpot) {
  return {
    [side]: `${inset}rem`,
    "--w": `${width}rem`,
    "--len": `${length}%`,
    "--delay": `${delay}ms`,
  } as CSSProperties;
}

// A question bar with amber hexes clinging to its edges. Opening it slides out a
// framed answer panel underneath, with honey dripping from the top down its sides.
function FaqItem({
  question,
  answer,
  id,
  hexes,
  drips,
  boot,
}: Faq & { id: string; hexes: HexSpot[]; drips: DripSpot[]; boot: CSSProperties }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="faq-item" data-open={open} style={boot}>
      <div className="faq-bar">
        <span className="faq-hexes" aria-hidden>
          {hexes.map((spot, i) => (
            <span key={i} data-melt={spot.melt} style={hexStyle(spot)} />
          ))}
        </span>
        <h3>
          <button
            type="button"
            className="faq-question"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
          >
            {/* Like the answers: every other question, invisible, in the same spot,
                so all the bars are as tall as the longest question. */}
            <span className="faq-question-text">
              {faqs.map(
                (faq) =>
                  faq.question !== question && (
                    <span key={faq.question} className="faq-sizer" aria-hidden>
                      {faq.question}
                    </span>
                  ),
              )}
              <span>{question}</span>
            </span>
            <span className="faq-icon" aria-hidden>
              {open ? "−" : "+"}
            </span>
          </button>
        </h3>
      </div>
      <div id={id} className="faq-answer" role="region" aria-hidden={!open}>
        <div>
          <div className="faq-panel">
            <p>
              {/* Every other answer, invisible, in the same spot as this one, so all
                  the panels are as tall as the longest answer at any width. */}
              {faqs.map(
                (faq) =>
                  faq.answer !== answer && (
                    <span key={faq.question} className="faq-sizer" aria-hidden>
                      {faq.answer}
                    </span>
                  ),
              )}
              <span>{answer}</span>
            </p>
          </div>
        </div>
      </div>
      <span className="faq-drips" aria-hidden>
        {drips.map((spot, i) => (
          <span key={i} style={dripStyle(spot)} />
        ))}
      </span>
    </div>
  );
}

// The hive ------------------------------------------------------------------------

// A stream of honey-coloured light flowing across the section, like the PS3's wave
// backdrop: four translucent sheets, bundled together, that fold over as they go.
// Each is a smooth veil, brighter toward its rims and glowing where it turns
// edge-on, drawn small and blurred on one canvas so it stays soft; its rims and the
// tiny hexes drifting around it like dust are drawn crisp on another over it. The stream leans gently
// toward the cursor. Additive blending makes the sheets brighten where they cross.
// It only animates while on screen, and holds still for reduced motion.
type Sheet = {
  y: number; // centre line, as a fraction of the screen's height
  amp: number;
  k: number; // how tightly it waves
  speed: number;
  spread: number; // half its width where it faces you
  twist: number; // how often it folds over
  twistSpeed: number;
  phase: number;
  color: "honey" | "honeyLight" | "hiveYellow";
};

const SHEETS: Sheet[] = [
  { y: 0.47, amp: 70, k: 0.0019, speed: 0.26, spread: 80, twist: 0.0026, twistSpeed: 0.32, phase: 0, color: "honeyLight" },
  { y: 0.53, amp: 55, k: 0.0024, speed: -0.2, spread: 60, twist: 0.0021, twistSpeed: -0.27, phase: 2.2, color: "hiveYellow" },
  { y: 0.49, amp: 62, k: 0.0016, speed: 0.18, spread: 50, twist: 0.003, twistSpeed: -0.22, phase: 4.1, color: "honey" },
  { y: 0.51, amp: 48, k: 0.0029, speed: -0.31, spread: 70, twist: 0.0018, twistSpeed: 0.25, phase: 5.3, color: "honeyLight" },
];

const DUST = 70;
const STREAKS = 16; // the streaks of light falling out of the fade into the stream
const DROPS = 28; // and the little hexes falling with them
const STEP = 8;
const SOFT_SCALE = 0.5; // the veils are drawn at half size, then blurred up

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}

// "#rrggbb" to its channels, so the colour can be given any opacity.
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

function HexStream() {
  const softRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);
  const fallingRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const softCanvas = softRef.current;
    const sharpCanvas = sharpRef.current;
    const fallingCanvas = fallingRef.current;
    const view = viewRef.current;
    const section = view?.closest("section");
    const grid = section?.querySelector<HTMLElement>(".faq-grid");
    const soft = softCanvas?.getContext("2d");
    const sharp = sharpCanvas?.getContext("2d");
    const falling = fallingCanvas?.getContext("2d");
    if (!softCanvas || !sharpCanvas || !fallingCanvas || !view || !section || !grid || !soft || !sharp || !falling) return;

    // The cards' colours, from the section's custom properties.
    const css = getComputedStyle(section);
    const palette = {
      honey: css.getPropertyValue("--honey").trim(),
      honeyLight: css.getPropertyValue("--honey-light").trim(),
      hiveYellow: css.getPropertyValue("--hive-yellow").trim(),
    };
    const rgb = {
      honey: channels(palette.honey),
      honeyLight: channels(palette.honeyLight),
      hiveYellow: channels(palette.hiveYellow),
    };

    // The dust: where along the stream it is, how far out from the sheet, and how it drifts.
    const dust = Array.from({ length: DUST }, () => ({
      sheet: Math.floor(Math.random() * SHEETS.length),
      u: Math.random(),
      v: (Math.random() * 2 - 1) * 1.6,
      lift: (Math.random() - 0.5) * 40,
      size: 1.2 + Math.random() * 2.3,
      drift: 0.004 + Math.random() * 0.012,
      twinkle: Math.random() * Math.PI * 2,
    }));

    // What falls out of the fade above the section into the stream: each starts at
    // `x` (a fraction of the width), falls to one sheet's centre line, and bends into
    // its flow by `bend` pixels as it joins. `offset` staggers them, `speed` is in
    // trips a second, and a streak trails `len` of its trip behind it.
    const faller = () => ({
      sheet: Math.floor(Math.random() * SHEETS.length),
      x: Math.random(),
      bend: 60 + Math.random() * 160,
      offset: Math.random(),
      speed: 0.09 + Math.random() * 0.08,
    });
    const streaks = Array.from({ length: STREAKS }, () => ({
      ...faller(),
      len: 0.2 + Math.random() * 0.25,
      width: 0.8 + Math.random() * 1.1,
    }));
    const drops = Array.from({ length: DROPS }, () => ({
      ...faller(),
      size: 1.6 + Math.random() * 2.6,
      sway: (Math.random() - 0.5) * 30,
      spin: (Math.random() - 0.5) * 2,
    }));
    let fadeHeight = 0;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, target: 0 };
    let width = 0;
    let height = 0;
    let frame = 0;
    let onScreen = false;
    let lastT = 0;
    // The stream runs through the middle of the questions and scrolls with them,
    // though its canvases stay pinned to the screen: `anchor` is where the middle
    // of the grid is on them this frame. `gridMiddle` is measured with every
    // question closed, so opening one doesn't shift the stream.
    let anchor = 0;
    let gridMiddle = 0;

    // The sheet's centre line at x, leaning toward the cursor nearby.
    const centre = (s: Sheet, x: number, t: number) => {
      const a = x * s.k + t * s.speed + s.phase;
      const y = anchor + (s.y - 0.5) * height + s.amp * Math.sin(a) + s.amp * 0.4 * Math.sin(a * 2.1 - t * 0.17 + s.phase);
      const pull = pointer.strength * Math.exp(-((x - pointer.x) ** 2) / (2 * 260 * 260));
      return y + Math.max(-120, Math.min(120, pointer.y - y)) * pull * 0.35;
    };

    // How far across the sheet a lane (-1 to 1, rim to rim) sits from its centre
    // line at x: the sheet folds over, so this shrinks to nothing where it turns edge-on.
    const across = (s: Sheet, lane: number, x: number, t: number) =>
      s.spread * lane * Math.cos(x * s.twist + t * s.twistSpeed + s.phase) * (0.75 + 0.25 * Math.sin(x * 0.0013 + t * 0.15));

    // The veils: each sheet filled a slice at a time, fading from its rims toward its
    // middle, and brighter the more it's folded (the same light in less room).
    const drawSoft = (t: number) => {
      soft.clearRect(0, 0, width, height);
      soft.globalCompositeOperation = "lighter";

      for (const s of SHEETS) {
        const color = rgb[s.color];
        let prev: [number, number, number] | null = null;
        for (let x = -STEP; x <= width + STEP; x += STEP) {
          const c = centre(s, x, t);
          const h = across(s, 1, x, t);
          if (prev) {
            const reach = Math.abs(h) + 1;
            const a = 0.09 + 0.2 * (1 - Math.min(1, reach / s.spread)) ** 2;
            const fill = soft.createLinearGradient(0, c - reach, 0, c + reach);
            fill.addColorStop(0, `rgba(${color}, ${a * 1.6})`);
            fill.addColorStop(0.3, `rgba(${color}, ${a * 0.5})`);
            fill.addColorStop(0.5, `rgba(${color}, ${a * 0.3})`);
            fill.addColorStop(0.7, `rgba(${color}, ${a * 0.5})`);
            fill.addColorStop(1, `rgba(${color}, ${a * 1.6})`);
            soft.beginPath();
            soft.moveTo(prev[0] - 1, prev[1]);
            soft.lineTo(x + 1, c - h);
            soft.lineTo(x + 1, c + h);
            soft.lineTo(prev[0] - 1, prev[2]);
            soft.closePath();
            soft.fillStyle = fill;
            soft.fill();
          }
          prev = [x, c - h, c + h];
        }
      }

      soft.globalCompositeOperation = "source-over";
    };

    // The rims, and the dust drifting along with the stream, twinkling softly.
    const drawSharp = (t: number) => {
      sharp.clearRect(0, 0, width, height);
      sharp.globalCompositeOperation = "lighter";
      sharp.lineJoin = "round";
      sharp.lineWidth = 1.2;

      for (const s of SHEETS) {
        sharp.strokeStyle = `rgba(${rgb[s.color]}, 0.45)`;
        for (const lane of [-1, 1]) {
          sharp.beginPath();
          for (let x = -STEP; x <= width + STEP; x += STEP) sharp.lineTo(x, centre(s, x, t) + across(s, lane, x, t));
          sharp.stroke();
        }
      }

      sharp.fillStyle = palette.hiveYellow;
      for (const d of dust) {
        const s = SHEETS[d.sheet];
        const u = (d.u + t * d.drift * Math.sign(s.speed) + 1) % 1;
        const x = u * (width + 40) - 20;
        const y = centre(s, x, t) + across(s, d.v, x, t) + d.lift;
        sharp.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + d.twinkle));
        hexPath(sharp, x, y, d.size, d.twinkle);
        sharp.fill();
      }

      sharp.globalAlpha = 1;
      sharp.globalCompositeOperation = "source-over";
    };

    // Where a faller is `q` of the way along its trip: falling fast out of the fade,
    // slowing as it reaches the stream, and swinging along with the flow at the end
    // so it joins it side-on rather than crashing in.
    const fall = (f: { sheet: number; x: number; bend: number }, q: number, top: number, t: number) => {
      const s = SHEETS[f.sheet];
      const x = f.x * width + Math.sign(s.speed) * f.bend * q * q;
      const ease = 1 - (1 - q) ** 2;
      return [x, top + (centre(s, x, t) - top) * ease] as const;
    };

    // The streaks and hexes, only while the fade above the section is in view: they
    // thin out as it scrolls away, leaving the stream as it always is. Each fades in
    // out of the fade and melts away into the stream.
    const drawFalling = (t: number) => {
      falling.clearRect(0, 0, width, height);
      // Held still, they'd be frozen mid-fall and stay there as the page scrolls on.
      if (still) return;
      const fadeTop = section.getBoundingClientRect().top - fallingCanvas.getBoundingClientRect().top;
      const presence = Math.max(0, Math.min(1, (fadeTop + fadeHeight) / (height * 0.3)));
      if (presence < 0.01) return;
      // They start where the fade has turned purple, and only come up to full
      // brightness as it deepens, so none of the light shows over its paler top.
      const top = fadeTop + fadeHeight * 0.55;
      const depth = (y: number) => Math.max(0, Math.min(1, (y - top) / (fadeHeight * 0.25)));

      falling.globalCompositeOperation = "lighter";
      falling.lineCap = "round";
      for (const f of streaks) {
        const head = ((f.offset + t * f.speed) % 1) * (1 + f.len);
        const from = Math.max(0, head - f.len);
        const to = Math.min(1, head);
        if (to <= from) continue;
        falling.lineWidth = f.width;
        let prev = fall(f, from, top, t);
        for (let i = 1; i <= 14; i++) {
          const q = from + ((to - from) * i) / 14;
          const p = fall(f, q, top, t);
          // Brightest at its head, and only partway along its trip.
          const along = (q - (head - f.len)) / f.len;
          const a = presence * 0.55 * along * Math.sin(Math.PI * q) * depth(p[1]);
          falling.strokeStyle = `rgba(${rgb.honeyLight}, ${a})`;
          falling.beginPath();
          falling.moveTo(prev[0], prev[1]);
          falling.lineTo(p[0], p[1]);
          falling.stroke();
          prev = p;
        }
      }

      falling.fillStyle = palette.hiveYellow;
      for (const d of drops) {
        const q = (d.offset + t * d.speed) % 1;
        const [x, y] = fall(d, q, top, t);
        falling.globalAlpha = presence * 0.75 * Math.sin(Math.PI * q) * depth(y);
        hexPath(falling, x + d.sway * Math.sin(t * 0.8 + d.offset * 9) * (1 - q), y, d.size, t * d.spin);
        falling.fill();
      }

      falling.globalAlpha = 1;
      falling.globalCompositeOperation = "source-over";
    };

    // Positions on the canvases are measured off the falling light's canvas, pinned
    // in the same place as the stream's but never squashed by the boot-up, which
    // would throw off anything measured from the stream's own view.
    const draw = (t: number) => {
      anchor = grid.getBoundingClientRect().top - fallingCanvas.getBoundingClientRect().top + gridMiddle;
      // So the boot-up swells it out from its own line (see faqSection.css).
      view.style.transformOrigin = `50% ${anchor}px`;
      drawSoft(t);
      drawSharp(t);
      drawFalling(t);
    };

    const tick = (ms: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      pointer.strength += (pointer.target - pointer.strength) * 0.03;
      lastT = ms / 1000;
      draw(lastT);
      frame = onScreen ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (!still && onScreen && !frame) frame = requestAnimationFrame(tick);
    };

    // The canvases fill a screen-sized view that stays pinned while the section
    // scrolls past, so opening or closing a question (which changes the section's
    // height) never resizes them; resizing a canvas can show it blank for a frame.
    const resize = () => {
      // The fade's height (faqSection.css's --fade), read off the fade itself.
      fadeHeight = parseFloat(getComputedStyle(section, "::before").height) || 0;
      // Only while every question is closed; otherwise keep the last measure.
      if (!section.querySelector('.faq-item[data-open="true"]')) gridMiddle = grid.offsetHeight / 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = view.clientWidth;
      height = view.clientHeight;
      softCanvas.width = Math.ceil(width * SOFT_SCALE);
      softCanvas.height = Math.ceil(height * SOFT_SCALE);
      soft.setTransform(SOFT_SCALE, 0, 0, SOFT_SCALE, 0, 0);
      sharpCanvas.width = width * dpr;
      sharpCanvas.height = height * dpr;
      sharp.setTransform(dpr, 0, 0, dpr, 0, 0);
      fallingCanvas.width = width * dpr;
      fallingCanvas.height = height * dpr;
      falling.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(lastT);
    };

    const onMove = (e: PointerEvent) => {
      const rect = fallingCanvas.getBoundingClientRect();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      // Start leaning at the cursor when it comes in, rather than sweeping from where it left.
      if (pointer.strength < 0.02) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      pointer.target = 1;
    };
    const onLeave = () => {
      pointer.target = 0;
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(view);
    const viewObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      start();
    });
    viewObserver.observe(section);

    // Held still there are no frames, so redraw on scroll to keep the stream with
    // the questions.
    let scrollFrame = 0;
    const onScroll = () => {
      if (!scrollFrame) {
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          draw(lastT);
        });
      }
    };

    if (still) {
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      section.addEventListener("pointermove", onMove);
      section.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", onScroll);
      sizeObserver.disconnect();
      viewObserver.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <div className="faq-stream" aria-hidden>
        <div ref={viewRef} className="faq-stream-view">
          <canvas ref={softRef} className="is-soft" />
          <canvas ref={sharpRef} />
        </div>
      </div>
      {/* The falling light, in a view of its own pinned in the same place, since it
          goes over the fade while the stream goes under it. */}
      <div className="faq-stream faq-falling" aria-hidden>
        <div className="faq-stream-view">
          <canvas ref={fallingRef} />
        </div>
      </div>
    </>
  );
}

export function FaqSection() {
  const half = Math.ceil(faqs.length / 2);
  const sectionRef = useRef<HTMLElement>(null);

  // Boots up like a PS3 as it scrolls into view, in two stages (see faqSection.css):
  // "dawn" as the fade comes up, when light starts falling out of it, then "awake"
  // once the fade is mostly past, when the stream swells in along with the heading
  // and the questions. Scrolling back up powers it down a stage at a time, so it
  // boots afresh next time. Opening the page at or past the FAQ starts it awake.
  // Everything stays showing for reduced motion, and before this runs.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      // Where the section's top is, as a fraction of the screen's height.
      const top = section.getBoundingClientRect().top / window.innerHeight;
      const stage = section.dataset.boot;
      // Each stage comes on at one line and goes off only back past a lower one, so
      // it doesn't flicker when the scroll sits right at the line.
      if (top <= 0.12 || (stage === "awake" && top <= 0.28)) section.dataset.boot = "awake";
      else if (top <= 0.65 || (stage !== "asleep" && top <= 0.8)) section.dataset.boot = "dawn";
      else section.dataset.boot = "asleep";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section ref={sectionRef} id="faq" aria-label="FAQ" className="faq-page scroll-mt-16">
      <HexStream />
      <h1>Frequently asked questions</h1>
      {/* Two independent columns, so opening one question doesn't push the other column around. */}
      <div className="faq-grid">
        {[faqs.slice(0, half), faqs.slice(half)].map((column, c) => (
          <div key={c} className="faq-column">
            {column.map((faq, i) => (
              <FaqItem
                key={faq.question}
                id={`faq-answer-${c}-${i}`}
                hexes={HEX_LAYOUTS[c * half + i] ?? []}
                drips={DRIP_LAYOUTS[(c * half + i) % DRIP_LAYOUTS.length]}
                // Its turn in the boot-up: row by row across both columns, or straight
                // down the list once they stack into one.
                boot={{ "--step": i * 2 + c, "--step-narrow": c * half + i } as CSSProperties}
                {...faq}
              />
            ))}
          </div>
        ))}
      </div>
      <ContactLine />
    </section>
  );
}
