"use client";

import { useId, type ReactNode } from "react";
import type { Avatar, ColorId, Slot } from "@/lib/avatar";
import styles from "./bee.module.css";

// Fill and trim (cuffs, stripes, brims) for each colour.
export const PAINT: Record<ColorId, [fill: string, trim: string]> = {
  ink: ["#2a2a31", "#f4b942"],
  honey: ["#f4b942", "#2a2a31"],
  cream: ["#efe6d0", "#2a2a31"],
  red: ["#e0483a", "#ffd36b"],
  blue: ["#3c72e2", "#f4b942"],
  green: ["#2ea866", "#f4b942"],
  purple: ["#8657e2", "#f4b942"],
};

export const HONEY = "#f4b942";
export const LINE = "#0b0b0e";
export const SOLE = "#f3ecd9";

// The whole bee, and the close-ups the wardrobe tiles show.
export const VIEW = "0 0 200 280";
export const CROPS: Record<Slot, string> = {
  top: "26 98 148 112",
  bottom: "40 176 120 92",
  shoes: "48 226 104 46",
  hat: "26 0 148 124",
  ears: "26 8 148 120",
  glasses: "34 30 132 96",
  face: "34 30 132 96",
};

// Flat-topped hexagon; pointy-topped when turned 30°.
export function hex(x: number, y: number, r: number, pointy = false) {
  const turn = pointy ? Math.PI / 6 : 0;
  const corners = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + turn;
    return `${(x + r * Math.cos(a)).toFixed(2)} ${(y + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${corners.join("L")}Z`;
}

export const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

const COMB = [[0, 0], [12, 0], [0, 6.93], [12, 6.93], [6, 3.46]].map(([x, y]) => hex(x, y, 4)).join("");

// Draws the left half, then mirrors it onto the right.
function Pair({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <g transform="matrix(-1 0 0 1 200 0)">{children}</g>
    </>
  );
}

type Paints = { shade: string; honey: string; visor: string; wing: string; comb: string; mesh: string; head: string; glow: string };

// Colour, an optional hex weave, light-to-dark shading, then the ink outline.
const shape = (p: Paints, d: string, fill: string, weave = false) => (
  <>
    <path d={d} fill={fill} />
    {weave && <path d={d} fill={p.mesh} />}
    <path d={d} fill={p.shade} />
    <path d={d} fill="none" stroke={LINE} strokeWidth={2.4} strokeLinejoin="round" />
  </>
);

// Arms, legs and sleeves: a thick stroke over its outline, with a rim of light.
const limb = (d: string, color: string, w: number, cap: "round" | "butt" = "round") => (
  <>
    <path d={d} fill="none" stroke={LINE} strokeWidth={w + 4.8} strokeLinecap={cap} />
    <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap={cap} />
    <path d={d} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={w / 4} strokeLinecap={cap} transform={`translate(${-w / 4} 0)`} />
  </>
);

// The HackHive mark: a bee in a hexagon.
const logo = (x: number, y: number, r: number) => (
  <>
    <path d={hex(x, y, r, true)} fill="#16161b" stroke={HONEY} strokeWidth={r * 0.2} strokeLinejoin="round" />
    <ellipse cx={x - r * 0.34} cy={y - r * 0.14} rx={r * 0.3} ry={r * 0.17} fill="#cfe9ff" transform={`rotate(-25 ${x - r * 0.34} ${y - r * 0.14})`} />
    <ellipse cx={x + r * 0.34} cy={y - r * 0.14} rx={r * 0.3} ry={r * 0.17} fill="#cfe9ff" transform={`rotate(25 ${x + r * 0.34} ${y - r * 0.14})`} />
    <ellipse cx={x} cy={y + r * 0.1} rx={r * 0.2} ry={r * 0.36} fill={HONEY} />
    <path d={`M${x - r * 0.2} ${y + r * 0.06}H${x + r * 0.2}M${x - r * 0.17} ${y + r * 0.26}H${x + r * 0.17}`} stroke="#16161b" strokeWidth={r * 0.09} />
  </>
);

