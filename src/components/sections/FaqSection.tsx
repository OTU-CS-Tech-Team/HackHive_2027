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

export function FaqSection() {
  const half = Math.ceil(faqs.length / 2);

  return (
    <section id="faq" aria-label="FAQ" className="faq-page scroll-mt-16">
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
