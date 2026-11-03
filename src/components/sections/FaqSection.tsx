"use client";

import { useState, type CSSProperties } from "react";
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
        Have more questions? Email us at{" "}
        <a href={GMAIL_URL} target="_blank" rel="noopener noreferrer">
          {CLUB_EMAIL}
        </a>
        .
      </p>
      <div className="faq-contact-actions">
        <button type="button" onClick={copy}>
          {copied ? "Copied!" : "Copy email"}
        </button>
      </div>
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

// Where the amber hexes sit on each card, so no two cards look alike. Numbers are in
// hex widths from the card's edge (negative hangs off it); strings are used as-is.
// `size` scales a hex, and `melt` ones sit on the bottom edge and melt away when
// the answer opens beneath them. Hexes stay off the question's left padding and the
// +/- on the right.
type HexSpot = {
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  size?: number;
  melt?: boolean;
};

const HEX_LAYOUTS: HexSpot[][] = [
  // Torn from the comb at the top-left corner.
  [
    { top: -0.45, left: -0.3 },
    { top: 0.5, left: -0.8 },
    { bottom: -0.4, right: -0.45, melt: true },
  ],
  // Torn at the top-right corner instead.
  [
    { top: -0.65, right: -0.25 },
    { bottom: -0.45, left: -0.4, size: 0.85, melt: true },
  ],
  // A short strip of comb along the top edge.
  [
    { top: -0.6, left: "26%", size: 0.85 },
    { top: -0.6, left: "calc(26% + var(--cell) * 0.9)", size: 0.85 },
  ],
  // One big hex on the corner and a straggler.
  [
    { top: -0.55, left: -0.45, size: 1.25 },
    { bottom: -0.5, right: "28%", size: 0.8, melt: true },
  ],
  // Low on the bottom-left.
  [
    { top: -0.5, right: -0.3, size: 0.7 },
    { bottom: -0.4, left: -0.35, melt: true },
    { bottom: -0.65, left: 0.55, size: 0.8, melt: true },
  ],
  // A pair down the left side.
  [
    { top: -0.35, left: -0.6 },
    { top: 0.6, left: -0.75, size: 0.8 },
    { top: -0.6, left: "74%", size: 0.85 },
  ],
];

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
}: Faq & { id: string; hexes: HexSpot[]; drips: DripSpot[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="faq-item" data-open={open}>
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
            {question}
            <span className="faq-icon" aria-hidden>
              {open ? "−" : "+"}
            </span>
          </button>
        </h3>
      </div>
      <div id={id} className="faq-answer" role="region" aria-hidden={!open}>
        <div>
          <div className="faq-panel">
            <p>{answer}</p>
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

// A small seeded random number generator, so the server and browser draw the same comb.
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

// The comb is one tile of cells repeated across the background, in pixels so the
// cells are the same size on any screen. COMB_ROWS must be even so the half-cell
// offset of alternate rows lines up where tiles meet.
const COMB_COLS = 18;
const COMB_ROWS = 12;
const CELL_W = 60;
const CELL_H = CELL_W * 1.1547;
const ROW_PITCH = CELL_H * 0.75;

type CellFill = "empty" | "honey" | "capped";

// What's in each cell: honey and wax caps gather in patches, as in a real hive,
// with empty cells between. The patches come from waves that repeat exactly once
// across the tile, so they carry on seamlessly into the next.
const COMB: CellFill[][] = (() => {
  const rand = seeded(7);
  return Array.from({ length: COMB_ROWS }, (_, row) =>
    Array.from({ length: COMB_COLS }, (_, col) => {
      const across = (col / COMB_COLS) * Math.PI * 2;
      const down = (row / COMB_ROWS) * Math.PI * 2;
      const patch = 0.5 + 0.25 * Math.sin(2 * across + down) + 0.25 * Math.cos(2 * down - across);
      const value = 0.6 * patch + 0.4 * rand();
      return value > 0.72 ? "capped" : value > 0.34 ? "honey" : "empty";
    }),
  );
})();

// A pointy-top hexagon centred on (x, y), `inset` in from a full cell.
function hexPoints(x: number, y: number, inset: number) {
  const r = CELL_H / 2 - inset;
  return [-90, -30, 30, 90, 150, 210]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      return `${round(x + r * Math.cos(a))},${round(y + r * Math.sin(a))}`;
    })
    .join(" ");
}

