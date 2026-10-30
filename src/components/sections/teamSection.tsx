"use client";

import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent,
  type Ref,
  type SVGProps,
} from "react";
import { teamData, type TeamMember } from "@/app/data/teamData";
import "./teamSection.css";

type TeamMemberProps = {
  image: string;
  name: string;
  role: string;
  link?: string;
  position?: string;
  zoom?: number;
};

// One hexagon of the hive. The role (which names the team) is revealed on hover or tap.
// For members with a LinkedIn link, clicking the hex opens their profile in a new tab.
function TeamMemberCard(props: TeamMemberProps) {
  // Touch screens can't hover, so the first tap only pops the hex out to show who it
  // is; tapping it again opens LinkedIn.
  const revealed = useRef(false);
  const openOnSecondTap = (event: MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(hover: none)").matches && !revealed.current) {
      event.preventDefault();
      revealed.current = true;
      return;
    }
    // LinkedIn opens in a new tab; drop focus so the hex isn't still popped out and
    // its team still lit when the visitor comes back.
    event.currentTarget.blur();
  };

  const content = (
    <span className="hex-inner">
      <img
        src={props.image}
        alt={`Photo of ${props.name}`}
        // Zooming from the same point the crop aims at keeps the face in place.
        style={{ objectPosition: props.position, transformOrigin: props.position, scale: props.zoom }}
      />
      <span className="hex-label">
        <span className="hex-name">{props.name}</span>
        <span className="hex-role">{props.role}</span>
      </span>
    </span>
  );

  if (!props.link) {
    return (
      <div className="hex-cell" tabIndex={0}>
        {content}
      </div>
    );
  }

  return (
    <a
      className="hex-cell"
      href={props.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${props.name}, ${props.role}: LinkedIn profile (opens in a new tab)`}
      onClick={openOnSecondTap}
      onBlur={() => (revealed.current = false)}
    >
      {content}
    </a>
  );
}

// Which bee carries each team out of the hive: queens bring out the presidents,
// drones the vice-presidents, and workers everyone else.
type Caste = "queen" | "drone" | "worker";

// "row" groups are a line of hexes, like a pair of presidents.
// "department" groups put the director alone on top with their team in neat rows beneath.
// "cluster" groups put the director on top with their team in a looser, hand-placed shape.
//
// Every team sits in one shared hive. `wide` and `narrow` are where each team's first
// hex goes (x in hex widths, y in rows) on big and small screens; the rest of the team
// follows its shape from there. The spots are hand-picked so the teams lock together
// without overlapping, and `perRow` lets a long row wrap where the hive is narrow.
// They're spaced for the current team sizes: adding someone to a team can make two
// hexes land on the same spot (one hides the other), so re-check the spots when a
// team grows.
type Spot = { x: number; y: number; perRow?: number };

type TeamGroup = {
  id: string;
  name: string;
  kind: "row" | "department" | "cluster";
  caste: Caste;
  members: TeamMember[];
  // Overrides the shape the team's kind would give it, member by member in order.
  shape?: [number, number][];
  wide: Spot;
  narrow: Spot;
};

// The tech team's fifth member (Tomi) sits beside Xavier, under Haseeb, rather than
// out to the right like the cluster's fifth spot.
const TECH_SHAPE: [number, number][] = [
  [0, 0],
  [0.5, 1],
  [-0.5, 1],
  [1, 2],
  [0, 2],
];

// Listed top of the hierarchy first, which is also the order the bees bring them out in.
const groups: TeamGroup[] = [
  { id: "presidents", name: "Presidents", kind: "row", caste: "queen", members: teamData.presidents, wide: { x: 4, y: 0 }, narrow: { x: 0.5, y: 0 } },
  { id: "vice-presidents", name: "Vice Presidents", kind: "row", caste: "drone", members: teamData.vicePresidents, wide: { x: 6, y: 0 }, narrow: { x: 2.5, y: 0 } },
  { id: "tech", name: "Tech Team", kind: "cluster", caste: "worker", members: teamData.tech, shape: TECH_SHAPE, wide: { x: 0.5, y: 1 }, narrow: { x: 1, y: 1 } },
  { id: "operations", name: "Operations Team", kind: "department", caste: "worker", members: teamData.operations, wide: { x: 2.5, y: 1 }, narrow: { x: 3, y: 1 } },
  { id: "marketing", name: "Marketing Team", kind: "cluster", caste: "worker", members: teamData.marketing, wide: { x: 4.5, y: 1 }, narrow: { x: 3, y: 3 } },
  { id: "sponsors", name: "Sponsors Team", kind: "department", caste: "worker", members: teamData.sponsors, wide: { x: 7.5, y: 1 }, narrow: { x: 1.5, y: 4 } },
  { id: "events", name: "Events Team", kind: "cluster", caste: "worker", members: teamData.events, wide: { x: 9.5, y: 1 }, narrow: { x: 2.5, y: 6 } },
  { id: "advisors", name: "Advisors", kind: "row", caste: "worker", members: teamData.advisors, wide: { x: 3, y: 4 }, narrow: { x: 0.5, y: 8, perRow: 3 } },
];

// The sketch's five-hex shape with the director as its top hex: a row of three
// below, offset to the right, and one more hanging off the bottom right. Members
// take these spots in order, so four members make a zig-zag and five the full shape.
// The last two spots only come into play if a team grows past five.
const CLUSTER_SHAPE: [number, number][] = [
  [0, 0],
  [0.5, 1],
  [-0.5, 1],
  [1, 2],
  [1.5, 1],
  [0, 2],
  [2, 2],
];

function clusterPositions(count: number): [number, number][] {
  return count <= CLUSTER_SHAPE.length
    ? CLUSTER_SHAPE.slice(0, count)
    : departmentPositions(count);
}

// The widest a row under a director gets.
const MAX_ROW = 4;

// Cell positions in a pointy-top hex grid: x in hex widths, y in rows. Neighbouring
// rows are offset by half a hex, so a row centred under the director needs an even
// count on odd rows (x = ±0.5, ±1.5) and an odd count on even rows (x = 0, ±1).
// Each row takes the most members it can at that parity; a lone leftover that
// can't be centred sits half a hex to the right.
function departmentPositions(count: number): [number, number][] {
  const positions: [number, number][] = [[0, 0]];
  let remaining = count - 1;

  for (let y = 1; remaining > 0; y++) {
    const wantEven = y % 2 === 1;
    let take = Math.min(remaining, MAX_ROW);
    if ((take % 2 === 0) !== wantEven) take -= 1;
    const shift = take === 0 ? 0.5 : 0;
    if (take === 0) take = 1;

    for (let i = 0; i < take; i++) {
      positions.push([i - (take - 1) / 2 + shift, y]);
    }
    remaining -= take;
  }
  return positions;
}

// A straight line that wraps every `perRow` hexes, each new row tucked half a hex in.
function rowPositions(count: number, perRow = count): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const y = Math.floor(i / perRow);
    return [(i % perRow) + (y % 2) / 2, y];
  });
}

function groupPositions(group: TeamGroup, spot: Spot): [number, number][] {
  const count = group.members.length;
  const shape =
    group.shape?.slice(0, count) ??
    (group.kind === "row"
      ? rowPositions(count, spot.perRow)
      : group.kind === "cluster"
        ? clusterPositions(count)
        : departmentPositions(count));
  return shape.map(([x, y]) => [x + spot.x, y + spot.y]);
}

type HiveCell = {
  member: TeamMember;
  team: string;
  caste: Caste;
  wide: [number, number];
  narrow: [number, number];
  // When this member's bee sets off, as a share of the scroll (0 to 1 - FLIGHT_SHARE).
  start: number;
};

// How much of the scroll each bee's trip takes, and how much longer the gap is
// between ranks than between two bees of the same rank.
const FLIGHT_SHARE = 0.22;
const RANK_GAP = { queen: 0, drone: 4, worker: 8 };

// Places every member in the hive for both screen sizes, shifted so the hive starts at 0, 0.
function buildHive() {
  const placed = groups.flatMap((group) => {
    const wide = groupPositions(group, group.wide);
    const narrow = groupPositions(group, group.narrow);
    return group.members.map((member, i) => ({
      member,
      team: group.id,
      caste: group.caste,
      wide: wide[i],
      narrow: narrow[i],
    }));
  });
  // Bees set off one after another, top of the hierarchy first.
  const slots = placed.map((cell, order) => order + RANK_GAP[cell.caste]);
  const last = Math.max(...slots);
  const cells: HiveCell[] = placed.map((cell, i) => ({ ...cell, start: (slots[i] / last) * (1 - FLIGHT_SHARE) }));

  const bounds = (pick: (cell: HiveCell) => [number, number]) => {
    const xs = cells.map((cell) => pick(cell)[0]);
    const ys = cells.map((cell) => pick(cell)[1]);
    const minX = Math.min(...xs);
    return { minX, cols: Math.max(...xs) - minX + 1, rows: Math.max(...ys) };
  };

  return { cells, wide: bounds((cell) => cell.wide), narrow: bounds((cell) => cell.narrow) };
}

const hive = buildHive();

function MemberHex({ member }: { member: TeamMember }) {
  return (
    <TeamMemberCard
      image={member.Image}
      name={member.name}
      role={member.role}
      link={member.link || undefined}
      position={member.position}
      zoom={member.zoom}
    />
  );
}

// A small seeded random number generator, so the server and browser draw the same
// leaves and grass.
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const round = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// The bees' colours, shared by every bee on the page. They live in their own
// always-rendered SVG because a gradient inside a hidden SVG stops working.
const BeeDefs = memo(function BeeDefs() {
  return (
    <svg className="bee-defs" aria-hidden>
      <defs>
        <linearGradient id="bee-abdomen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0c25a" />
          <stop offset="0.55" stopColor="#c98d24" />
          <stop offset="1" stopColor="#6e4610" />
        </linearGradient>
        <linearGradient id="bee-abdomen-queen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9a945" />
          <stop offset="0.55" stopColor="#b56f1c" />
          <stop offset="1" stopColor="#5a330c" />
        </linearGradient>
        <radialGradient id="bee-thorax" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#d9a854" />
          <stop offset="0.6" stopColor="#8f6326" />
          <stop offset="1" stopColor="#4a3112" />
        </radialGradient>
        <linearGradient id="bee-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#dfe9f2" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
});

// Each caste's body: the abdomen's outline, where its bands go, and how big the
// thorax and eye are. Queens are long and slender, drones stout with big eyes.
const BODIES: Record<Caste, { abdomen: string; bands: number[]; thorax: number; eye: [number, number] }> = {
  worker: {
    abdomen: "M8 26C9 19.5 20 17.5 30 19C35 21 35 31 30 33C20 34.5 9 32.5 8 26Z",
    bands: [14, 19, 24],
    thorax: 7,
    eye: [2.4, 3.6],
  },
  queen: {
    abdomen: "M1 26C3 20.5 17 18.5 30 19.5C35 21 35 31 30 32.5C17 33.5 3 31.5 1 26Z",
    bands: [8, 13, 18, 23],
    thorax: 7.3,
    eye: [2.3, 3.4],
  },
  drone: {
    abdomen: "M9 26C9 17.5 21 16 30 18C36 20.5 36 31.5 30 34C21 36 9 34.5 9 26Z",
    bands: [15, 20, 25],
    thorax: 8.2,
    eye: [3.8, 5],
  },
};

// Drawn facing right, with its legs hanging down to the bottom edge so it can grip
// the hex it's carrying.
function Bee({ caste, className = "", ...rest }: { caste: Caste } & SVGProps<SVGSVGElement>) {
  const body = BODIES[caste];

  return (
    <svg className={`bee ${className}`} viewBox="0 0 64 44" aria-hidden {...rest}>
      <path className="bee-legs" d="M34 30L31 37L30 44M38 31L38.5 38L39 44M41 30L44 37L46 43" />
      <path className="bee-dark" d={`M${caste === "queen" ? 1.5 : 8.5} 25.4L${caste === "queen" ? -2 : 5} 26L${caste === "queen" ? 1.5 : 8.5} 26.6Z`} />
      <path d={body.abdomen} fill={caste === "queen" ? "url(#bee-abdomen-queen)" : "url(#bee-abdomen)"} />
      {body.bands.map((x) => (
        <path key={x} className="bee-band" d={`M${x} ${caste === "drone" ? 18 : 19.5}Q${x + 3.2} 26 ${x} ${caste === "drone" ? 34 : 32.5}`} />
      ))}
      <circle cx="37" cy="24" r={body.thorax} fill="url(#bee-thorax)" />
      <path className="bee-fuzz" d="M32 19l-1-1.6M35 17.3l-.4-1.8M38.5 17l.3-1.8M42 18.5l1-1.4M31 24l-1.8-.2M43.5 23l1.8-.4" />
      <ellipse className="bee-dark" cx="47" cy="25" rx="4.8" ry="5.8" />
      <ellipse className="bee-eye" cx="48" cy="23.4" rx={body.eye[0]} ry={body.eye[1]} />
      <ellipse cx="47.4" cy="22" rx="0.7" ry="1.2" fill="#ffffff" fillOpacity="0.45" />
      <path className="bee-antenna" d="M48.5 19L51 13.5L56.5 11.5M46.5 19L47.5 13L52 9.5" />
      <g className="bee-wings">
        <path className="bee-wing" d="M37 18C31 9 18 5.5 13 8C10 10 16 15 37 19Z" />
        <path className="bee-wing" d="M37 18.5C33 13.5 25 11.5 21.5 13C19.5 14.5 24 17.5 37 19.5Z" />
        <path className="bee-vein" d="M37 18.5C29 12 21 9 15 9M30 15.5C27 12 25 10.5 22 9.5" />
      </g>
    </svg>
  );
}

type Clump = { cx: number; cy: number; rx: number; ry: number; count: number; size: [number, number] };

// A mass of leaves: overlapping, turned ellipses in a few shades, lighter toward
// the top where the sun catches them.
function Foliage({ clumps, colors, seed }: { clumps: Clump[]; colors: string[]; seed: number }) {
  const rand = seeded(seed);
  return (
    <>
      {clumps.flatMap((clump, c) =>
        Array.from({ length: clump.count }, (_, i) => {
          const angle = rand() * Math.PI * 2;
          const dist = Math.sqrt(rand()) * 1.12;
          const x = clump.cx + Math.cos(angle) * dist * clump.rx;
          const y = clump.cy + Math.sin(angle) * dist * clump.ry;
          const size = clump.size[0] + rand() * (clump.size[1] - clump.size[0]);
          // Higher leaves pick from the lighter end of the palette.
          const height = (y - (clump.cy - clump.ry)) / (2 * clump.ry);
          const shade = Math.min(colors.length - 1, Math.max(0, Math.floor((height + rand() * 0.6 - 0.3) * colors.length)));
          return (
            <ellipse
              key={`${c}-${i}`}
              cx={round(x)}
              cy={round(y)}
              rx={round(size)}
              ry={round(size * 0.6)}
              transform={`rotate(${Math.round(rand() * 180)} ${round(x)} ${round(y)})`}
              fill={colors[colors.length - 1 - shade]}
            />
          );
        }),
      )}
    </>
  );
}

// A tapered trunk with a flared base, leaning `lean` to the side at the top.
function trunk(x: number, base: number, top: number, lean = 0, bottom = 720) {
  const mid = bottom / 2;
  return [
    `M${x - base / 2 - base * 0.35} ${bottom}`,
    `Q${x - base / 2} ${bottom - 20} ${x - base / 2} ${bottom - 60}`,
    `C${x - base / 2 + lean * 0.3} ${mid} ${x - top / 2 + lean * 0.8} 80 ${x - top / 2 + lean} -10`,
    `L${x + top / 2 + lean} -10`,
    `C${x + top / 2 + lean * 0.8} 80 ${x + base / 2 + lean * 0.3} ${mid} ${x + base / 2} ${bottom - 60}`,
    `Q${x + base / 2} ${bottom - 20} ${x + base / 2 + base * 0.35} ${bottom}Z`,
  ].join("");
}

// Tufts of grass: each a fan of tapered blades from one root, bending and leaning
// a little at random. The tufts are split into a few groups that sway in the wind
// slightly out of step (see .sway in teamSection.css). `fills` are the blades'
// gradients, dark at the root and lighter at the tip.
function grassTufts(seed: number, count: number, top: number, bottom: number, height: [number, number], fills: string[]) {
  const rand = seeded(seed);
  const groups: { d: string; fill: string }[][] = [[], [], [], []];

  for (let i = 0; i < count; i++) {
    const x = rand() * 1640 - 20;
    const y = top + rand() * (bottom - top);
    const blades = 5 + Math.floor(rand() * 5);
    const group = Math.max(0, Math.min(3, Math.floor((x / 1600) * 4 + rand() * 0.6)));
    for (let b = 0; b < blades; b++) {
      const h = (height[0] + rand() * (height[1] - height[0])) * (0.7 + rand() * 0.3);
      const w = h * (0.035 + rand() * 0.03);
      // Blades fan out from the root and droop toward the tip.
      const lean = (b - (blades - 1) / 2) * h * 0.18 + (rand() - 0.5) * h * 0.2;
      const tipX = x + lean;
      const tipY = y - h * (0.85 + rand() * 0.15);
      const midX = x + lean * 0.35;
      const midY = y - h * 0.55;
      groups[group].push({
        d:
          `M${round(x - w / 2)} ${round(y)}Q${round(midX - w * 0.3)} ${round(midY)} ${round(tipX)} ${round(tipY)}` +
          `Q${round(midX + w * 0.3)} ${round(midY)} ${round(x + w / 2)} ${round(y)}Z`,
        fill: fills[Math.floor(rand() * fills.length)],
      });
    }
  }

  return groups.map((blades, g) => (
    <g key={g} className="sway" style={{ animationDelay: `${-g * 1.3}s`, animationDuration: `${4 + g * 0.7}s` }}>
      {blades.map(({ d, fill }, i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </g>
  ));
}

// A continuous run of tall grass right across the meadow: a blade every few units
// along the ground at `y`, each a different height and lean, so it reads as one
// long, unbroken stretch rather than separate tufts. Split into groups that sway
// in the wind slightly out of step, like grassTufts.
// `from` and `to` limit the run to part of the meadow.
function grassRun(seed: number, y: number, spacing: number, height: [number, number], fills: string[], from = -30, to = 1630) {
  const rand = seeded(seed);
  const groups: { d: string; fill: string }[][] = [[], [], [], []];

  for (let x = from; x < to; x += spacing * (0.5 + rand())) {
    const root = y + (rand() - 0.5) * 14;
    // Heights rise and fall in gentle waves along the run, plus some randomness.
    const wave = 0.75 + 0.25 * Math.sin(x / 90 + seed);
    const h = (height[0] + rand() * (height[1] - height[0])) * wave;
    const w = h * (0.03 + rand() * 0.025);
    const lean = (rand() - 0.4) * h * 0.45;
    const tipX = x + lean;
    const tipY = root - h * (0.88 + rand() * 0.12);
    const midX = x + lean * 0.3;
    const midY = root - h * 0.55;
    const group = Math.max(0, Math.min(3, Math.floor((x / 1600) * 4)));
    groups[group].push({
      d:
        `M${round(x - w / 2)} ${round(root)}Q${round(midX - w * 0.3)} ${round(midY)} ${round(tipX)} ${round(tipY)}` +
        `Q${round(midX + w * 0.3)} ${round(midY)} ${round(x + w / 2)} ${round(root)}Z`,
      fill: fills[Math.floor(rand() * fills.length)],
    });
  }

  return groups.map((blades, g) => (
    <g key={g} className="sway" style={{ animationDelay: `${-g * 1.3 - seed * 0.1}s`, animationDuration: `${4 + g * 0.7}s` }}>
      {blades.map(({ d, fill }, i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </g>
  ));
}

// A bush: `w` wide and about `h` tall, sitting on the ground at `base`, made of
// `count` clusters of leaves `size` across. `bloom` scatters blossoms of that
// colour over its outside.
type Bush = { cx: number; base: number; w: number; h: number; count: number; size: [number, number]; bloom?: string };

// Deep shadow green up to sunlit olive, muted like real foliage rather than bright cartoon greens.
const BUSH_SHADES = ["#141f10", "#1b2a16", "#23361c", "#2d4423", "#38532b", "#466236", "#577443", "#6c8655", "#869c6c"];
// Leaves on the outside of a bush facing into the sun, lit through from behind
// so they glow a warm yellow-green.
const BUSH_RIM = ["#8f9f5c", "#a8b56b", "#c2c97f", "#d8d896"];
// Where the sun sits, above the middle of the clearing.
const SUN = { x: 900, y: -60 };

// The bush's outline: a lumpy dome, its height at `t` (-1 at the left edge, 1 at
// the right) wobbling with bulges big and small so no two bushes share a shape.
function domeHeight(bush: Bush, t: number, wobble: number[]) {
  const dome = Math.sqrt(Math.max(0, 1 - t * t));
  const bulges = wobble.reduce((sum, w, k) => sum + w * Math.sin((t + 1) * Math.PI * (k + 2) + k), 0);
  return bush.h * dome * (0.9 + bulges);
}

// Bushes along the edge of the clearing, after a rhododendron: a tall, lumpy dome
// built from clusters of broad, glossy leaves fanning out from a point. Clusters
// deep in the bush are drawn first and stay dark; those on the outside, especially
// on top, catch the light, so the gaps between clusters read as shadow. Sprigs
// poke out past the dome so the outline is ragged, the leaves facing the sun are
// backlit, and each bush casts a soft shadow on the ground and rocks gently in the wind.
function Bushes({ bushes, seed }: { bushes: Bush[]; seed: number }) {
  const rand = seeded(seed);

  return (
    <>
      {bushes.map((bush, b) => {
        const wobble = [0.06 + rand() * 0.05, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.05, (rand() - 0.5) * 0.04];
        const half = bush.w / 2;
        // A dark core, a little smaller than the bush, so no ground shows between
        // the leaves and the leaves spill over its edges rather than showing its outline.
        const outline = Array.from({ length: 41 }, (_, i) => {
          const t = i / 20 - 1;
          return `${round(bush.cx + t * half * 0.88)} ${round(bush.base - domeHeight(bush, t, wobble) * 0.82)}`;
        });
        const body = `M${round(bush.cx - half * 0.88)} ${bush.base}L${outline.join("L")}L${round(bush.cx + half * 0.88)} ${bush.base}Z`;

        // Clusters through the dome, crowding toward its surface; `depth` is how far
        // out toward the surface each sits, and the outermost are drawn last.
        // A few clusters are sprigs reaching past the dome, smaller than the rest.
        const clusters = Array.from({ length: bush.count }, () => {
          const t = rand() * 2 - 1;
          const top = domeHeight(bush, t, wobble);
          const sprig = rand() < 0.07;
          const depth = sprig ? 1.03 + rand() * 0.15 : rand() ** 0.45;
          const y = bush.base - top * depth;
          // Lit from above and a little from the sunny middle of the clearing; the
          // lower sides stay in soft shade rather than going black, and the bottom
          // of the bush, under all its leaves, is darkest.
          const sunSide = Math.sign(SUN.x - bush.cx) * t * 0.12;
          const low = 1 - (bush.base - y) / bush.h;
          const light = 0.2 + depth * 0.38 + (top / bush.h) * depth * 0.3 + sunSide - low * 0.18 + (rand() - 0.5) * 0.2;
          const size = (bush.size[0] + rand() * (bush.size[1] - bush.size[0])) * (sprig ? 0.7 : 1);
          return { x: bush.cx + t * half, y, depth, light, size };
        }).sort((a, b) => a.depth - b.depth);

        const leaves = clusters.flatMap((cluster, c) => {
          const count = 5 + Math.floor(rand() * 3);
          const spin = rand() * Math.PI * 2;
          const toSun = Math.atan2(SUN.y - cluster.y, SUN.x - cluster.x);
          return Array.from({ length: count }, (_, l) => {
            const angle = spin + (l / count) * Math.PI * 2 + (rand() - 0.5) * 0.5;
            const len = cluster.size * (0.7 + rand() * 0.55);
            // Leaves facing up catch more light than those hanging down.
            const facing = -Math.sin(angle) * 0.12;
            const shade = Math.round((cluster.light + facing + (rand() - 0.5) * 0.08) * (BUSH_SHADES.length - 1));
            // Outer leaves pointing toward the sun have it shining through them.
            const backlit = cluster.depth > 0.85 && Math.cos(angle - toSun) > 0.55 && rand() < 0.6;
            const fill = backlit
              ? BUSH_RIM[Math.min(BUSH_RIM.length - 1, Math.floor(rand() * BUSH_RIM.length * cluster.depth))]
              : BUSH_SHADES[Math.max(0, Math.min(BUSH_SHADES.length - 1, shade))];
            // Broad leaves that droop a little toward their tips.
            const droop = Math.cos(angle) * 6;
            return (
              <path
                key={`${c}-${l}`}
                d={`M0 0Q${round(len * 0.45)} ${round(-len * 0.3)} ${round(len)} ${round(droop * 0.2)}Q${round(len * 0.5)} ${round(len * 0.28)} 0 0Z`}
                transform={`translate(${round(cluster.x)} ${round(cluster.y)}) rotate(${Math.round((angle * 180) / Math.PI)})`}
                fill={fill}
              />
            );
          });
        });

        // Blossoms over the outside of a flowering bush, among the outer leaves.
        const blossoms = bush.bloom
          ? clusters
              .filter((cluster) => cluster.depth > 0.75 && rand() < 0.4)
              .map((cluster, i) => {
                const s = (cluster.size / 34) * (0.8 + rand() * 0.5);
                const x = cluster.x + (rand() - 0.5) * cluster.size;
                const y = cluster.y + (rand() - 0.5) * cluster.size * 0.6;
                return (
                  <use
                    key={i}
                    href="#blossom"
                    fill={bush.bloom}
                    transform={`translate(${round(x)} ${round(y)}) rotate(${Math.round(rand() * 72)}) scale(${round2(s)})`}
                    opacity={round(0.55 + cluster.light * 0.35)}
                  />
                );
              })
          : null;

        return (
          <g key={b}>
            <ellipse cx={bush.cx} cy={bush.base + 3} rx={half * 1.15} ry={bush.h * 0.12} fill="#14240d" opacity="0.55" filter="url(#blur-mid)" />
            <g className="bush" style={{ animationDelay: `${-b * 1.7}s` }}>
              <path d={body} fill="#141f10" />
              {leaves}
              {blossoms}
            </g>
          </g>
        );
      })}
    </>
  );
}

// A blossom for the flowering bushes, drawn once in ForestBackdrop's <defs> about
// 12 units across, centred on 0, 0, and placed with <use>. Its petals take their
// colour from the <use>.
function BlossomDef() {
  return (
    <g id="blossom">
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse key={i} cx="2.9" cy="0" rx="3.1" ry="2.5" transform={`rotate(${i * 72})`} />
      ))}
      <circle r="1.5" fill="#f0cf6a" />
    </g>
  );
}

// Which flowers grow in the meadow and how often: the shape of the head, its
// petals' and centre's colours, and its share of the meadow.
type Wildflower = { shape: "daisy" | "five" | "poppy" | "spike"; petals: string; centre?: string; share: number };

const WILDFLOWERS: Wildflower[] = [
  { shape: "daisy", petals: "#f4f1e6", centre: "#d9a420", share: 0.34 },
  { shape: "five", petals: "#e8bd2a", centre: "#c48a16", share: 0.22 },
  { shape: "spike", petals: "#8e6fb4", share: 0.16 },
  { shape: "five", petals: "#e6a9bd", centre: "#f0cf6a", share: 0.1 },
  { shape: "five", petals: "#9fb6de", centre: "#f0cf6a", share: 0.08 },
  { shape: "poppy", petals: "#c5442b", centre: "#2a1a12", share: 0.06 },
  { shape: "five", petals: "#f3efe2", centre: "#f0cf6a", share: 0.04 },
];

// Each head shape's petals, as [count, distance from the centre to the petal's
// middle, half its length, half its width], and the centre's radius; 1 is about
// 12 units across.
const HEADS = {
  daisy: { petals: [14, 4, 3.4, 1.15], centre: 2.3 },
  five: { petals: [5, 2.9, 3.1, 2.5], centre: 1.5 },
  poppy: { petals: [4, 3, 3.8, 3.4], centre: 1.8 },
} as const;

// An ellipse as path commands, for adding to a path shared with many others.
const ellipseD = (x: number, y: number, rx: number, ry: number) =>
  `M${round(x - rx)} ${round(y)}a${round(rx)} ${round(ry)} 0 1 0 ${round(rx * 2)} 0a${round(rx)} ${round(ry)} 0 1 0 ${round(-rx * 2)} 0Z`;

// Wildflowers scattered through the meadow between `top` and `bottom`: each a
// thin stem bending up to a head, bigger the lower (nearer) it grows, the round
// heads seen a little from above so they're squashed upright. Grouped to sway
// with the grass like grassRun. `size` is the heads' scale at the top and bottom
// (1 is about 12 units across).
//
// There are hundreds of them in layers that repaint as they sway, so each group
// draws all its stems as one path and its heads as one path per colour, rather
// than an element per flower.
function wildflowers(seed: number, count: number, top: number, bottom: number, size: [number, number], from = -30, to = 1630) {
  const rand = seeded(seed);
  const groups = Array.from({ length: 4 }, () => ({ stems: "", heads: new Map<string, string>() }));
  const add = (group: (typeof groups)[number], color: string, d: string) => group.heads.set(color, (group.heads.get(color) ?? "") + d);

  for (let i = 0; i < count; i++) {
    const x = from + rand() * (to - from);
    const y = top + rand() * (bottom - top);
    const near = (y - top) / (bottom - top || 1);
    const s = (size[0] + near * (size[1] - size[0])) * (0.75 + rand() * 0.5);
    let pick = rand();
    const flower = WILDFLOWERS.find(({ share }) => (pick -= share) < 0) ?? WILDFLOWERS[0];
    const h = s * (22 + rand() * 20);
    const lean = (rand() - 0.5) * h * 0.35;
    const tipX = x + lean;
    const tipY = y - h;
    const group = groups[Math.max(0, Math.min(3, Math.floor((x / 1600) * 4)))];

    group.stems += `M${round(x)} ${round(y)}Q${round(x + lean * 0.2)} ${round(y - h * 0.55)} ${round(tipX)} ${round(tipY)}`;

    if (flower.shape === "spike") {
      // Pairs of little florets climbing the stem, shrinking toward the top and
      // leaning the way the stem does.
      for (let k = 0; k < 7; k++) {
        const up = (k * 2.1 + 0.5) * s;
        const along = lean / h;
        const r = (2 - k * 0.18) * s;
        add(group, flower.petals, ellipseD(tipX + along * up - 1.3 * s, tipY - up, r, r * 0.75));
        add(group, flower.petals, ellipseD(tipX + along * (up + 1.2 * s) + 1.3 * s, tipY - up - 1.2 * s, r, r * 0.75));
      }
      continue;
    }

    // Each petal a pointed oval running out from the centre, turned in the
    // flower's own plane and then squashed, as if seen from a little above.
    const head = HEADS[flower.shape];
    const [petals, dist, half, width] = head.petals;
    const spin = rand() * Math.PI;
    const point = (u: number, v: number, a: number) => [
      round(tipX + (u * Math.cos(a) - v * Math.sin(a)) * s),
      round(tipY + (u * Math.sin(a) + v * Math.cos(a)) * s * 0.68),
    ];
    for (let k = 0; k < petals; k++) {
      const a = spin + (k / petals) * Math.PI * 2;
      const [x0, y0] = point(dist - half, 0, a);
      const [x1, y1] = point(dist, width * 1.4, a);
      const [x2, y2] = point(dist + half, 0, a);
      const [x3, y3] = point(dist, -width * 1.4, a);
      add(group, flower.petals, `M${x0} ${y0}Q${x1} ${y1} ${x2} ${y2}Q${x3} ${y3} ${x0} ${y0}Z`);
    }
    add(group, flower.centre!, ellipseD(tipX, tipY, head.centre * s, head.centre * s * 0.68));
  }

  const stemWidth = round2(Math.max(0.4, ((size[0] + size[1]) / 2) * 0.7));
  return groups.map(({ stems, heads }, g) => (
    <g key={g} className="sway" style={{ animationDelay: `${-g * 1.3 - seed * 0.1}s`, animationDuration: `${4 + g * 0.7}s` }}>
      <path d={stems} stroke="#4a6131" strokeWidth={stemWidth} fill="none" />
      {[...heads].map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </g>
  ));
}

const MOTES: [number, number, number][] = [
  [700, 300, 3], [820, 420, 2], [930, 260, 2.5], [1040, 380, 3], [760, 520, 2],
  [1120, 300, 2], [880, 600, 2.5], [990, 520, 2], [640, 430, 2], [1180, 470, 2.5],
];

const LEAVES = ["#1f3119", "#293f21", "#344d2a", "#435e35", "#587347", "#738a5e"];

// Out-of-focus light through the canopy, like a camera's bokeh: soft-edged discs
// of sunlight scattered across the top of the forest, thickest near the clearing.
function Bokeh({ seed, count }: { seed: number; count: number }) {
  const rand = seeded(seed);
  return (
    <g fill="#fff8df" filter="url(#blur-bokeh)">
      {Array.from({ length: count }, (_, i) => {
        const x = 900 + (rand() - 0.5) * 1500 * Math.sqrt(rand());
        const y = rand() ** 1.6 * 420;
        const r = 6 + rand() * 18;
        return <circle key={i} cx={round(x)} cy={round(y)} r={round(r)} opacity={round(0.12 + rand() * 0.3)} />;
      })}
    </g>
  );
}

// One layer of the forest. The layers stack exactly on top of each other, and each
// is composited on its own (see .forest in teamSection.css), so the swaying grass
// only repaints its own layer and never makes the browser re-run the expensive
// blurs and textures on the still layers around it.
function ForestLayer({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <svg className={`forest ${className}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {children}
    </svg>
  );
}

