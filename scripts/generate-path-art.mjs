/**
 * Paints the Trailhead layer plates. Run: node scripts/generate-path-art.mjs
 * Outputs public/path SVGs, public/path/README.md, and the prototype scene module.
 * Look: soft gradients and clean blooms, in the spirit of the UofTHacks hero.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimize } from "svgo";

const VB = { w: 1440, h: 900 };
const HORIZON = 448;
const PATH_END = 1320;

const LAYERS = [
  { id: "sky", file: "ch1/01-sky.svg", depth: 0, speed: 0.08, mobile: true, role: "Gradient sky, soft clouds, and the meadow ground" },
  { id: "hills", file: "ch1/02-hills.svg", depth: 1, speed: 0.34, mobile: true, role: "Distant hills along the horizon" },
  { id: "path", file: "ch1/03-path.svg", depth: 2, speed: 1.45, mobile: true, role: "Dirt path straight up the centre, from the viewer's feet to the horizon" },
  { id: "mist", file: "ch1/04-mist.svg", depth: 3, speed: 0.62, mobile: true, role: "Soft mist behind the centred title. The title itself is HTML, not this plate" },
  { id: "mid-flowers", file: "ch1/05-mid-flowers.svg", depth: 4, speed: 2.25, mobile: true, role: "Dense flower beds on both sides of the path" },
  { id: "near-flowers", file: "ch1/06-near-flowers.svg", depth: 5, speed: 3.15, mobile: false, role: "Large soft-focus flowers surrounding the viewer" },
  { id: "foreground-stems", file: "ch1/07-foreground-stems.svg", depth: 6, speed: 4.1, mobile: false, role: "Closest blurred blooms at the frame" },
];

const root = path.resolve(import.meta.dirname, "..");
const publicRoot = path.join(root, "public/path");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function svgDoc(body, { style = "" } = {}) {
  const styleBlock = style ? `<style>${style}</style>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB.w} ${VB.h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" overflow="hidden" aria-hidden="true" focusable="false">
${styleBlock}
${body}
</svg>
`;
}

const NOD_STYLE = `
.hh-nod { transform-box: fill-box; transform-origin: 50% 100%; animation-duration: 6.4s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.hh-dew { opacity: 0.7; }
@media (prefers-reduced-motion: no-preference) {
  .hh-nod { animation-name: hh-path-nod; }
  .hh-dew { animation-name: hh-path-glint; animation-duration: 4.8s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
}
@keyframes hh-path-nod {
  0%, 100% { transform: rotate(-2.2deg); }
  50% { transform: rotate(2.4deg); }
}
@keyframes hh-path-glint {
  0%, 100% { opacity: 0.15; }
  48% { opacity: 0.95; }
  64% { opacity: 0.2; }
}
`;

const PAINT = `
<linearGradient id="petal-white" x1="0" y1="1" x2="0" y2="0">
  <stop offset="0%" stop-color="#F3F6EA"/>
  <stop offset="100%" stop-color="#FFFFFF"/>
</linearGradient>
<radialGradient id="daisy-heart" cx="38%" cy="34%" r="68%">
  <stop offset="0%" stop-color="#FFF3C4"/>
  <stop offset="52%" stop-color="#F0C14A"/>
  <stop offset="100%" stop-color="#E09622"/>
</radialGradient>
<radialGradient id="poppy-petal" cx="40%" cy="35%" r="70%">
  <stop offset="0%" stop-color="#FF8B86"/>
  <stop offset="55%" stop-color="#E45462"/>
  <stop offset="100%" stop-color="#C43B55"/>
</radialGradient>
<radialGradient id="butter-petal" cx="40%" cy="35%" r="70%">
  <stop offset="0%" stop-color="#FFF4B0"/>
  <stop offset="60%" stop-color="#F6C53A"/>
  <stop offset="100%" stop-color="#E2A41E"/>
</radialGradient>
<radialGradient id="lupin-bloom" cx="40%" cy="30%" r="75%">
  <stop offset="0%" stop-color="#E4D9FF"/>
  <stop offset="55%" stop-color="#8E78D8"/>
  <stop offset="100%" stop-color="#6A52B8"/>
</radialGradient>
<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#8ED56A"/>
  <stop offset="100%" stop-color="#2F8A46"/>
</linearGradient>
<linearGradient id="stem" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#7BC85A"/>
  <stop offset="100%" stop-color="#2E7A3E"/>
</linearGradient>
`;

function pathPoint(t) {
  return { x: 720, y: lerp(HORIZON, PATH_END, t) };
}

function pathHalf(t) {
  return lerp(9, 250, Math.pow(t, 1.18));
}

function ribbonPath(scale) {
  const left = [];
  const right = [];
  const steps = 36;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const p = pathPoint(t);
    const half = pathHalf(t) * scale;
    left.push([p.x - half, p.y]);
    right.push([p.x + half, p.y]);
  }
  const point = (pt) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
  const edge = left.map((pt, i) => `${i === 0 ? "M" : "L"}${point(pt)}`).join(" ");
  const back = [...right].reverse().map((pt) => `L${point(pt)}`).join(" ");
  return `${edge} ${back} Z`;
}

function daisy() {
  const petals = Array.from({ length: 11 }, (_, i) => {
    const tilt = (i % 2 === 0 ? 13.4 : 12.2);
    return `<ellipse cx="0" cy="-15.5" rx="5.6" ry="${tilt}" fill="url(#petal-white)" transform="rotate(${(i * 360) / 11})"/>`;
  }).join("");
  return `<g>${petals}<circle r="6.6" fill="url(#daisy-heart)"/><circle cx="-1.8" cy="-2.2" r="2" fill="#FFF8DC" opacity="0.9"/></g>`;
}

function poppy() {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = -90 + i * 72;
    return `<ellipse cx="0" cy="-11" rx="10" ry="13" fill="url(#poppy-petal)" transform="rotate(${angle})"/>`;
  }).join("");
  return `<g>${petals}<circle r="5.2" fill="#5C2430"/><circle cx="-1.2" cy="-1.4" r="1.5" fill="#F6C56A" opacity="0.85"/></g>`;
}

function buttercup() {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = -90 + i * 72;
    return `<circle cx="0" cy="-10" r="8.2" fill="url(#butter-petal)" transform="rotate(${angle})"/>`;
  }).join("");
  return `<g>${petals}<circle r="4.2" fill="#E89A16"/></g>`;
}

function lupin() {
  const blooms = Array.from({ length: 9 }, (_, i) => {
    const y = -8 - i * 6.2;
    const rx = 7.2 - i * 0.42;
    return `<ellipse cx="0" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="5.2" fill="url(#lupin-bloom)" opacity="${(0.78 + (i % 3) * 0.07).toFixed(2)}"/>`;
  }).join("");
  return `<g>${blooms}</g>`;
}

function bloom(type) {
  switch (type) {
    case "poppy":
      return poppy();
    case "buttercup":
      return buttercup();
    case "lupin":
      return lupin();
    default:
      return daisy();
  }
}

function stem(length) {
  return `<path d="M0 4 C -1.2 ${length * 0.45} 1.4 ${length * 0.72} 0 ${length}" fill="none" stroke="url(#stem)" stroke-width="2.3" stroke-linecap="round"/>
    <ellipse cx="-11" cy="${(length * 0.48).toFixed(1)}" rx="12" ry="4.6" fill="url(#leaf)" transform="rotate(-38 -11 ${(length * 0.48).toFixed(1)})" opacity="0.95"/>
    <ellipse cx="12" cy="${(length * 0.62).toFixed(1)}" rx="11" ry="4.2" fill="url(#leaf)" transform="rotate(32 12 ${(length * 0.62).toFixed(1)})" opacity="0.9"/>`;
}

function bloomId(type) {
  if (type === "poppy" || type === "buttercup" || type === "lupin") return type;
  return "daisy";
}

function placeFlower({ type, x, y, scale, rotate = 0, nod = false, dew = false, stemLength = 54, delay = 0, symbol = false }) {
  const motion = nod ? ` class="hh-nod" style="animation-delay:${delay.toFixed(2)}s"` : "";
  const glint = dew ? `<circle cx="8" cy="-18" r="2.1" fill="#FFFFFF" class="hh-dew"/>` : "";
  const head = symbol
    ? `<use href="#bloom-${bloomId(type)}" y="${type === "lupin" ? -6 : -8}"/>${glint}`
    : `<g transform="translate(0 ${type === "lupin" ? -6 : -8})">${bloom(type)}${glint}</g>`;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)}) scale(${scale.toFixed(3)})">
    <g${motion}>${stem(stemLength)}${head}</g>
  </g>`;
}

function blade(x, y, h, lean, color) {
  return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} C ${(x + lean * 0.3).toFixed(1)} ${(y - h * 0.45).toFixed(1)} ${(x + lean).toFixed(1)} ${(y - h * 0.75).toFixed(1)} ${(x + lean * 0.6).toFixed(1)} ${(y - h).toFixed(1)}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" opacity="0.85"/>`;
}

function skyLayer() {
  const rand = mulberry32(4);
  const blades = [];
  for (let i = 0; i < 90; i += 1) {
    const y = 500 + rand() * 430;
    const x = rand() * 1440;
    const t = Math.min(1, Math.max(0, (y - HORIZON) / (PATH_END - HORIZON)));
    if (Math.abs(x - 720) < pathHalf(t) + 8) continue;
    const colors = ["#3C9A52", "#2F8644", "#67B85A", "#1F6E38"];
    blades.push(blade(x, y, 16 + rand() * 28, (rand() - 0.5) * 14, colors[i % colors.length]));
  }
  return svgDoc(`
    <defs>
      <linearGradient id="sky-wash" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6EB6F0"/>
        <stop offset="38%" stop-color="#B7DFF8"/>
        <stop offset="62%" stop-color="#F4F8FC"/>
        <stop offset="78%" stop-color="#D7E7B0"/>
        <stop offset="100%" stop-color="#7FBE62"/>
      </linearGradient>
      <linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#C9E39A"/>
        <stop offset="45%" stop-color="#7EBE5C"/>
        <stop offset="100%" stop-color="#2F7A40"/>
      </linearGradient>
      <filter id="cloud-soft" x="-20%" y="-40%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="10"/>
      </filter>
    </defs>
    <rect width="1440" height="900" fill="url(#sky-wash)"/>
    <g filter="url(#cloud-soft)" fill="#FFFFFF" opacity="0.85">
      <ellipse cx="250" cy="150" rx="120" ry="28"/>
      <ellipse cx="330" cy="168" rx="70" ry="22"/>
      <ellipse cx="1120" cy="190" rx="140" ry="30"/>
      <ellipse cx="1220" cy="210" rx="80" ry="22"/>
      <ellipse cx="760" cy="96" rx="90" ry="20" opacity="0.7"/>
    </g>
    <path d="M0 560 C 220 500, 460 540, 720 508 C 980 476, 1200 530, 1440 490 L1440 900 L0 900 Z" fill="url(#meadow)"/>
    <path d="M0 690 C 260 620, 520 680, 780 640 C 1040 600, 1240 660, 1440 630 L1440 900 L0 900 Z" fill="#3E9450" opacity="0.35"/>
    ${blades.join("")}
  `);
}

function hillsLayer() {
  return svgDoc(`
    <defs>
      <linearGradient id="hill-a" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#D5EEC0"/>
        <stop offset="100%" stop-color="#8FCB6E"/>
      </linearGradient>
      <linearGradient id="hill-b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#B7D98A"/>
        <stop offset="100%" stop-color="#5EAA58"/>
      </linearGradient>
      <linearGradient id="hill-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="42%" stop-color="#FFFFFF"/>
        <stop offset="78%" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
      <filter id="hill-soft" x="-8%" y="-30%" width="116%" height="170%">
        <feGaussianBlur stdDeviation="8"/>
      </filter>
      <mask id="hill-mask">
        <rect width="1440" height="900" fill="url(#hill-fade)"/>
      </mask>
    </defs>
    <g filter="url(#hill-soft)" mask="url(#hill-mask)">
      <path d="M0 470 C 180 430, 340 455, 520 438 C 700 420, 760 448, 900 432 C 1100 410, 1280 450, 1440 428 L1440 760 L0 760 Z" fill="url(#hill-a)"/>
      <path d="M-20 500 C 200 470, 420 510, 680 488 C 940 466, 1160 508, 1460 478 L1460 800 L-20 800 Z" fill="url(#hill-b)" opacity="0.85"/>
    </g>
  `);
}

function pathLayer() {
  const rand = mulberry32(19);
  const grit = [];
  for (let i = 0; i < 80; i += 1) {
    const t = 0.08 + Math.pow(rand(), 0.72) * 0.92;
    const p = pathPoint(Math.min(t, 1));
    const half = pathHalf(Math.min(t, 1)) * 0.72;
    const x = p.x + (rand() - 0.5) * 2 * half;
    const radius = 1.1 + rand() * (1.6 + t * 5);
    grit.push(
      `<ellipse cx="${x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="${radius.toFixed(1)}" ry="${(radius * 0.55).toFixed(1)}" fill="${rand() > 0.55 ? "#A8875C" : "#F6E6C4"}" opacity="${(0.15 + Math.min(t, 1) * 0.4).toFixed(2)}"/>`,
    );
  }
  return svgDoc(`
    <defs>
      <linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E7D2A4"/>
        <stop offset="40%" stop-color="#D2B07A"/>
        <stop offset="100%" stop-color="#B88956"/>
      </linearGradient>
      <linearGradient id="dirt-light" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F6E7C4"/>
        <stop offset="100%" stop-color="#E2C48E"/>
      </linearGradient>
      <linearGradient id="grit-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
        <stop offset="16%" stop-color="#FFFFFF" stop-opacity="0.2"/>
        <stop offset="42%" stop-color="#FFFFFF"/>
      </linearGradient>
      <radialGradient id="path-haze" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#F7FBFF" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#F7FBFF" stop-opacity="0"/>
      </radialGradient>
      <mask id="grit-mask">
        <rect width="1440" height="900" fill="url(#grit-fade)"/>
      </mask>
    </defs>
    <path d="${ribbonPath(1)}" fill="url(#dirt)"/>
    <path d="${ribbonPath(0.46)}" fill="url(#dirt-light)" opacity="0.78"/>
    <g mask="url(#grit-mask)">${grit.join("")}</g>
    <ellipse cx="720" cy="452" rx="86" ry="22" fill="url(#path-haze)"/>
  `);
}

function mistLayer() {
  return svgDoc(`
    <defs>
      <filter id="mist" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="28"/>
      </filter>
    </defs>
    <ellipse cx="720" cy="390" rx="280" ry="120" fill="#FFFFFF" opacity="0.28" filter="url(#mist)"/>
  `);
}

const KINDS = ["daisy", "daisy", "daisy", "poppy", "buttercup", "lupin", "daisy"];

function bed(seed, count, { nod = false, minScale = 0.28, maxScale = 1.05, reach = 340 } = {}) {
  const rand = mulberry32(seed);
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const t = 0.04 + rand() * 0.62;
    const side = i % 2 === 0 ? -1 : 1;
    const p = pathPoint(t);
    const extra = 26 + rand() * reach;
    const x = 720 + side * (pathHalf(t) + extra);
    const y = p.y + (rand() - 0.5) * 36;
    if (x < -40 || x > 1480 || y > 980) continue;
    const type = KINDS[Math.floor(rand() * KINDS.length)];
    const scale = lerp(minScale, maxScale, t) * (0.82 + rand() * 0.36);
    marks.push(placeFlower({
      type,
      x,
      y,
      scale,
      rotate: (rand() - 0.5) * 16,
      nod,
      dew: nod && rand() > 0.72,
      stemLength: type === "lupin" ? 70 : 52,
      delay: -rand() * 6,
      symbol: true,
    }));
  }
  return marks.join("");
}

function grassBed(seed, count) {
  const rand = mulberry32(seed);
  const colors = ["#2F8A44", "#3E9E55", "#1E7038", "#68B85A"];
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const t = 0.05 + rand() * 0.7;
    const side = rand() < 0.5 ? -1 : 1;
    const p = pathPoint(t);
    const x = 720 + side * (pathHalf(t) + 10 + rand() * 420);
    const y = p.y + (rand() - 0.4) * 20;
    marks.push(blade(x, y, 14 + rand() * 36, side * (4 + rand() * 10), colors[i % colors.length]));
  }
  return marks.join("");
}

function horizonBed() {
  const rand = mulberry32(77);
  const marks = [];
  for (let i = 0; i < 84; i += 1) {
    const t = 0.015 + rand() * 0.2;
    const side = i % 2 === 0 ? -1 : 1;
    const p = pathPoint(t);
    const x = 720 + side * (pathHalf(t) + 14 + rand() * 260);
    const y = p.y + (rand() - 0.45) * 28;
    const type = KINDS[Math.floor(rand() * KINDS.length)];
    marks.push(placeFlower({
      type,
      x,
      y,
      scale: lerp(0.2, 0.58, t / 0.22) * (0.86 + rand() * 0.28),
      rotate: (rand() - 0.5) * 22,
      nod: true,
      dew: rand() > 0.82,
      stemLength: 32,
      delay: -rand() * 6,
      symbol: true,
    }));
  }
  return marks.join("");
}

function buttonBed() {
  const rand = mulberry32(91);
  const marks = [];
  for (let i = 0; i < 72; i += 1) {
    const t = 0.045 + rand() * 0.18;
    const side = i % 2 === 0 ? -1 : 1;
    const p = pathPoint(t);
    const x = 720 + side * (pathHalf(t) + 78 + rand() * 170);
    const y = p.y + (rand() - 0.35) * 46;
    const type = KINDS[Math.floor(rand() * KINDS.length)];
    marks.push(placeFlower({
      type,
      x,
      y,
      scale: 0.5 + rand() * 0.42,
      rotate: (rand() - 0.5) * 20,
      nod: true,
      dew: rand() > 0.84,
      stemLength: 40,
      delay: -rand() * 6,
      symbol: true,
    }));
  }
  return marks.join("");
}

function midLayer() {
  const grass = grassBed(11, 280);
  const horizon = horizonBed();
  const buttons = buttonBed();
  const close = bed(21, 110, { nod: true, minScale: 0.34, maxScale: 1.35, reach: 150 });
  const outer = bed(44, 90, { nod: true, minScale: 0.28, maxScale: 1.15, reach: 520 });
  const symbols = ["daisy", "poppy", "buttercup", "lupin"]
    .map((type) => `<symbol id="bloom-${type}" overflow="visible">${bloom(type)}</symbol>`)
    .join("");
  return svgDoc(`<defs>${PAINT}${symbols}</defs>${grass}${horizon}${buttons}${outer}${close}`, { style: NOD_STYLE });
}

function nearLayer() {
  const planted = [
    ["daisy", 80, 820, 1.7],
    ["poppy", 40, 640, 1.45],
    ["buttercup", 180, 900, 1.55],
    ["lupin", 1360, 780, 1.6],
    ["daisy", 1280, 900, 1.75],
    ["poppy", 1460, 680, 1.4],
    ["buttercup", 1180, 860, 1.35],
    ["daisy", 220, 760, 1.2],
  ];
  const body = planted.map(([type, x, y, scale], i) => placeFlower({
    type, x, y, scale, rotate: (i % 2 === 0 ? -8 : 8), stemLength: 64,
  })).join("");
  return svgDoc(`
    <defs>
      ${PAINT}
      <filter id="near-blur" x="-15%" y="-15%" width="130%" height="130%">
        <feGaussianBlur stdDeviation="3.4"/>
      </filter>
    </defs>
    <g filter="url(#near-blur)">${body}</g>
  `);
}

function foregroundLayer() {
  const planted = [
    ["poppy", -20, 980, 2.4],
    ["daisy", 160, 1040, 2.1],
    ["lupin", 1500, 960, 2.2],
    ["buttercup", 1320, 1060, 2.05],
  ];
  const body = planted.map(([type, x, y, scale], i) => placeFlower({
    type, x, y, scale, rotate: i % 2 === 0 ? -12 : 10, stemLength: 80,
  })).join("");
  return svgDoc(`
    <defs>
      ${PAINT}
      <filter id="fg-blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6"/>
      </filter>
    </defs>
    <g filter="url(#fg-blur)" opacity="0.92">${body}</g>
  `);
}

function wallLayer(side) {
  const rand = mulberry32(side === "left" ? 5 : 9);
  const x0 = side === "left" ? -120 : 560;
  const x1 = side === "left" ? 920 : 1600;
  const span = x1 - x0;
  const tints = ["#FFF6E4", "#F7C9C4", "#E4D4FA", "#F8E7A4", "#C6E4A8", "#FFFFFF"];
  const wash = [];
  for (let i = 0; i < 34; i += 1) {
    const x = x0 + rand() * span;
    const y = -30 + rand() * 980;
    const tint = tints[Math.floor(rand() * tints.length)];
    wash.push(
      `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(70 + rand() * 110).toFixed(1)}" ry="${(54 + rand() * 80).toFixed(1)}" fill="${tint}" opacity="${(0.28 + rand() * 0.38).toFixed(2)}"/>`,
    );
  }
  const far = [];
  const mid = [];
  const near = [];
  const cols = 7;
  const rows = 9;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const depth = rand();
      const x = x0 + ((col + 0.18 + rand() * 0.64) / cols) * span;
      const y = -30 + ((row + 0.12 + rand() * 0.7) / rows) * 1000;
      const type = KINDS[Math.floor(rand() * KINDS.length)];
      const flower = placeFlower({
        type,
        x,
        y,
        scale: depth < 0.34 ? 0.55 + rand() * 0.25 : depth < 0.7 ? 0.85 + rand() * 0.35 : 1.2 + rand() * 0.45,
        rotate: (rand() - 0.5) * 28,
        stemLength: 18 + rand() * 26,
      });
      if (depth < 0.34) far.push(flower);
      else if (depth < 0.7) mid.push(flower);
      else near.push(flower);
      if (rand() > 0.62) {
        const extra = placeFlower({
          type: KINDS[Math.floor(rand() * KINDS.length)],
          x: x + (rand() - 0.5) * 70,
          y: y + (rand() - 0.5) * 54,
          scale: 0.7 + rand() * 0.5,
          rotate: (rand() - 0.5) * 24,
          stemLength: 16 + rand() * 20,
        });
        mid.push(extra);
      }
    }
  }
  return svgDoc(`
    <defs>
      ${PAINT}
      <linearGradient id="wall-wash" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F8E7C8"/>
        <stop offset="46%" stop-color="#F0C2C4"/>
        <stop offset="100%" stop-color="#8FBF78"/>
      </linearGradient>
      <filter id="wall-far" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="4.2"/>
      </filter>
      <filter id="wall-mid" x="-18%" y="-18%" width="136%" height="136%">
        <feGaussianBlur stdDeviation="2.1"/>
      </filter>
      <filter id="wall-near" x="-12%" y="-12%" width="124%" height="124%">
        <feGaussianBlur stdDeviation="0.45"/>
      </filter>
      <filter id="wall-wash-blur" x="-15%" y="-15%" width="130%" height="130%">
        <feGaussianBlur stdDeviation="14"/>
      </filter>
      <linearGradient id="wall-edge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1440" y2="0">
        ${side === "left"
          ? `<stop offset="0%" stop-color="#fff"/><stop offset="58%" stop-color="#fff"/><stop offset="78%" stop-color="#fff" stop-opacity="0"/>`
          : `<stop offset="22%" stop-color="#fff" stop-opacity="0"/><stop offset="42%" stop-color="#fff"/><stop offset="100%" stop-color="#fff"/>`}
      </linearGradient>
      <mask id="wall-fade">
        <rect width="1440" height="900" fill="url(#wall-edge)"/>
      </mask>
    </defs>
    <g mask="url(#wall-fade)">
      <rect width="1440" height="900" fill="url(#wall-wash)"/>
      <g filter="url(#wall-wash-blur)">${wash.join("")}</g>
      <g filter="url(#wall-far)" opacity="0.8">${far.join("")}</g>
      <g filter="url(#wall-mid)" opacity="0.94">${mid.join("")}</g>
      <g filter="url(#wall-near)">${near.join("")}</g>
    </g>
  `);
}

function readme() {
  const rows = LAYERS.map(
    (layer) =>
      `| ${layer.depth} | \`${layer.file}\` | ${layer.speed.toFixed(2)} | ${layer.mobile ? "yes" : "no — hide below 768px"} | ${layer.role} |`,
  ).join("\n");
  return `# Walk the Path — Chapter 1 layers

Painted plates for the Trailhead hero and the petal-wall curtain.
The look-sign-off route is \`/prototype/path\`. The live homepage does not use these files.

Every plate uses viewBox \`0 0 ${VB.w} ${VB.h}\` and \`preserveAspectRatio="xMidYMid slice"\`.
Stack back to front. Scale each plate from the horizon: \`scale(1 + speed * walk)\` with origin \`50% 49.8%\`, where \`walk\` is 0 at the trailhead and 1 after the step forward. Higher speed is nearer, so it moves outward fastest. Path and mid-flower speeds are high so the step reads as walking into the flowers.

## Depth order

| Order | File | Speed | Below 768px | Role |
| ---: | --- | ---: | --- | --- |
${rows}

## Petal wall

| File | Role |
| --- | --- |
| \`transition/petal-wall-left.svg\` | Left half of the near-flower curtain |
| \`transition/petal-wall-right.svg\` | Right half of the near-flower curtain |

These sit in front of every chapter plate. Part them on X: left \`translateX(-open * 105%)\`, right \`translateX(open * 105%)\`. \`open\` 1 is fully parted. \`open\` 0 is the closed wall. The halves overlap through the center so the seam is flowers, not a gap. The curtain is soft: blurred depth bands, uneven clusters, and a gradient tint, in the same language as the near flowers. The prototype mounts these two images only after scroll passes about 0.35, so they are not part of the first paint.

The wall closes over the approach, then parts onto a prototype-only Chapter 2 placeholder. That placeholder is HTML, not a depth plate. The centred Chapter 1 title fades with the closing wall and stays hidden.

## Title

The wooden sign is gone. \`HackHive\`, \`Jan 29–31, 2027\`, and Join (\`/apply\`) are HTML centred on the prototype, above the plates and under the petal wall. Learn more links to \`/#faq\`.

## Motion

Mid-flower groups use class \`hh-nod\`. Dew uses class \`hh-dew\`.
Both animate only for \`prefers-reduced-motion: no-preference\`, and only when the SVG is inlined. An \`<img>\` plate stays still. Drifting petals are a prototype overlay, not a depth plate.
`;
}

function sceneModule(midSvg) {
  const layerEntries = LAYERS.map(
    (layer) =>
      `  { id: "${layer.id}", file: "${layer.file}", src: "/path/${layer.file}", depth: ${layer.depth}, speed: ${layer.speed}, mobile: ${layer.mobile} },`,
  ).join("\n");
  const inline = midSvg.replace(/^<\?xml[^>]*>\s*/, "");
  return `// Generated by scripts/generate-path-art.mjs. Do not edit by hand.
export const VIEWBOX = { width: ${VB.w}, height: ${VB.h} } as const;

export const layers = [
${layerEntries}
] as const;

export const walls = {
  left: { file: "transition/petal-wall-left.svg", src: "/path/transition/petal-wall-left.svg" },
  right: { file: "transition/petal-wall-right.svg", src: "/path/transition/petal-wall-right.svg" },
} as const;

export const midFlowersSvg = ${JSON.stringify(inline)};
`;
}

