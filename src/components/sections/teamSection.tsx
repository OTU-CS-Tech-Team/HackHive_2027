"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { teamData, type TeamMember } from "@/app/data/teamData";
import "./teamSection.css";

type TeamMemberProps = {
  image: string;
  name: string;
  role: string;
  link: string;
};

// One hexagon of a team's honeycomb. The role is revealed on hover.
function TeamMemberCard(props: TeamMemberProps) {
  const content = (
    <span className="hex-inner">
      <img src={props.image} alt={`Photo of ${props.name}`} />
      <span className="hex-label">
        <span className="hex-name">{props.name}</span>
        <span className="hex-role">{props.role}</span>
      </span>
    </span>
  );

  return props.link ? (
    <a className="hex-cell" href={props.link} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <div className="hex-cell">{content}</div>
  );
}

// "row" groups are a single line of hexes, like a pair of presidents.
// "department" groups put the director alone on top with their team in neat rows beneath.
// "cluster" groups put the director on top with their team in a looser, hand-placed shape.
type TeamGroup = {
  id: string;
  name: string;
  kind: "row" | "department" | "cluster";
  members: TeamMember[];
  scatter?: { x: number; y: number };
};

const leads: TeamGroup[] = [
  { id: "presidents", name: "Presidents", kind: "row", members: teamData.presidents },
  { id: "vice-presidents", name: "Vice Presidents", kind: "row", members: teamData.vicePresidents },
];

// Deliberately mixed up (wide and narrow combs side by side) and offset by hand, so
// the hive looks random but stays the same on every visit.
const departments: TeamGroup[] = [
  { id: "tech", name: "Tech Team", kind: "cluster", members: teamData.tech, scatter: { x: -1, y: 0 } },
  { id: "operations", name: "Operations Team", kind: "department", members: teamData.operations, scatter: { x: 1, y: 3.5 } },
  { id: "marketing", name: "Marketing Team", kind: "cluster", members: teamData.marketing, scatter: { x: 1, y: 1 } },
  { id: "sponsors", name: "Sponsors Team", kind: "department", members: teamData.sponsors, scatter: { x: -2, y: 0.5 } },
  { id: "events", name: "Events Team", kind: "cluster", members: teamData.events, scatter: { x: 1.5, y: 2.5 } },
];

const advisors: TeamGroup = {
  id: "advisors",
  name: "Advisors",
  kind: "row",
  members: teamData.advisors,
};

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

// The widest a row under a director gets, so a comb still fits on a phone.
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

function MemberHex({ member }: { member: TeamMember }) {
  return (
    <TeamMemberCard
      image={member.Image}
      name={member.name}
      role={member.role}
      link={member.link}
    />
  );
}

function Honeycomb({ group }: { group: TeamGroup }) {
  // Rows are plain flex so a long one (the advisors) can wrap on a phone.
  if (group.kind === "row") {
    return (
      <section className="comb-group" aria-label={group.name}>
        <h2>{group.name}</h2>
        <div className="hex-row">
          {group.members.map((member) => (
            <div key={member.name} className="hex-slot">
              <MemberHex member={member} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const positions =
    group.kind === "cluster"
      ? clusterPositions(group.members.length)
      : departmentPositions(group.members.length);
  const xs = positions.map(([x]) => x);
  const ys = positions.map(([, y]) => y);
  const minX = Math.min(...xs);

  const combStyle = {
    "--cols": Math.max(...xs) - minX + 1,
    "--rows": Math.max(...ys),
  } as CSSProperties;

  const scatterStyle = group.scatter
    ? ({ "--scatter-x": `${group.scatter.x}rem`, "--scatter-y": `${group.scatter.y}rem` } as CSSProperties)
    : undefined;

  return (
    <section className="comb-group" aria-label={group.name} style={scatterStyle}>
      <h2>{group.name}</h2>
      <div className="honeycomb" style={combStyle}>
        {group.members.map((member, i) => (
          <div
            key={member.name}
            className="hex-slot"
            style={{ "--x": positions[i][0] - minX, "--y": positions[i][1] } as CSSProperties}
          >
            <MemberHex member={member} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TeamSection() {
  const pageRef = useRef<HTMLElement>(null);

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

  return (
    <section id="team" aria-label="Team" className="team-page scroll-mt-16" ref={pageRef}>
      <h1>The team behind HackHive</h1>

      <div className="team-leads">
        {leads.map((group) => (
          <Honeycomb key={group.id} group={group} />
        ))}
      </div>

      <div className="team-hive">
        {departments.map((group) => (
          <Honeycomb key={group.id} group={group} />
        ))}
      </div>

      <div className="team-advisors">
        <Honeycomb group={advisors} />
      </div>
    </section>
  );
}