// The sunlit forest behind the whole section: light pouring into a clearing through
// layers of trees, hazier the further away they are, with a meadow along the bottom.
// Still and moving parts are in separate layers (see ForestLayer); the gradients
// and filters defined in the first are shared by all of them. Memoised, like the
// hive and the bees' colours, so hovering the team (which re-renders the section
// to light up a team) doesn't rebuild its thousands of elements.
const ForestBackdrop = memo(function ForestBackdrop() {
  return (
    <>
      <ForestLayer>
        <defs>
          <radialGradient id="forest-sky" cx="0.56" cy="0.2" r="0.8">
            <stop offset="0" stopColor="#fbf6e2" />
            <stop offset="0.1" stopColor="#e4dfb6" />
            <stop offset="0.36" stopColor="#8f9c73" />
            <stop offset="1" stopColor="#2c3925" />
          </radialGradient>
          <linearGradient id="forest-ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffbe6" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#fff4cc" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff4cc" stopOpacity="0" />
          </linearGradient>
          {/* The sun's glare where it breaks through the canopy over the clearing. */}
          <radialGradient id="sun-bloom">
            <stop offset="0" stopColor="#fffef4" />
            <stop offset="0.25" stopColor="#fff7d6" stopOpacity="0.8" />
            <stop offset="0.6" stopColor="#fbe9a8" stopOpacity="0.25" />
            <stop offset="1" stopColor="#fbe9a8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sun-pool">
            <stop offset="0" stopColor="#fff3bf" stopOpacity="1" />
            <stop offset="1" stopColor="#fff3bf" stopOpacity="0" />
          </radialGradient>
          <BlossomDef />
          <linearGradient id="forest-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b3b682" />
            <stop offset="0.35" stopColor="#7a8650" />
            <stop offset="1" stopColor="#2f3f22" />
          </linearGradient>
          <linearGradient id="forest-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f1cf" stopOpacity="0" />
            <stop offset="0.7" stopColor="#f4f1cf" stopOpacity="0.2" />
            <stop offset="1" stopColor="#f4f1cf" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bark-left" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2a1e12" />
            <stop offset="0.6" stopColor="#4a3622" />
            <stop offset="1" stopColor="#7a6040" />
          </linearGradient>
          <linearGradient id="bark-right" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7a6040" />
            <stop offset="0.4" stopColor="#4a3622" />
            <stop offset="1" stopColor="#2a1e12" />
          </linearGradient>
          {/* Grass blades: dark at the root, lighter toward the tip where the light catches. */}
          {[
            ["grass-far-a", "#5f7140", "#b4bb84"],
            ["grass-far-b", "#6b7d47", "#c6c99a"],
            ["grass-near-a", "#1c2a16", "#56703a"],
            ["grass-near-b", "#24351c", "#6c8448"],
            ["grass-near-c", "#1a2714", "#4a6332"],
          ].map(([id, root, tip]) => (
            <linearGradient key={id} id={id} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor={root} />
              <stop offset="1" stopColor={tip} />
            </linearGradient>
          ))}
          <radialGradient id="forest-vignette" cx="0.55" cy="0.4" r="0.8">
            <stop offset="0.5" stopColor="#121a0e" stopOpacity="0" />
            <stop offset="1" stopColor="#121a0e" stopOpacity="0.65" />
          </radialGradient>
          {/* Depth of field: the team is in focus, and everything blurs the further it
              is in front of or behind them, like a photo with a wide-open lens. */}
          <filter id="blur-far" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="blur-back" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          <filter id="blur-mid" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>
          <filter id="blur-near" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
          <filter id="blur-bokeh" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          {/* Bark: noise stretched tall into furrows, lit from the side and multiplied
              over the trunk's colour, softened a touch since the trunks are close to the lens. */}
          <filter id="bark-texture" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.006" numOctaves="4" seed="3" />
            <feDiffuseLighting surfaceScale="6" lightingColor="#ffffff">
              <feDistantLight azimuth="20" elevation="40" />
            </feDiffuseLighting>
            <feComposite in="SourceGraphic" operator="arithmetic" k1="1.45" />
            <feComposite in2="SourceAlpha" operator="in" />
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
          <filter id="blur-ray" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="blur-light" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          {/* Fine grain over everything, so it reads as painted rather than flat vector. */}
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill="url(#forest-sky)" />

        {/* Far trees and leaves, soft with distance. */}
        <g filter="url(#blur-far)" opacity="0.75">
          <g fill="#8d9a7c">
            {[60, 200, 320, 470, 620, 1080, 1190, 1310, 1430, 1560].map((x, i) => (
              <path key={x} d={trunk(x, 14 + (i % 3) * 4, 8, (i % 2 ? 6 : -6), 700)} />
            ))}
          </g>
          <Foliage
            seed={11}
            colors={["#7f8f6c", "#93a07e", "#a9b393", "#c3c9ab"]}
            clumps={[
              { cx: 120, cy: 160, rx: 200, ry: 110, count: 70, size: [16, 34] },
              { cx: 480, cy: 120, rx: 170, ry: 90, count: 55, size: [16, 32] },
              { cx: 1180, cy: 130, rx: 190, ry: 100, count: 60, size: [16, 34] },
              { cx: 1500, cy: 180, rx: 180, ry: 120, count: 60, size: [16, 34] },
            ]}
          />
        </g>

        <rect y="300" width="1600" height="480" fill="url(#forest-haze)" />
      </ForestLayer>

      {/* The sun breaking through over the clearing, and shafts of light fanning
          out from it through the trees, blurred so they glow. The whole layer is
          screened over the forest so it brightens rather than fogs, and shimmers,
          which the browser can do without repainting it. */}
      <ForestLayer className="sun-rays">
        <ellipse cx={SUN.x} cy={SUN.y + 60} rx="640" ry="380" fill="url(#sun-bloom)" />
        <g filter="url(#blur-ray)">
          {[
            [855, 935, 1040, 1280, 0.95],
            [895, 950, 700, 860, 1],
            [935, 990, 1360, 1520, 0.75],
            [865, 910, 320, 420, 0.8],
            [880, 920, 520, 600, 0.65],
            [915, 960, 1150, 1210, 0.7],
            [870, 900, 40, 140, 0.5],
            [950, 985, 1640, 1720, 0.45],
          ].map(([topL, topR, bottomL, bottomR, opacity]) => (
            <path key={topL + bottomL} d={`M${topL} -20H${topR}L${bottomR} 900H${bottomL}Z`} fill="url(#forest-ray)" opacity={opacity} />
          ))}
        </g>
        {/* Where the shafts land, the meadow glows. */}
        <ellipse cx="790" cy="760" rx="170" ry="40" fill="url(#sun-pool)" />
        <ellipse cx="1160" cy="770" rx="190" ry="42" fill="url(#sun-pool)" opacity="0.8" />
        <ellipse cx="560" cy="735" rx="110" ry="26" fill="url(#sun-pool)" opacity="0.6" />
      </ForestLayer>

      <ForestLayer>
        {/* Middle trees. */}
        <g filter="url(#blur-back)">
          {[
            [140, 34, -10],
            [390, 26, 8],
            [570, 20, -4],
            [1100, 24, 6],
            [1270, 32, -8],
            [1440, 28, 10],
          ].map(([x, base, lean]) => (
            <path key={x} d={trunk(x, base, base * 0.55, lean, 740)} fill={x < 900 ? "url(#bark-left)" : "url(#bark-right)"} opacity="0.85" />
          ))}
          <Foliage
            seed={23}
            colors={["#2d4326", "#3a5231", "#4d6640", "#677e57", "#8a9c74"]}
            clumps={[
              { cx: 160, cy: 70, rx: 230, ry: 120, count: 120, size: [12, 26] },
              { cx: 470, cy: 40, rx: 170, ry: 80, count: 80, size: [12, 24] },
              { cx: 1180, cy: 50, rx: 200, ry: 90, count: 90, size: [12, 24] },
              { cx: 1480, cy: 90, rx: 220, ry: 130, count: 120, size: [12, 26] },
            ]}
          />
        </g>

        <Bokeh seed={17} count={38} />

        {/* The forest floor. */}
        <path d="M0 700C200 685 420 705 640 692C860 680 1080 700 1300 690C1440 684 1540 692 1600 688V900H0Z" fill="url(#forest-ground)" />
        <ellipse cx="900" cy="715" rx="460" ry="48" fill="#f3efb8" opacity="0.4" filter="url(#blur-light)" />
      </ForestLayer>

      <ForestLayer>
        <g filter="url(#blur-mid)" opacity="0.9">
          {grassTufts(31, 260, 692, 762, [12, 24], ["url(#grass-far-a)", "url(#grass-far-b)"])}
        </g>

        {/* A carpet of short grass over the meadow, so the ground isn't bare between tufts. */}
        {grassRun(97, 800, 3.5, [26, 52], ["url(#grass-far-a)", "url(#grass-far-b)", "url(#grass-near-b)"])}

        {/* Wildflowers poking up through the meadow grass. */}
        {wildflowers(41, 130, 700, 800, [0.22, 0.42])}

        {/* Bushes at the edge of the clearing, just behind the team so a little soft. */}
        <g filter="url(#blur-near)">
          <Bushes
            seed={47}
            bushes={[
              { cx: 190, base: 782, w: 340, h: 150, count: 320, size: [14, 22], bloom: "#f1e8ee" },
              { cx: 565, base: 764, w: 200, h: 88, count: 160, size: [11, 17] },
              { cx: 1090, base: 766, w: 230, h: 98, count: 185, size: [11, 17], bloom: "#e7a7bd" },
              { cx: 1420, base: 785, w: 360, h: 160, count: 350, size: [14, 22] },
            ]}
          />
          {/* More flowers growing up around the bushes' feet. */}
          {wildflowers(53, 70, 780, 830, [0.42, 0.6])}
        </g>
      </ForestLayer>

      <ForestLayer>
        {/* Big trees at the front, framing the clearing, with furrowed bark. */}
        <path d="M-30 900V-10H96C88 220 98 470 120 690C128 790 160 860 200 900Z" fill="url(#bark-left)" filter="url(#bark-texture)" />
        <path d="M1630 900V-10H1505C1512 250 1498 500 1474 700C1464 800 1430 868 1392 900Z" fill="url(#bark-right)" filter="url(#bark-texture)" />
        <g filter="url(#blur-mid)">
          <Foliage
            seed={59}
            colors={LEAVES}
            clumps={[
              { cx: 60, cy: 30, rx: 260, ry: 110, count: 190, size: [10, 22] },
              { cx: 1560, cy: 40, rx: 270, ry: 120, count: 200, size: [10, 22] },
            ]}
          />
        </g>

        {/* Grass in the foreground. */}
        {/* Soft shadow where the front trees meet the ground, and thick grass across
            their bases, so the trunks stand in the meadow rather than the grass
            seeming to sprout from the bark. */}
        <g fill="#14240d" opacity="0.6" filter="url(#blur-mid)">
          <ellipse cx="90" cy="890" rx="190" ry="34" />
          <ellipse cx="1510" cy="890" rx="190" ry="34" />
        </g>
      </ForestLayer>

      <ForestLayer>
        {/* Closest to the lens, so out of focus. */}
        <g filter="url(#blur-near)">
          {[[-30, 300], [1300, 1630]].map(([from, to], i) => (
            <g key={from}>
              {grassRun(81 + i, 845, 1.4, [50, 95], ["url(#grass-near-a)", "url(#grass-near-b)", "url(#grass-near-c)"], from, to)}
              {grassRun(91 + i, 880, 1.2, [70, 130], ["url(#grass-near-a)", "url(#grass-near-c)", "url(#grass-near-b)"], from, to)}
            </g>
          ))}
          {grassRun(61, 860, 3, [55, 100], ["url(#grass-near-a)", "url(#grass-near-b)", "url(#grass-far-a)"])}
          {wildflowers(67, 60, 850, 895, [1, 1.5])}
        </g>
        <g filter="url(#blur-mid)">
          {grassRun(73, 915, 2.6, [90, 160], ["url(#grass-near-a)", "url(#grass-near-b)", "url(#grass-near-c)"])}
        </g>

        <g className="motes" fill="#fffbe6" filter="url(#blur-mid)">
          {MOTES.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </g>
      </ForestLayer>

      <ForestLayer>
        <rect width="1600" height="900" fill="url(#forest-vignette)" />
        <rect width="1600" height="900" filter="url(#grain)" />
      </ForestLayer>
    </>
  );
});


// Bees looping around the hive between deliveries.
const AMBIENT_FLIGHTS = [
  { path: "M200 238C270 210 300 140 250 105C200 75 95 125 115 210C130 260 170 252 200 238Z", duration: "8s" },
  { path: "M200 238C130 285 45 250 55 175C65 115 155 135 195 175C225 205 222 228 200 238Z", duration: "6.5s" },
  { path: "M200 238C250 305 315 285 300 220C290 170 240 190 225 210C212 226 208 234 200 238Z", duration: "10s" },
];

// A wild hive hanging from a branch that reaches in from the left edge: a lumpy,
// ridged body lit from the upper right, with honey seeping from the bottom.
// `entranceRef` marks the hole the bees fly out of.
const HangingHive = memo(function HangingHive({ entranceRef }: { entranceRef: Ref<SVGEllipseElement> }) {
  // Each ridge: its height and half-width, so the ridges follow the hive's curve.
  const ridges: [number, number][] = [[92, 40], [118, 62], [146, 76], [174, 82], [202, 81], [230, 74], [258, 62], [284, 44]];
  const outline =
    "M152 66C176 66 200 84 214 114C230 146 236 188 230 226C224 262 208 290 186 306C172 316 160 318 152 318C142 318 128 314 114 302C92 284 76 256 72 222C68 184 76 142 92 112C108 82 130 66 152 66Z";

  return (
    <svg className="hanging-hive" viewBox="0 0 300 380" aria-hidden>
      <defs>
        <radialGradient id="hive-body" cx="0.68" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#e8d3a2" />
          <stop offset="0.45" stopColor="#bf9a5c" />
          <stop offset="0.85" stopColor="#7c5a30" />
          <stop offset="1" stopColor="#4c341a" />
        </radialGradient>
        {/* Rough, papery layers: fine noise swirled sideways, lit from the upper right
            and multiplied over the colour underneath, for the hive and the bark alike. */}
        <filter id="hive-soften" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="hive-texture" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.11" numOctaves="4" seed="8" />
          <feDiffuseLighting surfaceScale="2.5" lightingColor="#ffffff">
            <feDistantLight azimuth="-45" elevation="45" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" operator="arithmetic" k1="1.4" />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
        <radialGradient id="hive-entrance" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#0d0803" />
          <stop offset="0.75" stopColor="#24170a" />
          <stop offset="1" stopColor="#4a3215" />
        </radialGradient>
        <linearGradient id="hive-honey" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a5410" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#c98d2e" stopOpacity="0.8" />
          <stop offset="1" stopColor="#6e420c" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="branch-bark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a6040" />
          <stop offset="0.5" stopColor="#4d3923" />
          <stop offset="1" stopColor="#2a1e12" />
        </linearGradient>
        <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7f9658" />
          <stop offset="1" stopColor="#36502a" />
        </linearGradient>
        <pattern id="hive-comb" width="10" height="17.32" patternUnits="userSpaceOnUse">
          <path d="M5 0L10 2.9V8.7L5 11.5L0 8.7V2.9ZM5 11.5V17.32" fill="none" stroke="#5e3e18" strokeWidth="0.8" />
        </pattern>
        <clipPath id="hive-clip">
          <path d={outline} />
        </clipPath>
      </defs>

      {/* The branch: thick where it leaves the tree, tapering to a point, with
          twigs forking off it and leaves at their tips. */}
      <path
        d="M-60 50C20 42 90 37 150 39C200 41 240 37 270 33C284 31 296 29 306 27C294 33 282 38 268 41C238 47 200 54 150 56C90 57 20 66 -60 84Z"
        fill="url(#branch-bark)"
        filter="url(#hive-texture)"
      />
      <path d="M218 45C240 34 262 18 286 3C268 21 248 37 233 46Z" fill="url(#branch-bark)" filter="url(#hive-texture)" />
      <path d="M244 46C258 50 272 58 287 66C272 60 258 54 242 50Z" fill="#4d3923" />
      <path d="M84 46C78 30 68 16 50 3C72 13 88 27 100 42Z" fill="url(#branch-bark)" filter="url(#hive-texture)" />
      {/* Bark: a lit ridge along the top, a darker groove beneath it, and a knot. */}
      <path d="M-60 56C20 48 90 43 150 44C200 45 236 41 262 37" stroke="#8a6d48" strokeOpacity="0.5" strokeWidth="1.5" fill="none" />
      <path d="M-60 70C20 61 90 52 150 51C196 50 226 46 250 43" stroke="#2a1e12" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
      <ellipse cx="112" cy="48" rx="6" ry="3.5" fill="#2a1e12" opacity="0.45" />
      <path d="M146 50C148 58 150 63 152 70" stroke="#4d3923" strokeWidth="9" strokeLinecap="round" />
      {[
        { x: 50, y: 3, r: -150 },
        { x: 70, y: 20, r: 165 },
        { x: 286, y: 3, r: -35 },
        { x: 262, y: 26, r: -70 },
        { x: 306, y: 27, r: -8 },
        { x: 287, y: 66, r: 50 },
        { x: 12, y: 68, r: 110 },
      ].map(({ x, y, r }) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0 0C10 -11 32 -11 46 0C32 11 10 11 0 0Z" fill="url(#leaf)" />
          <path d="M0 0H42M14 0L22 -5M24 0L32 -5M14 0L22 5M24 0L32 5" stroke="#2f4f1f" strokeOpacity="0.22" strokeWidth="0.6" fill="none" />
        </g>
      ))}

      {/* The hive. */}
      <path d={outline} fill="url(#hive-body)" filter="url(#hive-texture)" />
      <g clipPath="url(#hive-clip)">
        <rect width="300" height="380" fill="url(#hive-comb)" opacity="0.05" />
        {/* Soft, uneven ridges where each layer of the hive overlaps the last. */}
        {ridges.map(([y, half], i) => (
          <g key={y}>
            <path
              d={`M${152 - half - 8} ${y}C${152 - half / 2} ${y + 13 + (i % 2) * 3} ${152 + half / 2} ${y + 12 - (i % 3)} ${152 + half + 8} ${y - 1}`}
              stroke="#4c341a"
              strokeOpacity={0.22 + (i % 3) * 0.06}
              strokeWidth={4 + (i % 3)}
              fill="none"
              filter="url(#hive-soften)"
            />
            <path
              d={`M${152 - half - 8} ${y - 5}C${152 - half / 2} ${y + 7} ${152 + half / 2} ${y + 6} ${152 + half + 8} ${y - 6}`}
              stroke="#f2e2b8"
              strokeOpacity="0.18"
              strokeWidth="2"
              fill="none"
              filter="url(#hive-soften)"
            />
          </g>
        ))}
        {/* Shadow under the branch and down the hive's far side. */}
        <ellipse cx="150" cy="62" rx="70" ry="18" fill="#2a1e12" opacity="0.35" />
      </g>
      <ellipse cx="172" cy="226" rx="20" ry="13" fill="#6e4a1c" opacity="0.6" />
      <ellipse ref={entranceRef} cx="171" cy="224" rx="16" ry="10.5" fill="url(#hive-entrance)" />
      <path d="M155 233C164 240 180 240 188 232" stroke="#f2d38a" strokeOpacity="0.55" strokeWidth="2" fill="none" />

      {/* Honey seeping from the bottom: a short drip, and a longer one that slowly
          swells a drop at its tip, lets it go and starts again (see .hive-drip). */}
      <path d="M134 308C132 326 140 336 145 324C147 316 146 312 146 312Z" fill="url(#hive-honey)" />
      <path className="hive-drip" d="M160 314C159 330 162 340 166 344C170 340 173 330 172 314Z" fill="url(#hive-honey)" />
      <g className="hive-drop">
        <ellipse cx="166" cy="349" rx="5" ry="6" fill="url(#hive-honey)" />
        <ellipse cx="164.4" cy="347" rx="1.3" ry="1.9" fill="#fff6d6" opacity="0.75" />
      </g>

      {/* A couple of bees resting on the hive by the entrance. */}
      <Bee caste="worker" x={186} y={238} width={24} height={16} transform="rotate(20 198 246)" />
      <Bee caste="worker" x={130} y={196} width={22} height={15} transform="rotate(-160 141 203)" />

      <g className="ambient-bees">
        {AMBIENT_FLIGHTS.map(({ path, duration }, i) => (
          <g key={i}>
            <animateMotion dur={duration} repeatCount="indefinite" rotate="auto" path={path} />
            <Bee caste="worker" x={-15} y={-10} width={30} height={21} />
          </g>
        ))}
      </g>
    </svg>
  );
});

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Of each bee's trip, the share spent carrying its hex out; the rest is the bee
// letting go and heading back.
const CARRY = 0.75;
// How high the hexes arc on their way out, in pixels.
const LIFT = 80;

export function TeamSection() {
  const pageRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const honeycombRef = useRef<HTMLDivElement>(null);
  const entranceRef = useRef<SVGEllipseElement>(null);
  const edgeRef = useRef<HTMLSpanElement>(null);
  const [litTeam, setLitTeam] = useState<string | null>(null);

  // The navbar's height changes (it wraps on narrow screens), so measure it
  // instead of hard-coding it. It starts as a loading placeholder that's swapped
  // for the real one, so look it up again whenever the page's top level changes.
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const resizes = new ResizeObserver(() => update());
    const update = () => {
      const header = document.querySelector("body > header");
      if (!header) return;
      page.style.setProperty("--nav-h", `${header.getBoundingClientRect().height}px`);
      resizes.observe(header);
    };
    update();

    const swaps = new MutationObserver(update);
    swaps.observe(document.body, { childList: true });
    return () => {
      resizes.disconnect();
      swaps.disconnect();
    };
  }, []);

  // Bees carry the team out of the hive as the visitor scrolls, top of the hierarchy
  // first, and take them back if they scroll up again.
  //
  // Where the whole honeycomb fits on screen, the forest is pinned (data-pinned) for
  // a stretch of scrolling and that stretch drives every bee in turn. Where it
  // doesn't, like on a phone, each hex flies in as its spot scrolls into view.
  // Without JavaScript, or for visitors who'd rather not have motion, none of this
  // runs and the team is simply shown. A layout effect, so the hexes are tucked
  // away before the first paint rather than flashing up and vanishing.
  useLayoutEffect(() => {
    const page = pageRef.current;
    const stage = stageRef.current;
    const honeycomb = honeycombRef.current;
    const entrance = entranceRef.current;
    const edge = edgeRef.current;
    if (!page || !stage || !honeycomb || !entrance || !edge) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const slots = [...honeycomb.querySelectorAll<HTMLElement>(".hex-slot")];
    const bees = slots.map((slot) => slot.querySelector<SVGSVGElement>(".carrier")!);
    // How far each hex's spot is from the hive entrance. The spots are read from
    // offsetLeft/Top, which ignore the transforms the flight puts on them.
    let paths: { dx: number; dy: number }[] = [];
    // How far the honey dripping off the FAQ above hangs down over the forest.
    let overhang = 0;
    let frame = 0;

    const navHeight = () => parseFloat(getComputedStyle(page).getPropertyValue("--nav-h")) || 64;

    const measure = () => {
      // Pin only if the hive and the honeycomb (with a little room under it) fit on
      // screen at once. Measured unpinned, where the stage has extra room under the
      // honeycomb (see .team-content), so leave that out.
      delete page.dataset.pinned;
      const stageTop = stage.getBoundingClientRect().top;
      const needed = Math.max(
        entrance.ownerSVGElement!.getBoundingClientRect().bottom,
        honeycomb.getBoundingClientRect().bottom + 48,
      ) - stageTop;
      if (needed <= window.innerHeight - navHeight()) page.dataset.pinned = "";

      // Its drips stretch as they ooze (see .drip in faqSection.css), so allow a little extra.
      const honey = document.querySelector(".honey-edge.is-bottom");
      overhang = honey ? Math.max(0, honey.getBoundingClientRect().bottom - page.getBoundingClientRect().top) * 1.15 : 0;

      const hole = entrance.getBoundingClientRect();
      const comb = honeycomb.getBoundingClientRect();
      paths = slots.map((slot) => {
        const x = comb.left + slot.offsetLeft + slot.offsetWidth / 2;
        const y = comb.top + slot.offsetTop + slot.offsetHeight / 2;
        const dy = hole.top + hole.height / 2 - y;
        // Where the hive is well above a hex's spot (on a phone, it's scrolled away
        // by then), the bee brings it in from the left edge of the screen instead.
        return Math.abs(dy) > window.innerHeight * 0.5
          ? { dx: -x - 60, dy: -80 }
          : { dx: hole.left + hole.width / 2 - x, dy };
      });
    };

    // How far along its trip each bee is, from 0 (still in the hive) to 1 (back home).
    const progress = (): number[] => {
      const vh = window.innerHeight;
      if ("pinned" in page.dataset) {
        // From when the FAQ's honey has scrolled off the top of the screen, so
        // everyone stays in the hive while it's in view, to the end of the pinned
        // stretch, when the stage (pinned at the top of the screen) lets go.
        const top = page.getBoundingClientRect().top;
        const from = -overhang;
        const to = -(page.offsetHeight - stage.offsetHeight);
        const overall = clamp((from - top) / (from - to));
        return hive.cells.map((cell) => clamp((overall - cell.start) / FLIGHT_SHARE));
      }
      // Each hex flies in from when its spot comes up from the bottom of the screen
      // until it's halfway up. This section ends the page, so the last hexes are
      // squeezed in to land by the time the visitor can't scroll any further.
      const scroll = window.scrollY;
      const end = document.documentElement.scrollHeight - vh;
      const combTop = honeycomb.getBoundingClientRect().top + scroll;
      return slots.map((slot) => {
        const spot = combTop + slot.offsetTop;
        let start = spot - vh * 0.95;
        let finish = spot - vh * 0.5;
        if (finish > end) {
          finish = end;
          start = Math.min(start, end - vh * 0.15);
        }
        return clamp((scroll - start) / (finish - start));
      });
    };

    const render = () => {
      frame = 0;

      // The soft top edge that blends the forest into the FAQ above it clears
      // away in the last moment before the section reaches the navbar, so it never
      // hazes the forest but is there all the while the join is on screen.
      edge.style.opacity = String(clamp((page.getBoundingClientRect().top - navHeight()) / (window.innerHeight * 0.12)));

      progress().forEach((trip, i) => {
        const slot = slots[i];
        const bee = bees[i];
        const { dx, dy } = paths[i];
        const carry = clamp(trip / CARRY);
        const leave = clamp((trip - CARRY) / (1 - CARRY));

        if (carry < 1) {
          // Out of the entrance, up in an arc and down into its spot, swaying.
          const e = easeInOut(carry);
          const x = dx * (1 - e);
          const y = dy * (1 - e) - LIFT * Math.sin(Math.PI * e);
          const sway = Math.sin(carry * Math.PI * 4) * 6 * (1 - carry);
          slot.style.transform = `translate(${x}px, ${y}px) scale(${0.25 + 0.75 * e}) rotate(${sway}deg)`;
          slot.style.opacity = String(clamp(carry * 8));
        } else {
          slot.style.transform = "";
          slot.style.opacity = "";
        }
        slot.classList.toggle("is-flying", carry < 1);

        // Once the hex is in place, the bee lets go, turns and flies back to the hive.
        bee.style.transform = leave > 0 ? `translate(${dx * 0.5 * leave}px, ${dy * 0.5 * leave - 40 * leave}px) scaleX(-1)` : "";
        bee.style.opacity = carry > 0 ? String(1 - leave) : "0";
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const relayout = () => {
      measure();
      render();
    };

    page.dataset.flying = "";
    relayout();
    window.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(relayout);
    observer.observe(page);
    window.addEventListener("resize", relayout);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", relayout);
      observer.disconnect();
      delete page.dataset.flying;
      delete page.dataset.pinned;
      slots.forEach((slot, i) => {
        slot.style.transform = slot.style.opacity = "";
        bees[i].style.transform = bees[i].style.opacity = "";
      });
      edge.style.opacity = "";
    };
  }, []);

  const hiveStyle = {
    "--wide-cols": hive.wide.cols,
    "--wide-rows": hive.wide.rows,
    "--narrow-cols": hive.narrow.cols,
    "--narrow-rows": hive.narrow.rows,
  } as CSSProperties;

  return (
    <section id="team" aria-label="Team" className="team-page scroll-mt-16" ref={pageRef} style={hiveStyle}>
      <div className="team-stage" ref={stageRef}>
        <BeeDefs />
        <ForestBackdrop />
        <span className="forest-edge" ref={edgeRef} aria-hidden />
        <HangingHive entranceRef={entranceRef} />

        <div className="team-content">
          <h1>The team behind HackHive</h1>

          {/* Hovering anyone lights up the rest of their team. */}
          <div className="honeycomb-frame">
            <div className="honeycomb" ref={honeycombRef}>
              {hive.cells.map(({ member, team, caste, wide, narrow }) => (
                <div
                  key={member.name}
                  className={`hex-slot${team === litTeam ? " is-lit" : ""}`}
                  style={
                    {
                      "--wide-x": wide[0] - hive.wide.minX,
                      "--wide-y": wide[1],
                      "--narrow-x": narrow[0] - hive.narrow.minX,
                      "--narrow-y": narrow[1],
                    } as CSSProperties
                  }
                  onMouseEnter={() => setLitTeam(team)}
                  onMouseLeave={() => setLitTeam(null)}
                  // Only keyboard focus lights the team; a click shouldn't leave it lit.
                  onFocus={(event) => event.target.matches(":focus-visible") && setLitTeam(team)}
                  onBlur={() => setLitTeam(null)}
                >
                  <Bee caste={caste} className="carrier" />
                  <MemberHex member={member} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
