/**
 * Paints chapters 2–7 in the same soft-gradient language as the Trailhead plates.
 * No signposts, no bees, no runtime filters. Run: node scripts/generate-later-chapters.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const VB = { w: 1440, h: 900 };
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

function svgDoc(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB.w} ${VB.h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" overflow="hidden" aria-hidden="true" focusable="false">
${body}
</svg>
`;
}

const PAINT = `
<linearGradient id="petal-white" x1="0" y1="1" x2="0" y2="0">
  <stop offset="0%" stop-color="#F3F6EA"/><stop offset="100%" stop-color="#FFFFFF"/>
</linearGradient>
<radialGradient id="daisy-heart" cx="38%" cy="34%" r="68%">
  <stop offset="0%" stop-color="#FFF3C4"/><stop offset="52%" stop-color="#F0C14A"/><stop offset="100%" stop-color="#E09622"/>
</radialGradient>
<radialGradient id="poppy-petal" cx="40%" cy="35%" r="70%">
  <stop offset="0%" stop-color="#FF8B86"/><stop offset="55%" stop-color="#E45462"/><stop offset="100%" stop-color="#C43B55"/>
</radialGradient>
<radialGradient id="butter-petal" cx="40%" cy="35%" r="70%">
  <stop offset="0%" stop-color="#FFF4B0"/><stop offset="60%" stop-color="#F6C53A"/><stop offset="100%" stop-color="#E2A41E"/>
</radialGradient>
<radialGradient id="lupin-bloom" cx="40%" cy="30%" r="75%">
  <stop offset="0%" stop-color="#E4D9FF"/><stop offset="55%" stop-color="#8E78D8"/><stop offset="100%" stop-color="#6A52B8"/>
</radialGradient>
<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#8ED56A"/><stop offset="100%" stop-color="#2F8A46"/>
</linearGradient>
<linearGradient id="stem" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#7BC85A"/><stop offset="100%" stop-color="#2E7A3E"/>
</linearGradient>
<linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#F3E2BC"/><stop offset="45%" stop-color="#D2B07A"/><stop offset="100%" stop-color="#A87A48"/>
</linearGradient>
<linearGradient id="dirt-light" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#FFF4D8"/><stop offset="100%" stop-color="#E7C992"/>
</linearGradient>
`;

function daisy() {
  const petals = Array.from({ length: 10 }, (_, i) => {
    const tilt = i % 2 === 0 ? 12.4 : 11.2;
    return `<ellipse cx="0" cy="-14" rx="5.2" ry="${tilt}" fill="url(#petal-white)" transform="rotate(${(i * 360) / 10})"/>`;
  }).join("");
  return `<g>${petals}<circle r="6" fill="url(#daisy-heart)"/><circle cx="-1.6" cy="-2" r="1.8" fill="#FFF8DC" opacity="0.9"/></g>`;
}

function poppy() {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = -90 + i * 72;
    return `<ellipse cx="0" cy="-10" rx="9" ry="12" fill="url(#poppy-petal)" transform="rotate(${angle})"/>`;
  }).join("");
  return `<g>${petals}<circle r="4.6" fill="#5C2430"/><circle cx="-1" cy="-1.2" r="1.3" fill="#F6C56A" opacity="0.85"/></g>`;
}

function buttercup() {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = -90 + i * 72;
    return `<circle cx="0" cy="-9" r="7.4" fill="url(#butter-petal)" transform="rotate(${angle})"/>`;
  }).join("");
  return `<g>${petals}<circle r="3.8" fill="#E89A16"/></g>`;
}

function lupin() {
  const blooms = Array.from({ length: 8 }, (_, i) => {
    const y = -6 - i * 5.6;
    const rx = 6.6 - i * 0.38;
    return `<ellipse cx="0" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="4.6" fill="url(#lupin-bloom)" opacity="${(0.8 + (i % 3) * 0.06).toFixed(2)}"/>`;
  }).join("");
  return `<g>${blooms}</g>`;
}

function bloom(type) {
  if (type === "poppy") return poppy();
  if (type === "buttercup") return buttercup();
  if (type === "lupin") return lupin();
  return daisy();
}

const KINDS = ["daisy", "daisy", "poppy", "buttercup", "lupin", "daisy"];

function flower(type, x, y, scale, rotate = 0) {
  const stemLength = type === "lupin" ? 64 : 48;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)}) scale(${scale.toFixed(3)})">
    <path d="M0 4 C -1.2 ${stemLength * 0.45} 1.4 ${stemLength * 0.72} 0 ${stemLength}" fill="none" stroke="url(#stem)" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="-10" cy="${(stemLength * 0.48).toFixed(1)}" rx="11" ry="4.2" fill="url(#leaf)" transform="rotate(-38 -10 ${(stemLength * 0.48).toFixed(1)})"/>
    <ellipse cx="11" cy="${(stemLength * 0.62).toFixed(1)}" rx="10" ry="3.8" fill="url(#leaf)" transform="rotate(32 11 ${(stemLength * 0.62).toFixed(1)})"/>
    <use href="#bloom-${type === "poppy" || type === "buttercup" || type === "lupin" ? type : "daisy"}" y="-8"/>
  </g>`;
}

function symbols() {
  return ["daisy", "poppy", "buttercup", "lupin"]
    .map((type) => `<symbol id="bloom-${type}" overflow="visible">${bloom(type)}</symbol>`)
    .join("");
}

function bed(seed, count, avoid) {
  const rand = mulberry32(seed);
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const y = 470 + Math.pow(rand(), 0.85) * 460;
    const x = -30 + rand() * 1500;
    const t = (y - 450) / 480;
    if (avoid?.(x, y, t)) continue;
    const type = KINDS[Math.floor(rand() * KINDS.length)];
    const scale = lerp(0.28, 1.15, t) * (0.85 + rand() * 0.3);
    marks.push(flower(type, x, y, scale, (rand() - 0.5) * 18));
  }
  return marks.join("");
}

function canopyTree(x, y, scale, seed) {
  const rand = mulberry32(seed);
  const greens = ["#9ED17A", "#6EAE56", "#4E9240", "#B7DFA0", "#3C7834", "#87C46C"];
  const blobs = [];
  for (let i = 0; i < 9; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = (12 + rand() * 38) * scale;
    const rx = (26 + rand() * 34) * scale;
    const ry = rx * (0.62 + rand() * 0.2);
    blobs.push(
      `<ellipse cx="${(Math.cos(angle) * dist).toFixed(1)}" cy="${(Math.sin(angle) * dist * 0.55).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${greens[i % greens.length]}"/>`,
    );
  }
  const trunkW = 18 * scale;
  const trunkH = 28 * scale;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
    <ellipse cx="0" cy="6" rx="${30 * scale}" ry="${8 * scale}" fill="rgba(50,32,12,0.16)"/>
    <rect x="${(-trunkW / 2).toFixed(1)}" y="${(-trunkH).toFixed(1)}" width="${trunkW.toFixed(1)}" height="${trunkH.toFixed(1)}" rx="${(trunkW / 2).toFixed(1)}" fill="#8C5A34"/>
    <g transform="translate(0 ${(-trunkH - 8 * scale).toFixed(1)})">${blobs.join("")}</g>
  </g>`;
}

function ribbon(points, scale = 1) {
  const left = [];
  const right = [];
  points.forEach((point, index) => {
    const t = index / (points.length - 1);
    const half = lerp(10, 210, Math.pow(t, 1.15)) * scale;
    const dx = point.nx * half;
    const dy = point.ny * half;
    left.push([point.x - dx, point.y - dy]);
    right.push([point.x + dx, point.y + dy]);
  });
  const line = [...left, ...right.reverse()];
  return `M${line.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
}

function straightPath(scale = 1, y1 = 980) {
  const points = [];
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    points.push({ x: 720, y: lerp(455, y1, t), nx: 1, ny: 0 });
  }
  return ribbon(points, scale);
}

function curvePath(bend, scale = 1) {
  const points = [];
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    const y = lerp(455, 980, t);
    const x = 720 + Math.sin(t * Math.PI) * bend;
    const nextY = lerp(455, 980, Math.min(1, t + 0.04));
    const nextX = 720 + Math.sin(Math.min(1, t + 0.04) * Math.PI) * bend;
    const len = Math.hypot(nextX - x, nextY - y) || 1;
    points.push({ x, y, nx: (nextY - y) / len, ny: -(nextX - x) / len });
  }
  return ribbon(points, scale);
}

function forkPaths() {
  const ends = [300, 720, 1140];
  return ends
    .map((end) => {
      const points = [];
      for (let i = 0; i <= 18; i += 1) {
        const t = i / 18;
        const y = lerp(470, 1020, t);
        const x = lerp(720, end, Math.pow(t, 0.92));
        const nextT = Math.min(1, t + 0.04);
        const nextY = lerp(470, 1020, nextT);
        const nextX = lerp(720, end, Math.pow(nextT, 0.92));
        const len = Math.hypot(nextX - x, nextY - y) || 1;
        points.push({ x, y, nx: (nextY - y) / len, ny: -(nextX - x) / len });
      }
      return `<path d="${ribbon(points, 0.42)}" fill="url(#dirt)"/>
        <path d="${ribbon(points, 0.2)}" fill="url(#dirt-light)" opacity="0.8"/>`;
    })
    .join("");
}

function sky({ stops, ground, sun }) {
  const skyStops = stops
    .map((stop) => `<stop offset="${stop.at}" stop-color="${stop.color}"/>`)
    .join("");
  return svgDoc(`<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${skyStops}</linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ground[0]}"/>
      <stop offset="55%" stop-color="${ground[1]}"/>
      <stop offset="100%" stop-color="${ground[2]}"/>
    </linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${sun.core}"/>
      <stop offset="45%" stop-color="${sun.mid}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${sun.mid}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1440" height="900" fill="url(#sky)"/>
  <ellipse cx="${sun.x}" cy="${sun.y}" rx="${sun.r * 2.4}" ry="${sun.r * 1.5}" fill="url(#sun)"/>
  <path d="M0 500 C 240 460, 520 530, 760 488 C 1040 440, 1240 510, 1440 468 L1440 900 L0 900 Z" fill="url(#ground)"/>`);
}

function hills(fill, y) {
  return svgDoc(`<defs>
    <linearGradient id="ridge" x1="0" y1="${y - 70}" x2="0" y2="${y + 200}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${fill}"/>
      <stop offset="100%" stop-color="${fill}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="M-20 ${y} C 180 ${y - 46}, 360 ${y + 8}, 560 ${y - 28} C 780 ${y - 64}, 980 ${y - 8}, 1180 ${y - 40} C 1300 ${y - 56}, 1380 ${y - 18}, 1460 ${y - 6} L1460 ${y + 210} L-20 ${y + 210} Z" fill="url(#ridge)"/>`);
}

function hiveBody(x, y, scale, entrance) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="18" rx="70" ry="16" fill="rgba(40,18,8,0.2)"/>
    <path d="M-62 -10 C-78 70 -40 150 0 162 C40 150 78 70 62 -10 C40 -70 20 -92 0 -96 C-20 -92 -40 -70 -62 -10 Z" fill="#F2C56A"/>
    <path d="M-48 -4 C-58 62 -30 128 0 138 C30 128 58 62 48 -4 C32 -48 16 -64 0 -68 C-16 -64 -32 -48 -48 -4 Z" fill="#E2A84A"/>
    <path d="M-36 20 H36 M-40 48 H40 M-36 76 H36 M-28 104 H28" stroke="#C47E2E" stroke-width="3" fill="none" opacity="0.7" stroke-linecap="round"/>
    <path d="M-16 78 Q0 108 16 78 L12 132 Q0 146 -12 132 Z" fill="${entrance}"/>
    <ellipse cx="-18" cy="8" rx="10" ry="6" fill="#FFF1C8" opacity="0.45"/>
  </g>`;
}

function stones(seed) {
  const rand = mulberry32(seed);
  const marks = [];
  for (let i = 0; i < 9; i += 1) {
    const t = 0.08 + i * 0.1;
    const y = lerp(500, 980, t);
    const x = 720 + (rand() - 0.5) * 36;
    const rx = lerp(16, 54, t);
    const ry = rx * 0.42;
    marks.push(
      `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(rx * 1.15).toFixed(1)}" ry="${(ry * 1.15).toFixed(1)}" fill="rgba(40,30,12,0.18)"/>
       <ellipse cx="${x.toFixed(1)}" cy="${(y - 4).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#F4E2C0"/>
       <ellipse cx="${(x - rx * 0.2).toFixed(1)}" cy="${(y - ry * 0.35).toFixed(1)}" rx="${(rx * 0.45).toFixed(1)}" ry="${(ry * 0.35).toFixed(1)}" fill="#FFF6E2" opacity="0.7"/>`,
    );
  }
  return marks.join("");
}

function fenceRow(side) {
  const posts = [];
  const tops = [];
  const mids = [];
  for (let i = 0; i < 8; i += 1) {
    const t = i / 7;
    const y = lerp(520, 940, Math.pow(t, 1.05));
    const x = side < 0 ? lerp(660, 30, t) : lerp(780, 1410, t);
    const h = lerp(36, 170, t);
    const w = lerp(7, 18, t);
    tops.push([x, y - h]);
    mids.push([x, y - h * 0.42]);
    posts.push(
      `<rect x="${(x - w / 2).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(w / 2).toFixed(1)}" fill="#C48A52"/>
       <rect x="${(x - w / 2).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(6, h * 0.12).toFixed(1)}" rx="2" fill="#E7C08A"/>`,
    );
  }
  const rail = (points) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
  return `<path d="${rail(tops)}" fill="none" stroke="#A86C3C" stroke-width="7" stroke-linecap="round"/>
    <path d="${rail(mids)}" fill="none" stroke="#C48A52" stroke-width="5" stroke-linecap="round"/>
    ${posts.join("")}`;
}

function oakTree() {
  const crown = [
    [-150, 20, 92, 58, "#6EAE56"],
    [-70, -30, 110, 70, "#8FCB70"],
    [20, -55, 120, 74, "#5E9A46"],
    [110, -10, 100, 64, "#7EBF62"],
    [170, 24, 72, 48, "#4E8A3C"],
    [-20, 18, 130, 72, "#3F7A34"],
    [60, 30, 90, 50, "#A3D486"],
    [-100, 36, 70, 40, "#2F6A32"],
  ];
  const blobs = crown
    .map(([x, y, rx, ry, fill]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`)
    .join("");
  return `<g transform="translate(860 470)">
    <ellipse cx="20" cy="170" rx="150" ry="24" fill="rgba(40,24,8,0.16)"/>
    <path d="M-16 70 C-30 130 -6 190 2 210 L42 210 C34 176 48 126 32 64 Z" fill="#7A4E2C"/>
    <g>${blobs}</g>
  </g>`;
}

function fireflies(seed, count, tint) {
  const rand = mulberry32(seed);
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const x = 80 + rand() * 1280;
    const y = 80 + rand() * 760;
    const r = 3 + rand() * 5;
    marks.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 3.2).toFixed(1)}" fill="${tint}" opacity="${(0.12 + rand() * 0.16).toFixed(2)}"/>
       <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#FFF8DC"/>`,
    );
  }
  return marks.join("");
}

function plate(extraDefs, body) {
  return svgDoc(`<defs>${PAINT}${symbols()}${extraDefs}</defs>${body}`);
}

const chapters = {
  "ch2/01-sky.svg": sky({
    stops: [
      { at: "0%", color: "#7EBEF0" },
      { at: "36%", color: "#C5E6FA" },
      { at: "62%", color: "#FFF4D4" },
      { at: "100%", color: "#E7F3C4" },
    ],
    ground: ["#D7EEB4", "#7EBE60", "#3C8A48"],
    sun: { x: 980, y: 230, r: 70, core: "#FFF7D8", mid: "#FFE7A4" },
  }),
  "ch2/02-far.svg": hills("#C6E4A4", 470),
  "ch2/03-path.svg": plate("", `<path d="${straightPath(1.05)}" fill="url(#dirt)"/><path d="${straightPath(0.42)}" fill="url(#dirt-light)" opacity="0.78"/>`),
  "ch2/04-near.svg": plate(
    "",
    `${[180, 1260, 80, 1360].map((x, i) => canopyTree(x, 560 + (i % 2) * 30, 1.15, 20 + i)).join("")}
     ${bed(21, 70, (x, y) => Math.abs(x - 720) < lerp(30, 230, (y - 450) / 500))}`,
  ),
  "ch3/01-sky.svg": sky({
    stops: [
      { at: "0%", color: "#F2C98A" },
      { at: "34%", color: "#F8E2B0" },
      { at: "64%", color: "#FFF6D8" },
      { at: "100%", color: "#E4E8B0" },
    ],
    ground: ["#E4F0B4", "#8EBE58", "#4A9444"],
    sun: { x: 1040, y: 250, r: 78, core: "#FFF3C0", mid: "#FFD48A" },
  }),
  "ch3/02-far.svg": hills("#D5E8A8", 490),
  "ch3/03-path.svg": plate("", forkPaths()),
  "ch3/04-near.svg": plate(
    "",
    bed(33, 78, (x, y) => {
      const t = Math.max(0, (y - 470) / 520);
      const arms = [300, 720, 1140].map((end) => lerp(720, end, Math.pow(t, 0.92)));
      return arms.some((arm) => Math.abs(x - arm) < lerp(24, 90, t));
    }),
  ),
  "ch4/01-sky.svg": sky({
    stops: [
      { at: "0%", color: "#F0B56E" },
      { at: "40%", color: "#F8D7A0" },
      { at: "70%", color: "#FFE9C4" },
      { at: "100%", color: "#E7D39A" },
    ],
    ground: ["#E2E8A8", "#86B454", "#3E843C"],
    sun: { x: 1120, y: 280, r: 90, core: "#FFE0A0", mid: "#FFBE6A" },
  }),
  "ch4/02-far.svg": svgDoc(`${oakTree()}${hiveBody(980, 390, 0.62, "#3A2416")}`),
  "ch4/03-path.svg": plate("", `<path d="${curvePath(-70, 1)}" fill="url(#dirt)"/><path d="${curvePath(-70, 0.4)}" fill="url(#dirt-light)" opacity="0.75"/>`),
  "ch4/04-near.svg": plate(
    "",
    bed(41, 64, (x, y) => {
      const t = (y - 450) / 520;
      const cx = 720 + Math.sin(Math.max(0, t) * Math.PI) * -70;
      return Math.abs(x - cx) < lerp(28, 200, Math.max(0, t));
    }),
  ),
  "ch5/01-sky.svg": sky({
    stops: [
      { at: "0%", color: "#F09A62" },
      { at: "38%", color: "#F6C49A" },
      { at: "68%", color: "#FFE0C4" },
      { at: "100%", color: "#E8C8A0" },
    ],
    ground: ["#DCE6A4", "#7AAA50", "#3A7838"],
    sun: { x: 1180, y: 320, r: 100, core: "#FFD0A0", mid: "#FF9A5A" },
  }),
  "ch5/02-far.svg": hills("#C9D898", 500),
  "ch5/03-path.svg": plate(
    `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D5F0DC"/><stop offset="40%" stop-color="#8FCBB8"/><stop offset="100%" stop-color="#3E8E96"/>
    </linearGradient>
    <linearGradient id="water-light" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F4FFF6"/><stop offset="100%" stop-color="#B7E4D4"/>
    </linearGradient>`,
    `<path d="${curvePath(36, 1.15)}" fill="url(#water)"/>
     <path d="${curvePath(36, 0.46)}" fill="url(#water-light)" opacity="0.72"/>
     ${stones(55)}`,
  ),
  "ch5/04-near.svg": plate(
    "",
    bed(52, 60, (x, y) => {
      const t = (y - 450) / 520;
      const cx = 720 + Math.sin(Math.max(0, t) * Math.PI) * 36;
      return Math.abs(x - cx) < lerp(40, 240, Math.max(0, t));
    }),
  ),
  "ch6/01-sky.svg": sky({
    stops: [
      { at: "0%", color: "#E36A42" },
      { at: "36%", color: "#F09A62" },
      { at: "66%", color: "#F8C8A4" },
      { at: "100%", color: "#E4C49A" },
    ],
    ground: ["#D8E09C", "#74A44C", "#346E34"],
    sun: { x: 1220, y: 360, r: 110, core: "#FFC48A", mid: "#F07840" },
  }),
  "ch6/02-far.svg": svgDoc(`${fenceRow(-1)}${fenceRow(1)}`),
  "ch6/03-path.svg": plate("", `<path d="${straightPath(0.95)}" fill="url(#dirt)"/><path d="${straightPath(0.38)}" fill="url(#dirt-light)" opacity="0.75"/>`),
  "ch6/04-near.svg": plate(
    "",
    bed(61, 72, (x, y) => Math.abs(x - 720) < lerp(26, 190, (y - 450) / 500)),
  ),
  "ch7/01-sky.svg": sky({
    stops: [
      { at: "0%", color: "#8E3A62" },
      { at: "28%", color: "#E15A3A" },
      { at: "58%", color: "#F6A15A" },
      { at: "100%", color: "#E7C08A" },
    ],
    ground: ["#D2C888", "#6E9844", "#2E6230"],
    sun: { x: 1080, y: 430, r: 130, core: "#FFE0B0", mid: "#FF7A3A" },
  }),
  "ch7/02-far.svg": svgDoc(fireflies(71, 10, "#FFE7A0")),
  "ch7/03-path.svg": plate("", `<path d="${straightPath(0.95)}" fill="url(#dirt)"/><path d="${straightPath(0.36)}" fill="url(#dirt-light)" opacity="0.7"/>`),
  "ch7/04-near.svg": plate(
    "",
    `${hiveBody(720, 390, 1.35, "#24140E")}${bed(73, 48, (x, y) => Math.abs(x - 720) < lerp(36, 200, (y - 450) / 500) || (y < 640 && Math.abs(x - 720) < 150))}${fireflies(77, 8, "#FFF4C8")}`,
  ),
};

await mkdir(publicRoot, { recursive: true });
for (const folder of ["ch2", "ch3", "ch4", "ch5", "ch6", "ch7"]) {
  await mkdir(path.join(publicRoot, folder), { recursive: true });
}
await Promise.all(
  Object.entries(chapters).map(([file, svg]) => writeFile(path.join(publicRoot, file), svg)),
);
console.log(`wrote ${Object.keys(chapters).length} plates`);