// The mark's bee seen from above, nose along +x: the wardrobe's header, and
// the bees flying round it (buzz beats the wings).
export const topBee = (buzz = false) => (
  <g className={buzz ? styles.buzz : undefined}>
    <g className={styles.wingUp}>
      <ellipse cx={-1.5} cy={-5.4} rx={4.2} ry={5.6} transform="rotate(-28 -1.5 -5.4)" fill="#cfe9ff" fillOpacity={0.85} stroke={LINE} strokeWidth={1} />
    </g>
    <g className={styles.wingDown}>
      <ellipse cx={-1.5} cy={5.4} rx={4.2} ry={5.6} transform="rotate(28 -1.5 5.4)" fill="#cfe9ff" fillOpacity={0.85} stroke={LINE} strokeWidth={1} />
    </g>
    <path d="M-9.2 -1.4L-12.4 0L-9.2 1.4Z" fill={LINE} />
    <ellipse cx={-2} rx={7.6} ry={5} fill={HONEY} />
    <path d="M-4.6 -4.8V4.8M-0.9 -5V5" stroke="#2a2a31" strokeWidth={2.1} />
    <ellipse cx={-2} rx={7.6} ry={5} fill="none" stroke={LINE} strokeWidth={1.3} />
    <path d="M9 -1.6Q11.8 -3.2 12.8 -5.6M9 1.6Q11.8 3.2 12.8 5.6" fill="none" stroke="#2a2a31" strokeWidth={1.1} strokeLinecap="round" />
    <circle cx={6.6} r={3.7} fill="#2a2a31" stroke={LINE} strokeWidth={1.1} />
    <circle cx={7.9} cy={-1.5} r={0.9} fill={HONEY} />
    <circle cx={7.9} cy={1.5} r={0.9} fill={HONEY} />
  </g>
);

export const heart = (x: number, y: number, s: number) =>
  `M${x} ${y + s * 0.9}C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.6} ${y - s * 1.3} ${x} ${y - s * 0.35}C${x + s * 0.6} ${y - s * 1.3} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z`;

const TORSO = "M86 121H114Q128 123 136 131L139 150L137 197Q100 203 63 197L61 150L64 131Q72 123 86 121Z";
const ARM = "M66 136Q56 158 50 182";
const SLEEVE = "M67 135Q57 158 52.6 174.5";
const CUFF = "M52.6 174.5L51 181";
const LEG = "M85 194L81 250";

type Art = (fill: string, trim: string, p: Paints) => ReactNode;