// The hive's comb behind the questions: thin wax walls around softly shaded
// cells, mostly honey, with patches of capped wax and a few empty cells, all in
// close, muted tones so it stays in the background. A soft shade over it darkens
// the middle, where the questions sit. Cells that cross the tile's edge are drawn
// on both sides (taking their contents from the wrapped-around cell), so the tiles
// join without a seam.
function CombBackdrop() {
  const tileW = COMB_COLS * CELL_W;
  const tileH = COMB_ROWS * ROW_PITCH;
  const cells = [];

  for (let row = -1; row <= COMB_ROWS; row++) {
    for (let col = -1; col <= COMB_COLS; col++) {
      const fill = COMB[(row + COMB_ROWS) % COMB_ROWS][(col + COMB_COLS) % COMB_COLS];
      const x = col * CELL_W + (Math.abs(row) % 2) * (CELL_W / 2);
      const y = row * ROW_PITCH;
      cells.push(<polygon key={`${row}-${col}`} points={hexPoints(x, y, 2.5)} fill={`url(#comb-${fill})`} />);
    }
  }

  return (
    <svg className="faq-comb" aria-hidden>
      <defs>
        {/* Each cell lit from the upper left and darker toward its edges. */}
        {[
          ["empty", "#5e3a12", "#3a220a"],
          ["honey", "#e7a83a", "#b9781c"],
          ["capped", "#e2c486", "#c69e58"],
        ].map(([name, light, dark]) => (
          <radialGradient key={name} id={`comb-${name}`} cx="0.4" cy="0.38" r="0.7">
            <stop offset="0" stopColor={light} />
            <stop offset="1" stopColor={dark} />
          </radialGradient>
        ))}
        <radialGradient id="comb-shade" cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#2a1704" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2a1704" stopOpacity="0.2" />
        </radialGradient>
        <pattern id="faq-comb-tile" width={round(tileW)} height={round(tileH)} patternUnits="userSpaceOnUse">
          {/* The wax walls between cells. */}
          <rect width={round(tileW)} height={round(tileH)} fill="#8a5716" />
          {cells}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#faq-comb-tile)" />
      <rect width="100%" height="100%" fill="url(#comb-shade)" />
    </svg>
  );
}

// Drips hanging from a sheet of honey: x position, length and width, in the
// drawing's own units (1600 across).
type Drip = [number, number, number];

const TOP_DRIPS: Drip[] = [
  [60, 50, 11], [170, 110, 14], [290, 35, 10], [400, 85, 13], [530, 140, 15], [660, 45, 10],
  [780, 100, 13], [905, 60, 11], [1030, 130, 15], [1150, 40, 10], [1270, 95, 13], [1400, 55, 11], [1520, 120, 14],
];

// These hang over the top of the team section, so the ones over its title (in
// the middle-right) are kept short.
const BOTTOM_DRIPS: Drip[] = [
  [90, 90, 13], [230, 150, 16], [370, 60, 11], [510, 120, 14], [650, 70, 12], [790, 30, 10],
  [930, 25, 10], [1070, 35, 10], [1200, 30, 10], [1340, 95, 13], [1480, 140, 15],
];