function minifySvg(svg) {
  const before = Buffer.byteLength(svg);
  const result = optimize(svg, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false,
            collapseGroups: false,
            convertTransform: false,
            minifyStyles: false,
            moveElemsAttrsToGroup: false,
            moveGroupAttrsToElems: false,
          },
        },
      },
    ],
  });
  const out = result.data.endsWith("\n") ? result.data : `${result.data}\n`;
  console.log(`SVGO mid-flowers ${before} -> ${Buffer.byteLength(out)} bytes`);
  return out;
}

const midSvg = minifySvg(midLayer());
if (!midSvg.includes("hh-nod") || !midSvg.includes("hh-path-nod")) {
  throw new Error("SVGO removed the mid-flower motion hooks");
}

const files = {
  "ch1/01-sky.svg": skyLayer(),
  "ch1/02-hills.svg": hillsLayer(),
  "ch1/03-path.svg": pathLayer(),
  "ch1/04-mist.svg": mistLayer(),
  "ch1/05-mid-flowers.svg": midSvg,
  "ch1/06-near-flowers.svg": nearLayer(),
  "ch1/07-foreground-stems.svg": foregroundLayer(),
  "transition/petal-wall-left.svg": wallLayer("left"),
  "transition/petal-wall-right.svg": wallLayer("right"),
};

await mkdir(path.join(publicRoot, "ch1"), { recursive: true });
await mkdir(path.join(publicRoot, "transition"), { recursive: true });
await Promise.all(
  Object.entries(files).map(([file, svg]) => writeFile(path.join(publicRoot, file), svg)),
);
await writeFile(path.join(publicRoot, "README.md"), readme());
await rm(path.join(publicRoot, "ch1/02-far-trees.svg"), { force: true });
await rm(path.join(publicRoot, "ch1/04-sign.svg"), { force: true });
await writeFile(
  path.join(root, "src/app/prototype/path/scene.ts"),
  sceneModule(files["ch1/05-mid-flowers.svg"]),
);
console.log("Wrote path art layers:");
for (const file of Object.keys(files)) console.log(`  public/path/${file}`);