const TOPS: Record<Avatar["top"]["item"], Art> = {
  hoodie: (c, t, p) => (
    <>
      <Pair>
        {limb(SLEEVE, c, 20)}
        {limb(CUFF, t, 20.5, "butt")}
      </Pair>
      {shape(p, TORSO, c, true)}
      <path d="M63 190.5Q100 196.5 137 190.5L137 197Q100 203 63 197Z" fill={t} />
      {shape(p, "M76 171H124L128 190Q100 194 72 190Z", c, true)}
      {logo(100, 156, 8)}
      {shape(p, "M68 134Q62 112 80 105H120Q138 112 132 134Q118 129 109 136Q100 143 91 136Q82 129 68 134Z", c)}
      <Pair>
        <path d="M93 139L91 151" stroke={t} strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={91} cy={152.5} r={2.1} fill={t} stroke={LINE} strokeWidth={0.8} />
      </Pair>
    </>
  ),
  varsity: (c, t, p) => (
    <>
      <Pair>
        {limb(SLEEVE, SOLE, 20)}
        {limb(CUFF, c, 20.5, "butt")}
        <path d="M53.6 177.2L44 174" stroke={t} strokeWidth={1.6} />
      </Pair>
      {shape(p, TORSO, c)}
      <path d="M63 189Q100 195 137 189L137 197Q100 203 63 197Z" fill={c} />
      <path d="M63 191.8Q100 197.8 137 191.8M63 194.8Q100 200.8 137 194.8" fill="none" stroke={t} strokeWidth={1.6} />
      <path d="M100 131V196" stroke={LINE} strokeWidth={1.6} />
      {[142, 157, 172].map((y) => (
        <circle key={y} cx={103} cy={y} r={1.9} fill={SOLE} stroke={LINE} strokeWidth={0.8} />
      ))}
      <path d="M77 146V160M87 146V160M77 153H87" stroke={LINE} strokeWidth={6.5} strokeLinecap="square" />
      <path d="M77 146V160M87 146V160M77 153H87" stroke={t} strokeWidth={3.4} strokeLinecap="square" />
      <path d="M84 121.5Q100 137 116 121.5" fill="none" stroke={LINE} strokeWidth={8.5} strokeLinecap="round" />
      <path d="M84 121.5Q100 137 116 121.5" fill="none" stroke={c} strokeWidth={5.5} strokeLinecap="round" />
      <path d="M84 121.5Q100 137 116 121.5" fill="none" stroke={t} strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  tshirt: (c, t, p) => (
    <>
      <Pair>
        {limb("M67 135Q63 144.8 60 152", c, 22)}
        <path d="M70.6 152.6L49.6 148.4" stroke={t} strokeWidth={2.8} strokeLinecap="round" />
      </Pair>
      {shape(p, TORSO, c)}
      <path d="M85 121.5Q100 135 115 121.5" fill="none" stroke={t} strokeWidth={3.2} strokeLinecap="round" />
      <path d="M63.5 193.5Q100 199.5 136.5 193.5" fill="none" stroke={t} strokeWidth={2.6} />
      {logo(100, 160, 13)}
    </>
  ),
};

const BOTTOMS: Record<Avatar["bottom"]["item"], Art> = {
  cargo: (c, t, p) => (
    <>
      {shape(p, "M63 186H137L134 251H106L101 214H99L94 251H66Z", c, true)}
      <path d="M63 186H137L136.6 193H63.4Z" fill="#000" opacity={0.25} />
      <path d="M100 193V212" stroke={LINE} strokeWidth={1.4} strokeOpacity={0.6} />
      <Pair>
        <path d="M65.5 194L68.5 249" stroke={t} strokeWidth={3} />
        {shape(p, rr(64, 206, 13, 20, 2), c)}
        <path d="M64 211.5H77" stroke={LINE} strokeWidth={1.6} />
        <circle cx={70.5} cy={209} r={1.7} fill={t} stroke={LINE} strokeWidth={0.8} />
      </Pair>
    </>
  ),
  shorts: (c, t, p) => (
    <>
      {shape(p, "M63 186H137L137.5 222H103L100 208L97 222H62.5Z", c, true)}
      <path d="M63 186H137L136.8 193H63.2Z" fill="#000" opacity={0.25} />
      <path d="M100 193V207" stroke={LINE} strokeWidth={1.4} strokeOpacity={0.6} />
      <Pair>
        <path d="M65 194L65 220.5" stroke={t} strokeWidth={3} />
      </Pair>
    </>
  ),
};

const SHOES: Record<Avatar["shoes"]["item"], Art> = {
  sneakers: (c, t, p) => (
    <Pair>
      {shape(p, "M67 247Q67 235 81 235Q95 235 95 247L98 261H64Z", c)}
      <path d="M69.5 240.5Q81 233.5 92.5 240.5" fill="none" stroke={t} strokeWidth={2.8} strokeLinecap="round" />
      <path d="M76 243.5H86M75.5 247.5H86.5" stroke={t} strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round" />
      {/* The rubber toe cap. */}
      {shape(p, "M70 259Q70 250.5 81 250.5Q92 250.5 92 259Z", SOLE)}
      <rect x={62.5} y={257.5} width={36} height={11.5} rx={5.75} fill={SOLE} stroke={LINE} strokeWidth={2.4} />
      <path d="M66.5 263.25H94.5" stroke={HONEY} strokeWidth={2} strokeLinecap="round" />
    </Pair>
  ),
  none: () => (
    <Pair>
      <ellipse cx={80} cy={256} rx={11} ry={6.5} fill="#2c2c33" stroke={LINE} strokeWidth={2.4} />
    </Pair>
  ),
};

const HATS: Record<Avatar["hat"]["item"], Art> = {
  none: () => null,
  cap: (c, t, p) => (
    <>
      {shape(p, "M45 62C43 16 157 16 155 62Z", c)}
      <path d="M100 28V60M100 28Q79 33 73 60M100 28Q121 33 127 60" fill="none" stroke={LINE} strokeWidth={1.4} strokeOpacity={0.55} />
      {logo(100, 45, 8.5)}
      {shape(p, "M40 61Q100 46 160 61Q166 70 154 75Q100 64 46 75Q34 70 40 61Z", t)}
      <circle cx={100} cy={27.5} r={3.4} fill={t} stroke={LINE} strokeWidth={1.6} />
    </>
  ),
  beanie: (c, t, p) => (
    <>
      {shape(p, "M47 66C45 12 155 12 153 66Z", c, true)}
      {shape(p, "M45 51Q100 39 155 51L157 68Q100 56 43 68Z", c)}
      <path d={Array.from({ length: 13 }, (_, i) => `M${52 + i * 8} ${53 - 24 * ((i + 1) / 14) * (1 - (i + 1) / 14)}v12`).join("")} stroke={LINE} strokeOpacity={0.3} strokeWidth={1.3} />
      {logo(100, 58, 5.5)}
      <circle cx={100} cy={20} r={8.5} fill={t} stroke={LINE} strokeWidth={2.2} />
      <path d="M95 17.5a3 3 0 0 1 4-3M101 25a3 3 0 0 0 4-3" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
};

const HEADPHONES: Record<Avatar["ears"]["item"], Art> = {
  none: () => null,
  headphones: (c, t, p) => (
    <>
      <path d="M45 74C40 6 160 6 155 74" fill="none" stroke={LINE} strokeWidth={9} strokeLinecap="round" />
      <path d="M45 74C40 6 160 6 155 74" fill="none" stroke={c} strokeWidth={5.4} strokeLinecap="round" />
      <Pair>
        {shape(p, rr(32, 58, 21, 36, 9), c)}
        <path d={rr(35.5, 63, 14, 26, 6.5)} fill="none" stroke={t} strokeWidth={1.8} />
        {logo(42.5, 76, 4.8)}
      </Pair>
    </>
  ),
};

const GLASSES: Record<Avatar["glasses"]["item"], Art> = {
  none: () => null,
  shades: (c) => (
    <>
      <Pair>
        <path d="M62 76L46 71" stroke={LINE} strokeWidth={3} strokeLinecap="round" />
        <path d={rr(62, 69, 32, 21, 7)} fill={c} fillOpacity={0.92} stroke={LINE} strokeWidth={3} />
        <path d="M68 77L75 71.5" stroke="#fff" strokeOpacity={0.65} strokeWidth={2.2} strokeLinecap="round" />
      </Pair>
      <path d="M94 77Q100 72.5 106 77" fill="none" stroke={LINE} strokeWidth={3} />
    </>
  ),
};

// LED eyes on the visor.
const pill = (x: number, e: string) => <path d={rr(x, 72, 11, 17, 5.5)} fill={e} />;
const smile = (x: number, e: string) => <path d={`M${x} 87Q${x + 9} 73 ${x + 18} 87`} fill="none" stroke={e} strokeWidth={5} strokeLinecap="round" />;

// Only open eyes blink and hearts beat; closed, winking and squinting eyes hold still.
const FACES: Record<Avatar["face"]["item"], (e: string) => ReactNode> = {
  happy: (e) => (
    <>
      {smile(72, e)}
      {smile(110, e)}
    </>
  ),
  eyes: (e) => (
    <g className={styles.blink}>
      {pill(75, e)}
      {pill(114, e)}
    </g>
  ),
  wink: (e) => (
    <>
      {pill(75, e)}
      {smile(110, e)}
    </>
  ),
  // One path each, so each heart swells around its own centre.
  hearts: (e) => (
    <>
      <path className={styles.beat} d={heart(81, 80, 7.5)} fill={e} />
      <path className={styles.beat} d={heart(119, 80, 7.5)} fill={e} />
    </>
  ),
  squint: (e) => <path d="M75 74L88 81L75 88M125 74L112 81L125 88" fill="none" stroke={e} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />,
};

const UPPER_WING = "M84 146C62 116 24 100 11 114C1 128 20 160 84 156Z";
const LOWER_WING = "M84 160C64 160 34 168 30 186C27 200 56 202 86 168Z";

export function Bee({
  avatar,
  still = false,
  pop,
  viewBox = VIEW,
  className = "",
  headOnly = false,
}: {
  avatar: Avatar;
  // Hovers in place unless still (the wardrobe tiles).
  still?: boolean;
  // The slot that just changed; only that piece pops in.
  pop?: Slot;
  viewBox?: string;
  className?: string;
  // Just the head and what it wears (the passport's headshot).
  headOnly?: boolean;
}) {
  // Gradient ids must be unique per bee: the wardrobe shows several at once.
  const uid = useId().replace(/[^\w-]/g, "");
  const names = ["shade", "honey", "visor", "wing", "comb", "mesh", "head", "glow"] as const;
  const id = (name: (typeof names)[number]) => `${uid}-${name}`;
  const p = Object.fromEntries(names.map((name) => [name, `url(#${id(name)})`])) as Paints;

  // Keyed on the piece, so a swap remounts it and the new one pops in.
  const piece = (slot: Slot, art: ReactNode) => (
    <g key={`${slot}-${avatar[slot].item}-${avatar[slot].color}`} className={pop === slot ? styles.pop : undefined}>
      {art}
    </g>
  );
  const dress = <S extends Slot>(slot: S, arts: Record<Avatar[S]["item"], Art>) => {
    const { item, color } = avatar[slot];
    const [fill, trim] = PAINT[color];
    return piece(slot, arts[item](fill, trim, p));
  };

  // Left side only; it goes in a Pair.
  const antenna = (
    <g className={styles.antenna}>
      <path d="M88 42Q82 28 71 18" fill="none" stroke={LINE} strokeWidth={6.5} strokeLinecap="round" />
      <path d="M88 42Q82 28 71 18" fill="none" stroke="#45454f" strokeWidth={3} strokeLinecap="round" />
      <path d={hex(69, 15, 9)} fill={p.honey} stroke={LINE} strokeWidth={2.4} strokeLinejoin="round" />
    </g>
  );
  const head = (
    <>
      <ellipse cx={100} cy={74} rx={56} ry={45} fill={p.honey} />
      <path d="M62 42Q100 22 138 42" fill="none" stroke="#2a2a31" strokeWidth={8} clipPath={p.head} />
      <ellipse cx={100} cy={74} rx={56} ry={45} fill="none" stroke={LINE} strokeWidth={2.6} />
      <ellipse cx={77} cy={46} rx={13} ry={6} fill="#fff" opacity={0.45} transform="rotate(-22 77 46)" />
      <path d={rr(59, 52, 82, 60, 27)} fill={p.visor} stroke={LINE} strokeWidth={2.6} />
      <path d="M68 68Q72 59.5 85 58.5" fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" />
      {piece("face", <g filter={p.glow}>{FACES[avatar.face.item](PAINT[avatar.face.color][0])}</g>)}
      {dress("glasses", GLASSES)}
      {dress("hat", HATS)}
      {dress("ears", HEADPHONES)}
    </>
  );

  return (
    <svg viewBox={viewBox} className={`${still ? "" : styles.alive} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id("shade")} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </linearGradient>
        <radialGradient id={id("honey")} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffe8a8" />
          <stop offset="0.5" stopColor={HONEY} />
          <stop offset="1" stopColor="#c4841a" />
        </radialGradient>
        <linearGradient id={id("visor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a46" />
          <stop offset="1" stopColor="#0c0c10" />
        </linearGradient>
        <radialGradient id={id("wing")} cx="0.85" cy="0.6" r="1">
          <stop offset="0" stopColor="#fff3c4" stopOpacity="0.9" />
          <stop offset="1" stopColor={HONEY} stopOpacity="0.5" />
        </radialGradient>
        <pattern id={id("comb")} width="12" height="6.93" patternUnits="userSpaceOnUse">
          <path d={COMB} fill="none" stroke="#c98a1c" strokeWidth="0.8" strokeOpacity="0.7" />
        </pattern>
        <pattern id={id("mesh")} width="12" height="6.93" patternUnits="userSpaceOnUse">
          <path d={COMB} fill="none" stroke="#fff" strokeWidth="0.7" strokeOpacity="0.09" />
        </pattern>
        <clipPath id={id("head")}>
          <ellipse cx="100" cy="74" rx="56" ry="45" />
        </clipPath>
        <filter id={id("glow")} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {headOnly ? (
        <>
          <Pair>{antenna}</Pair>
          {head}
        </>
      ) : (
        <>
          <ellipse className={styles.shadow} cx="100" cy="272" rx="46" ry="5" fill={HONEY} opacity="0.16" />

          <g className={styles.body}>
            <Pair>
              {antenna}
              {[UPPER_WING, LOWER_WING].map((d, i) => (
                <g key={d} className={i ? styles.lowerWing : styles.upperWing}>
                  <path d={d} fill={p.wing} />
                  <path d={d} fill={p.comb} />
                  <path d={d} fill="none" stroke={HONEY} strokeWidth={2.2} strokeLinejoin="round" />
                </g>
              ))}
              {limb(LEG, HONEY, 15)}
            </Pair>

            {dress("bottom", BOTTOMS)}
            {dress("shoes", SHOES)}

            <Pair>{limb(ARM, HONEY, 13)}</Pair>
            <path d={rr(91, 110, 18, 16, 4)} fill="#c98a1c" stroke={LINE} strokeWidth={2.4} />
            {dress("top", TOPS)}
            <Pair>
              <circle cx={50} cy={189} r={8.5} fill={p.honey} stroke={LINE} strokeWidth={2.4} />
            </Pair>

            {head}
          </g>
        </>
      )}
    </svg>
  );
}