// One drip, `w` its width where it leaves the sheet: it narrows, then swells into
// a round drop `len` below the sheet's edge at y = 30.
function dripPath(x: number, len: number, w: number) {
  const neck = 30 + len - w * 0.8;
  const drop = 30 + len;
  const r = w * 0.85;
  return [
    `M${x - w * 1.3} 26`,
    `C${x - w * 0.5} 30 ${x - w * 0.5} 40 ${x - w * 0.45} 52`,
    `L${x - w * 0.4} ${neck}`,
    `C${x - w * 0.4} ${neck + w * 0.3} ${x - r} ${drop - r * 0.6} ${x - r} ${drop}`,
    `A${r} ${r} 0 0 0 ${x + r} ${drop}`,
    `C${x + r} ${drop - r * 0.6} ${x + w * 0.4} ${neck + w * 0.3} ${x + w * 0.4} ${neck}`,
    `L${x + w * 0.45} 52`,
    `C${x + w * 0.5} 40 ${x + w * 0.5} 30 ${x + w * 1.3} 26Z`,
  ].join("");
}

// A cartoon sheet of honey along an edge of the section, its drips slowly
// stretching and a few of them letting drops fall. Drawn hanging down; the
// bottom one hangs off the section over the top of the forest below.
function HoneyEdge({ drips, className }: { drips: Drip[]; className: string }) {
  return (
    <svg className={`honey-edge ${className}`} viewBox="0 0 1600 240" preserveAspectRatio="xMidYMin slice" aria-hidden>
      <g stroke="#3b1f00" strokeWidth="4" strokeLinejoin="round">
        {drips.map(([x, len, w], i) => (
          <g key={x} className="drip" style={{ animationDelay: `${-i * 1.1}s`, animationDuration: `${4.5 + (i % 4)}s` }}>
            <path d={dripPath(x, len, w)} fill="#ffc21a" />
            <ellipse cx={x - w * 0.3} cy={30 + len - w * 0.1} rx={w * 0.22} ry={w * 0.32} fill="#fff8d6" stroke="none" />
          </g>
        ))}
        {/* The sheet itself, its lower edge sagging between drips. */}
        <path
          d="M0 0H1600V28C1550 36 1500 24 1450 31C1380 40 1320 24 1250 32C1180 40 1120 25 1050 31C980 38 920 24 850 32C780 40 720 25 650 31C580 38 520 24 450 32C380 40 320 25 250 31C180 38 100 24 0 30Z"
          fill="#ffc21a"
        />
        <path d="M0 14C300 19 600 10 900 15C1200 20 1400 11 1600 15" stroke="#ffd95a" strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
      {/* Every so often a drop breaks off and falls. */}
      {drips
        .filter((_, i) => i % 3 === 1)
        .map(([x, len, w], i) => (
          <circle
            key={x}
            className="drop"
            cx={x}
            cy={30 + len + w * 1.8}
            r={w * 0.65}
            fill="#ffc21a"
            stroke="#3b1f00"
            strokeWidth="3"
            style={{ animationDelay: `${i * 1.7}s` }}
          />
        ))}
    </svg>
  );
}

export function FaqSection() {
  const half = Math.ceil(faqs.length / 2);

  return (
    <section id="faq" aria-label="FAQ" className="faq-page scroll-mt-16">
      <CombBackdrop />
      <HoneyEdge drips={TOP_DRIPS} className="is-top" />
      <HoneyEdge drips={BOTTOM_DRIPS} className="is-bottom" />
      <h1>Frequently asked questions</h1>
      {/* Two independent columns, so opening one question doesn't push the other column around. */}
      <div className="faq-grid">
        {[faqs.slice(0, half), faqs.slice(half)].map((column, c) => (
          <div key={c} className="faq-column">
            {column.map((faq, i) => (
              <FaqItem
                key={faq.question}
                id={`faq-answer-${c}-${i}`}
                hexes={HEX_LAYOUTS[(c * half + i) % HEX_LAYOUTS.length]}
                drips={DRIP_LAYOUTS[(c * half + i) % DRIP_LAYOUTS.length]}
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
