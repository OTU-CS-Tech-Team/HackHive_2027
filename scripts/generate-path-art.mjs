/**
 * Paints the Trailhead layer plates. Run: node scripts/generate-path-art.mjs
 * Outputs public/path SVGs, public/path/README.md, and the prototype scene module.
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const VB = { w: 1440, h: 900 };

const BOARD = { x: 530, y: 424, w: 280, h: 146 };
const JOIN = { x: 530, y: 586, w: 130, h: 48 };
const LEARN = { x: 672, y: 586, w: 138, h: 48 };

const LAYERS = [
  { id: "sky", file: "ch1/01-sky.svg", depth: 0, speed: 0.05, mobile: true, role: "Morning sky, sun, and meadow ground" },
  { id: "far-trees", file: "ch1/02-far-trees.svg", depth: 1, speed: 0.16, mobile: true, role: "Horizon trees, left cluster and right tree" },
  { id: "path", file: "ch1/03-path.svg", depth: 2, speed: 0.32, mobile: true, role: "Dirt path from the sign toward the viewer" },
  { id: "sign", file: "ch1/04-sign.svg", depth: 3, speed: 0.46, mobile: true, role: "Wooden HackHive sign" },
  { id: "mid-flowers", file: "ch1/05-mid-flowers.svg", depth: 4, speed: 0.68, mobile: true, role: "Sharp flower beds along the path" },
  { id: "near-flowers", file: "ch1/06-near-flowers.svg", depth: 5, speed: 1.05, mobile: false, role: "Large soft-focus flowers at the frame" },
  { id: "foreground-stems", file: "ch1/07-foreground-stems.svg", depth: 6, speed: 1.5, mobile: false, role: "Closest blurred stems and leaves" },
];

const root = path.resolve(import.meta.dirname, "..");
const publicRoot = path.join(root, "public/path");
const lettering = JSON.parse(readFileSync(new URL("./sign-lettering.json", import.meta.url), "utf8"));

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

function cubic(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function pathPoint(t) {
  return {
    x: cubic(t, 870, 1000, 1060, 920),
    y: cubic(t, 555, 780, 1040, 1520),
  };
}

function pathWidth(t) {
  return lerp(36, 300, Math.pow(t, 1.15));
}

function pathNormal(t) {
  const dt = 0.012;
  const a = pathPoint(Math.max(0, t - dt));
  const b = pathPoint(Math.min(1, t + dt));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function ribbonPath(widthMul, shiftX, shiftY) {
  const left = [];
  const right = [];
  const steps = 32;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const p = pathPoint(t);
    const n = pathNormal(t);
    const w = pathWidth(t) * widthMul;
    const jag = Math.sin(t * 6) * 1.6 * widthMul;
    left.push([p.x + n.x * (w + jag) + shiftX, p.y + n.y * (w + jag) + shiftY]);
    right.push([p.x - n.x * (w - jag * 0.4) + shiftX, p.y - n.y * (w - jag * 0.4) + shiftY]);
  }
  const line = (pts) => pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ");
  return `${line(left)} ${line([...right].reverse())} Z`;
}

function svgDoc(prefix, body, { style = "" } = {}) {
  const styleBlock = style ? `<style>${style}</style>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB.w} ${VB.h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" overflow="hidden" aria-hidden="true" focusable="false">
${styleBlock}
${body}
</svg>
`;
}

const NOD_STYLE = `
.hh-nod { transform-box: fill-box; transform-origin: 50% 100%; animation-duration: 6.2s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.hh-dew { opacity: 0.82; }
@media (prefers-reduced-motion: no-preference) {
  .hh-nod { animation-name: hh-path-nod; }
  .hh-dew { animation-name: hh-path-glint; animation-duration: 4.6s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
}
@keyframes hh-path-nod {
  0%, 100% { transform: rotate(-2.3deg); }
  50% { transform: rotate(2.6deg); }
}
@keyframes hh-path-glint {
  0%, 100% { opacity: 0.2; }
  46% { opacity: 1; }
  62% { opacity: 0.28; }
}
`;

function leafPair(stem, rand) {
  const y1 = -stem * (0.38 + rand() * 0.08);
  const y2 = -stem * (0.55 + rand() * 0.1);
  return `
    <ellipse cx="-22" cy="${y1.toFixed(1)}" rx="18" ry="7.5" fill="#6EA44C" stroke="#24341C" stroke-width="1.7" transform="rotate(-42 -22 ${y1.toFixed(1)})"/>
    <ellipse cx="24" cy="${y2.toFixed(1)}" rx="16" ry="6.5" fill="#8FBF68" stroke="#24341C" stroke-width="1.7" transform="rotate(34 24 ${y2.toFixed(1)})"/>
  `;
}

function flowerInner(type, rand, stem) {
  const stemDraw = `
    <path d="M0 ${(-stem).toFixed(1)} C ${(-2 - rand() * 2).toFixed(1)} ${(-stem * 0.5).toFixed(1)} 2 0 1.2 0" fill="none" stroke="#3E6B32" stroke-width="3.4" stroke-linecap="round"/>
    ${leafPair(stem, rand)}
  `;
  if (type === "daisy") {
    const petals = Array.from({ length: 8 }, (_, i) => {
      const rot = i * 45 + (rand() - 0.5) * 7;
      const len = 30 + rand() * 5;
      const fill = i % 2 === 0 ? "#FFFEF8" : "#F3EFE4";
      return `<path d="M0,-7 C 7,-12 8,${(-len + 8).toFixed(1)} 0,${(-len).toFixed(1)} C -8,${(-len + 8).toFixed(1)} -7,-12 0,-7 Z" fill="${fill}" stroke="#E3DCCC" stroke-width="1.1" transform="rotate(${rot.toFixed(1)})"/>`;
    }).join("");
    return `${stemDraw}
      <g transform="translate(0 ${(-stem).toFixed(1)})">
        ${petals}
        <circle r="10" fill="#F0B429" stroke="#C89216" stroke-width="1.5"/>
        <circle r="5" fill="#E39B14"/>
        <circle cx="-4" cy="-5" r="2.3" fill="#FFF8DC" class="hh-dew"/>
      </g>`;
  }
  if (type === "poppy") {
    const tilt = (rand() - 0.5) * 12;
    return `${stemDraw}
      <g transform="translate(0 ${(-stem).toFixed(1)}) rotate(${tilt.toFixed(1)})">
        <path d="M-6,8 C -40,-6 -38,-40 -8,-30 C 0,-26 2,-4 -6,8 Z" fill="#C73338" stroke="#7A2428" stroke-width="1.6"/>
        <path d="M8,8 C 42,-4 40,-42 8,-32 C 0,-26 -2,-2 8,8 Z" fill="#E24B4A" stroke="#7A2428" stroke-width="1.6"/>
        <path d="M0,-2 C -22,-40 -2,-52 0,-32 C 4,-52 24,-40 0,-2 Z" fill="#F06A58" stroke="#7A2428" stroke-width="1.6"/>
        <path d="M0,4 C -18,26 18,28 0,4 Z" fill="#B82E36" stroke="#7A2428" stroke-width="1.4"/>
        <circle cy="1" r="8.5" fill="#241C16"/>
        <g fill="#F2C63D">
          <circle cx="-3.2" cy="-1" r="1.45"/>
          <circle cx="3" cy="-0.4" r="1.45"/>
          <circle cx="0.4" cy="3.2" r="1.35"/>
          <circle cx="2.4" cy="-3.6" r="1.15"/>
          <circle cx="-2.2" cy="2.4" r="1.15"/>
        </g>
        <ellipse cx="-12" cy="-18" rx="5" ry="2.4" fill="#fff" opacity="0.35" transform="rotate(-28 -12 -18)"/>
        <circle cx="14" cy="-16" r="2.5" fill="#FFF8DC" class="hh-dew"/>
      </g>`;
  }
  if (type === "lupin") {
    const florets = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      const y = -stem * (0.28 + t * 0.72);
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (6 + (1 - t) * 7);
      const rx = 8 * (1 - t * 0.45);
      const ry = 9.5 * (1 - t * 0.38);
      const fill = t > 0.78 ? "#D2C2E6" : t > 0.45 ? "#9478BE" : "#6A4C98";
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" stroke="#3C2A58" stroke-width="1.15"/>
        <ellipse cx="${(x + side * 1.2).toFixed(1)}" cy="${(y - ry * 0.15).toFixed(1)}" rx="${(rx * 0.42).toFixed(1)}" ry="${(ry * 0.32).toFixed(1)}" fill="#F6EEFF" opacity="0.7"/>`;
    }).join("");
    return `
      <path d="M0 ${(-stem * 0.22).toFixed(1)} C -1 ${(-stem * 0.5).toFixed(1)} 1 ${(-stem).toFixed(1)} 0 ${(-stem).toFixed(1)}" fill="none" stroke="#3E6B32" stroke-width="3.2" stroke-linecap="round"/>
      ${leafPair(stem * 0.75, rand)}
      ${florets}
      <circle cx="5" cy="${(-stem + 6).toFixed(1)}" r="2.2" fill="#FFF8DC" class="hh-dew"/>
    `;
  }
  if (type === "buttercup") {
    const petals = Array.from({ length: 5 }, (_, i) => {
      const a = ((-90 + i * 72 + (rand() - 0.5) * 8) * Math.PI) / 180;
      const cx = Math.cos(a) * 15;
      const cy = Math.sin(a) * 15;
      const fill = i % 2 === 0 ? "#F6D34A" : "#F0C22A";
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="13" fill="${fill}" stroke="#C89214" stroke-width="1.45"/>`;
    }).join("");
    return `${stemDraw}
      <g transform="translate(0 ${(-stem).toFixed(1)})">
        ${petals}
        <circle r="7" fill="#E8A61C" stroke="#C89214" stroke-width="1.2"/>
        <circle r="2.8" fill="#6E9A40"/>
        <circle cx="-5" cy="-7" r="2.2" fill="#FFF8DC" class="hh-dew"/>
      </g>`;
  }
  throw new Error(`Unknown flower ${type}`);
}

function placeFlower({ type, x, y, scale = 1, rotate = 0, stem = 78, i = 0, nod = true }) {
  const rand = mulberry32(4000 + i * 17 + Math.round(x + y));
  const delay = (-(i * 0.47) % 6).toFixed(2);
  const duration = (5.4 + (i % 5) * 0.55).toFixed(2);
  const inner = nod
    ? `<g class="hh-nod" style="animation-delay:${delay}s;animation-duration:${duration}s">${flowerInner(type, rand, stem)}</g>`
    : flowerInner(type, rand, stem);
  const shadow = `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(16 * scale).toFixed(1)}" ry="${(5 * scale).toFixed(1)}" fill="#9AAE74" opacity="0.45"/>`;
  return `${shadow}
    <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate}) scale(${scale})">${inner}</g>`;
}

function canopy(cx, cy, r, { distant = false } = {}) {
  const ink = distant ? "#3A4E30" : "#24341C";
  const mid = distant ? "#8FB56A" : "#6EA44A";
  const dark = distant ? "#6E9850" : "#4C8636";
  const light = distant ? "#C5DE9A" : "#A8D27C";
  const trunk = distant ? "#A68458" : "#8A6240";
  return `
    <ellipse cx="${cx}" cy="${(cy + r * 0.78).toFixed(1)}" rx="${(r * 0.62).toFixed(1)}" ry="${(r * 0.13).toFixed(1)}" fill="#A9C288" opacity="0.55"/>
    <path d="M${cx - r * 0.08} ${cy + r * 0.2} Q ${cx} ${cy + r * 0.95} ${cx - r * 0.1} ${cy + r * 1.02} L ${cx + r * 0.16} ${cy + r * 1.02} Q ${cx + r * 0.08} ${cy + r * 0.9} ${cx + r * 0.1} ${cy + r * 0.2} Z" fill="${trunk}" stroke="#4A301C" stroke-width="2"/>
    <circle cx="${(cx - r * 0.32).toFixed(1)}" cy="${(cy + r * 0.08).toFixed(1)}" r="${(r * 0.58).toFixed(1)}" fill="${dark}" stroke="${ink}" stroke-width="3"/>
    <circle cx="${(cx + r * 0.34).toFixed(1)}" cy="${(cy + r * 0.02).toFixed(1)}" r="${(r * 0.56).toFixed(1)}" fill="${mid}" stroke="${ink}" stroke-width="3"/>
    <circle cx="${cx}" cy="${(cy - r * 0.16).toFixed(1)}" r="${(r * 0.7).toFixed(1)}" fill="${mid}" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="${(cx - r * 0.16).toFixed(1)}" cy="${(cy - r * 0.38).toFixed(1)}" rx="${(r * 0.28).toFixed(1)}" ry="${(r * 0.18).toFixed(1)}" fill="${light}"/>
  `;
}

function tuft(x, y, s, rot = 0) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${s})" fill="none" stroke="#6D8E46" stroke-width="2.2" stroke-linecap="round">
    <path d="M0 0 C -3 -12 -8 -16 -11 -22"/>
    <path d="M0 0 C 0 -14 1 -18 0 -26"/>
    <path d="M0 0 C 4 -12 9 -15 13 -20"/>
  </g>`;
}

function loosePetal(kind) {
  if (kind === "daisy") {
    const petals = [0, 60, 120, 180, 240, 300]
      .map((angle) => `<ellipse rx="6" ry="13" fill="#FFFEF8" stroke="#E4DECF" stroke-width="0.8" transform="rotate(${angle})"/>`)
      .join("");
    return `<g>${petals}<circle r="5" fill="#F0B429" stroke="#C89216" stroke-width="0.8"/></g>`;
  }
  if (kind === "poppy") {
    return `<path d="M0,20 C 22,12 30,-18 0,-34 C -30,-18 -22,12 0,20 Z" fill="#E24B4A" stroke="#7A2428" stroke-width="1.6"/>`;
  }
  if (kind === "buttercup") {
    return `<circle r="18" fill="#F2C63D" stroke="#C89214" stroke-width="1.5"/>`;
  }
  if (kind === "lupin") {
    return `<ellipse rx="10" ry="16" fill="#7D5BA6" stroke="#3C2A58" stroke-width="1.3"/>`;
  }
  return `<ellipse rx="12" ry="26" fill="#6EA44C" stroke="#24341C" stroke-width="1.5" transform="rotate(18)"/>`;
}

function sprig(x, y, rot, scale) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})" stroke-linejoin="round">
    <path d="M0,0 C 36,-18 78,-20 118,-4" fill="none" stroke="#3E6A30" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="40" cy="-12" rx="18" ry="8" fill="#6EA44C" stroke="#24341C" stroke-width="1.6" transform="rotate(-36 40 -12)"/>
    <ellipse cx="70" cy="-18" rx="20" ry="8" fill="#8FBF68" stroke="#24341C" stroke-width="1.6" transform="rotate(-16 70 -18)"/>
    <ellipse cx="98" cy="-6" rx="16" ry="7" fill="#5E943E" stroke="#24341C" stroke-width="1.6" transform="rotate(12 98 -6)"/>
    <ellipse cx="54" cy="8" rx="15" ry="7" fill="#7EAE56" stroke="#24341C" stroke-width="1.6" transform="rotate(28 54 8)"/>
    <ellipse cx="86" cy="10" rx="16" ry="7" fill="#6EA44C" stroke="#24341C" stroke-width="1.6" transform="rotate(16 86 10)"/>
  </g>`;
}

function skyLayer() {
  const rand = mulberry32(12);
  const tufts = [];
  for (let i = 0; i < 26; i += 1) {
    const x = 40 + rand() * 1360;
    const y = 470 + rand() * 400;
    const p = nearestPath(x, y);
    if (p.dist < p.width + 18) continue;
    if (x > 500 && x < 830 && y > 400 && y < 760) continue;
    tufts.push(tuft(x, y, 0.55 + rand() * 0.7, (rand() - 0.5) * 16));
  }
  const rays = [-128, -112, -98, -86, -74, -60, -46, -30].map((deg, i) => {
    const len = 168 + (i % 3) * 42;
    const spread = 0.02 + (i % 2) * 0.006;
    const a = (deg * Math.PI) / 180;
    const cx = 720;
    const cy = 228;
    const x0 = cx + Math.cos(a) * 62;
    const y0 = cy + Math.sin(a) * 62;
    const x1 = cx + Math.cos(a - spread) * len;
    const y1 = cy + Math.sin(a - spread) * len;
    const x2 = cx + Math.cos(a + spread) * len;
    const y2 = cy + Math.sin(a + spread) * len;
    return `<polygon points="${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="#FFF6D2" opacity="${(0.28 + (i % 3) * 0.08).toFixed(2)}"/>`;
  }).join("");

  return svgDoc("sky", `
    <defs>
      <linearGradient id="sky-wash" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F6E39A"/>
        <stop offset="38%" stop-color="#FBF6DC"/>
        <stop offset="70%" stop-color="#F8E2B4"/>
      </linearGradient>
      <linearGradient id="sky-meadow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E6F0C6"/>
        <stop offset="48%" stop-color="#D3E4AC"/>
        <stop offset="100%" stop-color="#C2D694"/>
      </linearGradient>
      <radialGradient id="sky-sun" cx="38%" cy="36%" r="70%">
        <stop offset="0%" stop-color="#FFF8D8"/>
        <stop offset="42%" stop-color="#F6C94A"/>
        <stop offset="100%" stop-color="#E8AE2A"/>
      </radialGradient>
      <radialGradient id="sky-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFE7A4" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#FFE7A4" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#sky-wash)"/>
    <g opacity="0.55" fill="#FFF9EC">
      <g transform="translate(250 150)">
        <ellipse cx="0" cy="0" rx="78" ry="22"/>
        <ellipse cx="-40" cy="6" rx="42" ry="16"/>
        <ellipse cx="46" cy="8" rx="48" ry="15"/>
      </g>
      <g transform="translate(1120 180)">
        <ellipse cx="0" cy="0" rx="90" ry="20"/>
        <ellipse cx="-48" cy="6" rx="40" ry="14"/>
        <ellipse cx="50" cy="4" rx="46" ry="14"/>
      </g>
    </g>
    ${rays}
    <circle cx="720" cy="228" r="118" fill="url(#sky-glow)"/>
    <circle cx="720" cy="228" r="54" fill="url(#sky-sun)" stroke="#E0A82A" stroke-width="3"/>
    <ellipse cx="702" cy="212" rx="16" ry="10" fill="#FFFCEC" opacity="0.85"/>
    <path d="M0 418 C 160 386, 320 424, 520 400 C 740 372, 980 412, 1180 388 C 1300 376, 1380 398, 1440 392 L1440 900 L0 900 Z" fill="url(#sky-meadow)"/>
    <path d="M0 430 C 180 404, 360 436, 560 414 C 760 392, 980 428, 1200 406 C 1320 396, 1390 414, 1440 408" fill="none" stroke="#B7CC86" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
    <ellipse cx="280" cy="640" rx="260" ry="70" fill="#E7F3CC" opacity="0.65"/>
    <ellipse cx="1080" cy="760" rx="320" ry="90" fill="#C5D992" opacity="0.4"/>
    <ellipse cx="640" cy="860" rx="280" ry="70" fill="#B9D08A" opacity="0.28"/>
    <ellipse cx="720" cy="460" rx="340" ry="36" fill="#FFF0C8" opacity="0.45"/>
    ${tufts.join("")}
  `);
}

function nearestPath(x, y) {
  let dist = Infinity;
  let width = 0;
  for (let i = 0; i <= 36; i += 1) {
    const t = i / 36;
    const p = pathPoint(t);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < dist) {
      dist = d;
      width = pathWidth(t);
    }
  }
  return { dist, width };
}

function treesLayer() {
  return svgDoc("trees", `
    ${canopy(210, 372, 46, { distant: true })}
    ${canopy(1260, 368, 50, { distant: true })}
    ${canopy(390, 348, 74)}
    ${canopy(470, 322, 90)}
    ${canopy(548, 356, 66)}
    ${canopy(1048, 336, 88)}
    ${canopy(880, 392, 30, { distant: true })}
  `);
}

function pathLayer() {
  const rand = mulberry32(77);
  const pebbles = [];
  const verge = [];
  for (let i = 0; i < 10; i += 1) {
    const t = 0.18 + i * 0.075;
    const p = pathPoint(t);
    const n = pathNormal(t);
    const side = (i % 2 === 0 ? -1 : 1) * (0.15 + (i % 3) * 0.12);
    const x = p.x + n.x * pathWidth(t) * side;
    const y = p.y + n.y * pathWidth(t) * side * 0.35;
    const rx = 4 + (i % 4) * 1.6;
    pebbles.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.72).toFixed(1)}" fill="${i % 2 ? "#C49262" : "#EDD0A4"}" transform="rotate(${i * 18} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
  }
  for (let i = 0; i < 14; i += 1) {
    const t = 0.08 + (i % 7) * 0.12;
    const p = pathPoint(t);
    const n = pathNormal(t);
    const side = i < 7 ? 1 : -1;
    const x = p.x + n.x * side * (pathWidth(t) + 10);
    const y = p.y + n.y * side * 6;
    verge.push(tuft(x, y, 0.7 + rand() * 0.45, side * 8));
  }
  return svgDoc("path", `
    <path d="${ribbonPath(1, 0, 0)}" fill="#C4925C"/>
    <path d="${ribbonPath(0.78, -5, -2)}" fill="#E4BC84"/>
    <path d="${ribbonPath(0.28, -3, -1)}" fill="#F3D7B0" opacity="0.8"/>
    ${pebbles.join("")}
    ${verge.join("")}
  `);
}

function outlinedText(run, cx, baseline, fill) {
  const paths = run.glyphs
    .map(([gx, d]) => `<path d="${d}" transform="translate(${gx} 0)"/>`)
    .join("");
  return `<g fill="${fill}" transform="translate(${cx} ${baseline}) scale(${run.scale} ${-run.scale}) translate(${-run.widthUnits / 2} 0)">${paths}</g>`;
}

function signLayer() {
  const cx = BOARD.x + BOARD.w / 2;
  const { x, y, w, h } = BOARD;
  return svgDoc("sign", `
    <defs>
      <linearGradient id="sign-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E8C48A"/>
        <stop offset="55%" stop-color="#D0964C"/>
        <stop offset="100%" stop-color="#C4843C"/>
      </linearGradient>
      <clipPath id="sign-board">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>
      </clipPath>
    </defs>
    <ellipse cx="${cx}" cy="760" rx="92" ry="14" fill="#A9C288" opacity="0.7"/>
    <rect x="586" y="552" width="16" height="196" rx="4" fill="#6B4426"/>
    <rect x="598" y="552" width="5" height="196" fill="#8A5A34" opacity="0.7"/>
    <rect x="748" y="552" width="16" height="196" rx="4" fill="#6B4426"/>
    <rect x="760" y="552" width="5" height="196" fill="#8A5A34" opacity="0.7"/>
    <rect x="${x}" y="${y + 8}" width="${w}" height="${h}" rx="12" fill="#8A5A30"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="url(#sign-wood)" stroke="#5C3A1E" stroke-width="4"/>
    <g clip-path="url(#sign-board)" fill="none" stroke="#A86B34" stroke-width="2" opacity="0.45" stroke-linecap="round">
      <path d="M${x + 18} ${y + 36} Q ${cx} ${y + 28} ${x + w - 18} ${y + 40}"/>
      <path d="M${x + 16} ${y + 70} Q ${cx} ${y + 78} ${x + w - 20} ${y + 66}"/>
      <path d="M${x + 22} ${y + 108} Q ${cx} ${y + 100} ${x + w - 16} ${y + 112}"/>
    </g>
    <circle cx="${x + 18}" cy="${y + 18}" r="4" fill="#6B4426"/>
    <circle cx="${x + w - 18}" cy="${y + 18}" r="4" fill="#6B4426"/>
    <circle cx="${x + 18}" cy="${y + h - 18}" r="4" fill="#6B4426"/>
    <circle cx="${x + w - 18}" cy="${y + h - 18}" r="4" fill="#6B4426"/>
    ${outlinedText(lettering.title, cx, y + 68, "#3A2616")}
    <path d="M${cx - 28} ${y + 84} H${cx + 28}" stroke="#8A5A30" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    ${outlinedText(lettering.date, cx, y + 112, "#4A321C")}
  `);
}

function midLayer() {
  const planted = [
    ["daisy", 900, 545, 0.34, -6],
    ["buttercup", 780, 590, 0.32, 8],
    ["poppy", 1020, 610, 0.4, -4],
    ["lupin", 960, 500, 0.36, 6],
    ["poppy", 470, 800, 0.95, 8],
    ["lupin", 390, 710, 0.9, -6],
    ["daisy", 250, 780, 0.78, 10],
    ["buttercup", 330, 860, 1.02, -8],
    ["poppy", 180, 700, 0.7, 4],
    ["daisy", 990, 760, 0.88, -8],
    ["buttercup", 1100, 820, 1.02, 7],
    ["lupin", 1180, 690, 0.92, -5],
    ["poppy", 900, 860, 0.98, 9],
    ["daisy", 1260, 800, 0.82, -10],
    ["buttercup", 1080, 620, 0.52, 6],
    ["poppy", 1160, 560, 0.4, -6],
    ["lupin", 620, 870, 0.72, 5],
    ["daisy", 760, 890, 0.78, -7],
    ["buttercup", 540, 880, 0.7, 4],
    ["poppy", 1340, 860, 0.86, 8],
    ["daisy", 140, 860, 0.9, -8],
  ];
  const markup = planted
    .map((spec, i) => {
      const [type, x, y, scale, rotate] = spec;
      return placeFlower({ type, x, y, scale, rotate, i, stem: type === "lupin" ? 96 : 78 });
    })
    .join("");
  return svgDoc("mid", markup, { style: NOD_STYLE });
}

function nearLayer() {
  const planted = [
    ["poppy", 120, 840, 2.15, -8],
    ["daisy", 20, 700, 1.85, 10],
    ["buttercup", 260, 960, 2.3, 6],
    ["lupin", 1320, 860, 2.2, -6],
    ["daisy", 1180, 980, 2.05, 8],
    ["poppy", 1470, 720, 1.7, -12],
    ["buttercup", 70, 960, 1.6, 4],
    ["lupin", 1500, 900, 1.9, 6],
  ];
  const markup = planted
    .map((spec, i) => {
      const [type, x, y, scale, rotate] = spec;
      return placeFlower({ type, x, y, scale, rotate, i: i + 40, nod: false, stem: type === "lupin" ? 90 : 72 });
    })
    .join("");
  return svgDoc("near", `
    <defs>
      <filter id="near-blur" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="4"/>
      </filter>
    </defs>
    <g filter="url(#near-blur)">${markup}</g>
  `);
}

function foregroundLayer() {
  const stems = [
    [-30, 980, 2.6, -16],
    [160, 1040, 2.2, 10],
    [1280, 1020, 2.5, -8],
    [1500, 960, 2.1, 14],
  ];
  const body = stems
    .map(([x, y, scale, rot], i) => {
      const type = ["poppy", "daisy", "lupin", "buttercup", "leaf"][i] === "leaf" ? "buttercup" : ["poppy", "daisy", "lupin", "buttercup", "buttercup"][i];
      return placeFlower({ type, x, y, scale, rotate: rot, i: i + 80, nod: false, stem: 110 });
    })
    .join("");
  const extraLeaves = `
    <g fill="#5E943E" stroke="#24341C" stroke-width="3">
      <ellipse cx="80" cy="860" rx="70" ry="22" transform="rotate(-30 80 860)"/>
      <ellipse cx="180" cy="900" rx="90" ry="26" transform="rotate(18 180 900)"/>
      <ellipse cx="1360" cy="880" rx="86" ry="24" transform="rotate(24 1360 880)"/>
      <ellipse cx="1180" cy="920" rx="74" ry="20" transform="rotate(-16 1180 920)"/>
    </g>
  `;
  return svgDoc("fg", `
    <defs>
      <filter id="fg-blur" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
    </defs>
    <g filter="url(#fg-blur)" opacity="0.92">${extraLeaves}${body}</g>
  `);
}

function wallLayer(side) {
  const rand = mulberry32(side === "left" ? 3 : 9);
  const kinds = ["poppy", "daisy", "buttercup", "lupin"];
  const x0 = side === "left" ? -40 : 680;
  const x1 = side === "left" ? 820 : 1500;
  const cells = [];
  let i = 0;
  const fills = ["#E24B4A", "#F2C63D", "#7D5BA6", "#FFF8EF", "#6EA44C", "#F4A23A", "#C73338"];
  const backing = [];
  for (let y = -48; y <= 980; y += 52) {
    for (let x = x0 - 16; x <= x1 + 16; x += 56) {
      const cx = x + (rand() - 0.5) * 14;
      const cy = y + (rand() - 0.5) * 12;
      const fill = fills[Math.floor(rand() * fills.length)];
      const rx = 44 + rand() * 16;
      const ry = 38 + rand() * 14;
      backing.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}"/>`);
    }
  }
  for (let y = -10; y <= 980; y += 88) {
    for (let x = x0; x <= x1; x += 92) {
      const type = kinds[(i + (side === "left" ? 0 : 2)) % 4];
      cells.push(placeFlower({
        type,
        x: x + (rand() - 0.5) * 28,
        y: y + (rand() - 0.5) * 22,
        scale: 1.05 + rand() * 0.4,
        rotate: (rand() - 0.5) * 22,
        i: i + (side === "left" ? 300 : 600),
        nod: false,
        stem: type === "lupin" ? 62 : 34,
      }));
      i += 1;
    }
  }
  const heroes = (side === "left"
    ? [
        ["poppy", 160, 780, 2.05, -8],
        ["daisy", 300, 280, 1.7, 6],
        ["lupin", 80, 480, 1.85, 4],
        ["buttercup", 460, 620, 1.55, -10],
        ["poppy", 640, 420, 1.35, 8],
        ["daisy", 720, 760, 1.45, -6],
      ]
    : [
        ["daisy", 1280, 760, 1.95, 8],
        ["poppy", 1120, 300, 1.7, -6],
        ["lupin", 1360, 500, 1.8, 5],
        ["buttercup", 980, 640, 1.5, 10],
        ["poppy", 820, 480, 1.35, -8],
        ["daisy", 760, 240, 1.25, 6],
      ]
  ).map((spec, index) => {
    const [type, x, y, scale, rotate] = spec;
    return placeFlower({
      type,
      x,
      y,
      scale,
      rotate,
      i: index + (side === "left" ? 900 : 980),
      nod: false,
      stem: type === "lupin" ? 70 : 40,
    });
  }).join("");
  const loose = [];
  for (let n = 0; n < 28; n += 1) {
    const x = lerp(x0, x1, rand());
    const y = rand() * 900;
    const kind = kinds[n % 4];
    loose.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((rand() - 0.5) * 70).toFixed(1)}) scale(${(0.85 + rand()).toFixed(2)})">${loosePetal(kind === "lupin" && n % 5 === 0 ? "leaf" : kind)}</g>`);
  }
  const sprigs = side === "left"
    ? `${sprig(20, 220, -12, 1.35)}${sprig(60, 560, 8, 1.5)}${sprig(240, 80, -6, 1.05)}`
    : `${sprig(1080, 240, 168, 1.3)}${sprig(1000, 620, 188, 1.45)}${sprig(900, 120, 172, 1)}`;
  return svgDoc(side, `
    <defs>
      <filter id="wall-soft-${side}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="3.2"/>
      </filter>
    </defs>
    <g filter="url(#wall-soft-${side})">${backing.join("")}</g>
    ${cells.join("")}
    ${loose.join("")}
    ${sprigs}
    ${heroes}
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
Stack back to front. Scale each plate from the center: \`scale(1 + speed * walk)\`, where \`walk\` is 0 at the trailhead and 1 after the step forward. Higher speed is nearer, so it moves outward fastest.

## Depth order

| Order | File | Speed | Below 768px | Role |
| ---: | --- | ---: | --- | --- |
${rows}

## Petal wall

| File | Role |
| --- | --- |
| \`transition/petal-wall-left.svg\` | Left half of the near-flower curtain |
| \`transition/petal-wall-right.svg\` | Right half of the near-flower curtain |

These sit in front of every chapter plate. Part them on X: left \`translateX(-open * 105%)\`, right \`translateX(open * 105%)\`. \`open\` 1 is fully parted. \`open\` 0 is the closed wall. The halves overlap through the center so the seam is flowers, not a gap.

## Sign controls

\`ch1/04-sign.svg\` paints the board and the outlined words \`HackHive 2027\` and \`Jan 29–31, 2027\`.
Real controls are HTML aligned to these viewBox rectangles:

- Join → \`/apply\` — x ${JOIN.x} y ${JOIN.y} w ${JOIN.w} h ${JOIN.h}
- Learn more — x ${LEARN.x} y ${LEARN.y} w ${LEARN.w} h ${LEARN.h}

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
  return `// Generated by scripts/generate-path-art.mjs. Do not edit by hand.
export const VIEWBOX = { width: ${VB.w}, height: ${VB.h} } as const;

export const layers = [
${layerEntries}
] as const;

export const walls = {
  left: { file: "transition/petal-wall-left.svg", src: "/path/transition/petal-wall-left.svg" },
  right: { file: "transition/petal-wall-right.svg", src: "/path/transition/petal-wall-right.svg" },
} as const;

export const signButtons = {
  join: { x: ${JOIN.x}, y: ${JOIN.y}, w: ${JOIN.w}, h: ${JOIN.h} },
  learn: { x: ${LEARN.x}, y: ${LEARN.y}, w: ${LEARN.w}, h: ${LEARN.h} },
} as const;

export const midFlowersSvg = ${JSON.stringify(midSvg.replace(/^<\?xml[^>]*>\s*/, "").replaceAll("<![CDATA[", "").replaceAll("]]>", ""))};
`;
}

const files = {
  "ch1/01-sky.svg": skyLayer(),
  "ch1/02-far-trees.svg": treesLayer(),
  "ch1/03-path.svg": pathLayer(),
  "ch1/04-sign.svg": signLayer(),
  "ch1/05-mid-flowers.svg": midLayer(),
  "ch1/06-near-flowers.svg": nearLayer(),
  "ch1/07-foreground-stems.svg": foregroundLayer(),
  "transition/petal-wall-left.svg": wallLayer("left"),
  "transition/petal-wall-right.svg": wallLayer("right"),
};

await mkdir(path.join(publicRoot, "ch1"), { recursive: true });
await mkdir(path.join(publicRoot, "transition"), { recursive: true });
await mkdir(path.join(root, "src/app/prototype/path"), { recursive: true });

for (const [rel, contents] of Object.entries(files)) {
  await writeFile(path.join(publicRoot, rel), contents);
}

await writeFile(path.join(publicRoot, "README.md"), readme());
await writeFile(
  path.join(root, "src/app/prototype/path/scene.ts"),
  sceneModule(files["ch1/05-mid-flowers.svg"]),
);

console.log("Wrote path art layers:");
for (const rel of Object.keys(files)) console.log(`  public/path/${rel}`);
