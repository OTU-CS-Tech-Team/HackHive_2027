"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
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
// Members with a LinkedIn link get a "LinkedIn" pill under their role, and clicking
// the hex opens their profile in a new tab.
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
        {props.link && (
          <span className="hex-cta" aria-hidden>
            LinkedIn ↗
          </span>
        )}
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

const groups: TeamGroup[] = [
  { id: "presidents", name: "Presidents", kind: "row", members: teamData.presidents, wide: { x: 4, y: 0 }, narrow: { x: 0.5, y: 0 } },
  { id: "vice-presidents", name: "Vice Presidents", kind: "row", members: teamData.vicePresidents, wide: { x: 6, y: 0 }, narrow: { x: 2.5, y: 0 } },
  { id: "tech", name: "Tech Team", kind: "cluster", members: teamData.tech, shape: TECH_SHAPE, wide: { x: 0.5, y: 1 }, narrow: { x: 1, y: 1 } },
  { id: "operations", name: "Operations Team", kind: "department", members: teamData.operations, wide: { x: 2.5, y: 1 }, narrow: { x: 3, y: 1 } },
  { id: "marketing", name: "Marketing Team", kind: "cluster", members: teamData.marketing, wide: { x: 4.5, y: 1 }, narrow: { x: 3, y: 3 } },
  { id: "sponsors", name: "Sponsors Team", kind: "department", members: teamData.sponsors, wide: { x: 7.5, y: 1 }, narrow: { x: 1.5, y: 4 } },
  { id: "events", name: "Events Team", kind: "cluster", members: teamData.events, wide: { x: 9.5, y: 1 }, narrow: { x: 2.5, y: 6 } },
  { id: "advisors", name: "Advisors", kind: "row", members: teamData.advisors, wide: { x: 3, y: 4 }, narrow: { x: 0.5, y: 8, perRow: 3 } },
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

type HiveCell = { member: TeamMember; team: string; wide: [number, number]; narrow: [number, number] };

// Places every member in the hive for both screen sizes, shifted so the hive starts at 0, 0.
function buildHive() {
  const cells: HiveCell[] = groups.flatMap((group) => {
    const wide = groupPositions(group, group.wide);
    const narrow = groupPositions(group, group.narrow);
    return group.members.map((member, i) => ({ member, team: group.id, wide: wide[i], narrow: narrow[i] }));
  });

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

export function TeamSection() {
  const pageRef = useRef<HTMLElement>(null);
  const [litTeam, setLitTeam] = useState<string | null>(null);

  // The page is sized to exactly fill the space under the navbar so that only the
  // footer needs scrolling to. The navbar's height changes (it wraps on narrow
  // screens), so measure it instead of hard-coding it.
  useEffect(() => {
    const page = pageRef.current;
    const header = document.querySelector("body > header");
    if (!page || !header) return;

    const update = () =>
      page.style.setProperty("--nav-h", `${header.getBoundingClientRect().height}px`);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const hiveStyle = {
    "--wide-cols": hive.wide.cols,
    "--wide-rows": hive.wide.rows,
    "--narrow-cols": hive.narrow.cols,
    "--narrow-rows": hive.narrow.rows,
  } as CSSProperties;

  return (
    <section id="team" aria-label="Team" className="team-page scroll-mt-16" ref={pageRef} style={hiveStyle}>
      <h1>The team behind HackHive</h1>

      {/* Hovering anyone lights up the rest of their team. */}
      <div className="honeycomb">
        {hive.cells.map(({ member, team, wide, narrow }) => (
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
            <MemberHex member={member} />
          </div>
        ))}
      </div>
    </section>
  );
}
