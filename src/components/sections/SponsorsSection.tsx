/* eslint-disable @next/next/no-img-element -- logos come from Supabase Storage */
import type { CSSProperties } from "react";
import Image from "next/image";
import SplitText from "@/components/SplitText";
import { getSponsors, type Sponsor } from "@/lib/content";
import { rand } from "./comb";
import { ForestMotion } from "./ForestMotion";
import styles from "./SponsorsSection.module.css";

// TODO: real sponsorship inbox.
const SPONSOR_EMAIL = "otu.csclub@gmail.com";
const SPONSOR_CONTACT = `mailto:${SPONSOR_EMAIL}?subject=Sponsoring%20HackHive%202027`;

// Wider tiles for the smaller tier. Rows are filled out with placeholder cells.
function tierLayout(tier: Sponsor["tier"]): { columns: number; medal: string } {
  switch (tier) {
    case "gold":
      return { columns: 3, medal: "var(--honey)" };
    case "silver":
      return { columns: 3, medal: "#c9ced4" };
    case "bronze":
      return { columns: 4, medal: "#b86c2c" };
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}

const TIER_RANK: Record<Sponsor["tier"], number> = {
  gold: 0,
  silver: 1,
  bronze: 2,
};

function sponsorGroups(sponsors: Sponsor[]) {
  const tiers = [...new Set(sponsors.map((sponsor) => sponsor.tier))].sort(
    (a, b) => TIER_RANK[a] - TIER_RANK[b],
  );
  return tiers.map((tier) => ({
    tier,
    label: `${tier[0].toUpperCase()}${tier.slice(1)} sponsors`,
    ...tierLayout(tier),
    sponsors: sponsors.filter((sponsor) => sponsor.tier === tier),
  }));
}

// Last HackHive's line-up, which has a diamond tier the /admin list doesn't.
const PREVIOUS_TIERS = [
  { tier: "diamond", label: "Diamond sponsors", columns: 3, medal: "#8fd3e8" },
  { tier: "gold", label: "Gold sponsors", columns: 3, medal: "var(--honey)" },
  { tier: "silver", label: "Silver sponsors", columns: 3, medal: "#c9ced4" },
  { tier: "bronze", label: "Bronze sponsors", columns: 4, medal: "#b86c2c" },
] as const;

const PREVIOUS_SPONSORS: (Omit<Sponsor, "tier"> & {
  tier: (typeof PREVIOUS_TIERS)[number]["tier"];
})[] = [
  {
    id: "microsoft",
    name: "Microsoft",
    tier: "diamond",
    logo_url: "/sponsors/previous/microsoft.webp",
    website_url: "https://careers.microsoft.com/v2/global/en/home.html",
  },
  {
    id: "kyndryl",
    name: "Kyndryl",
    tier: "diamond",
    logo_url: "/sponsors/previous/kyndryl.webp",
    website_url: "https://www.kyndryl.com/us/en",
  },
  {
    id: "science-council",
    name: "Ontario Tech Science Council",
    tier: "diamond",
    logo_url: "/sponsors/previous/science-council.webp",
    website_url: null,
  },
  {
    id: "nexos-ai",
    name: "nexos.ai",
    tier: "gold",
    logo_url: "/sponsors/previous/nexos-ai.webp",
    website_url: "https://nexos.ai/",
  },
  {
    id: "incogni",
    name: "Incogni",
    tier: "gold",
    logo_url: "/sponsors/previous/incogni.webp",
    website_url: "https://incogni.com/",
  },
  {
    id: "saily",
    name: "Saily",
    tier: "gold",
    logo_url: "/sponsors/previous/saily.webp",
    website_url: "https://saily.com/",
  },
  {
    id: "nordpass",
    name: "NordPass",
    tier: "gold",
    logo_url: "/sponsors/previous/nordpass.webp",
    website_url: "https://nordpass.com/",
  },
  {
    id: "nordvpn",
    name: "NordVPN",
    tier: "gold",
    logo_url: "/sponsors/previous/nordvpn.webp",
    website_url: "https://nordvpn.com/hackathons",
  },
  {
    id: "nordprotect",
    name: "NordProtect",
    tier: "gold",
    logo_url: "/sponsors/previous/nordprotect.webp",
    website_url: "https://nordprotect.com/",
  },
  {
    id: "disabilities-at-microsoft",
    name: "Disabilities @ Microsoft",
    tier: "silver",
    logo_url: "/sponsors/previous/disabilities-at-microsoft.webp",
    website_url: "https://careers.microsoft.com/v2/global/en/home.html",
  },
  {
    id: "fantuan",
    name: "Fantuan",
    tier: "silver",
    logo_url: "/sponsors/previous/fantuan.webp",
    website_url: "https://fantuan.ca/en/",
  },
  {
    id: "fidelity",
    name: "Fidelity Investments",
    tier: "silver",
    logo_url: "/sponsors/previous/fidelity.webp",
    website_url: "https://www.fidelity.ca/en/",
  },
  {
    id: "dayforce",
    name: "Dayforce",
    tier: "bronze",
    logo_url: "/sponsors/previous/dayforce.webp",
    website_url: "https://www.dayforce.com/",
  },
  {
    id: "brilliant-catalyst",
    name: "Brilliant Catalyst",
    tier: "bronze",
    logo_url: "/sponsors/previous/brilliant-catalyst.webp",
    website_url: "https://www.ontariotechbrilliant.ca/",
  },
  {
    id: "featherless",
    name: "Featherless",
    tier: "bronze",
    logo_url: "/sponsors/previous/featherless.webp",
    website_url: "https://featherless.ai/",
  },
  {
    id: "adastra",
    name: "Adastra",
    tier: "bronze",
    logo_url: "/sponsors/previous/adastra.webp",
    website_url: "https://adastracorp.com/",
  },
];

// Painted by scripts/paint-forest.html; every layer is sunlit from the upper right.
const ART = {
  "oak-a": { width: 1100, height: 1300 },
  "oak-b": { width: 1000, height: 1000 },
  "pine-a": { width: 820, height: 1500 },
  "pine-b": { width: 640, height: 1100 },
};

// Framing trees, overlapping up into the tree wall; `depth` is parallax travel in
// px, negative for trees nearer than the panels. Right-hand trees are mirrored so
// the light always falls toward the clearing.
const TREES: {
  art: keyof typeof ART;
  side: "left" | "right";
  top: string;
  x: string;
  w: string;
  depth: number;
}[] = [
  { art: "oak-b", side: "right", top: "-13%", x: "-15rem", w: "38rem", depth: 30 },
  { art: "pine-a", side: "left", top: "-17%", x: "-9rem", w: "34rem", depth: 40 },
  { art: "oak-a", side: "left", top: "18%", x: "-19rem", w: "40rem", depth: -40 },
  { art: "pine-a", side: "right", top: "15%", x: "-10rem", w: "32rem", depth: 30 },
  { art: "pine-b", side: "left", top: "48%", x: "-8rem", w: "26rem", depth: 30 },
  { art: "oak-a", side: "right", top: "44%", x: "-19rem", w: "40rem", depth: -50 },
  { art: "oak-b", side: "left", top: "68%", x: "-17rem", w: "36rem", depth: -30 },
  { art: "pine-b", side: "right", top: "71%", x: "-7rem", w: "26rem", depth: 30 },
];

function Tree({ art, side, top, x, w, depth }: (typeof TREES)[number]) {
  return (
    <div
      className={`${styles.tree} ${styles[side]}`}
      style={{ "--top": top, "--x": x, "--w": w } as CSSProperties}
      data-depth={depth}
      data-lean
    >
      <Image
        src={`/sponsors/${art}.webp`}
        alt=""
        {...ART[art]}
        sizes={`calc(${w} * 0.9)`}
        data-sway
      />
    </div>
  );
}

const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: `${rand(i + 700) * 100}%`,
  top: `${4 + rand(i + 800) * 88}%`,
  "--size": `${3 + rand(i + 900) * 3}px`,
  animationDuration: `${7 + rand(i + 1000) * 6}s`,
  animationDelay: `-${rand(i + 1100) * 10}s`,
})) as CSSProperties[];

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.arrow}>
      <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
    </svg>
  );
}

// Faces +x, so it points the way it flies along a path.
function BeeBody() {
  return (
    <>
      <g className={styles.wings}>
        <path d="M26 15C22 5 12 1 7 4c-4 3 2 10 15 13z" />
        <path d="M29 15C28 6 23 0 18 1c-5 1-2 9 8 15z" />
      </g>
      <path
        d="M30 22C30 16 20 13 12 15 6 17 3 21 1 23c3 2 6 5 11 7 9 2 18-1 18-8z"
        fill="#e8a424"
      />
      <path
        d="M12.5 15.5q2.5 7 0 14M18 14.8q3 7.5 0 15.6M24 15.2q2.8 7 0 14.4"
        fill="none"
        stroke="#2a1a0a"
        strokeWidth="3"
      />
      <path
        d="M9 18.5q8-4 17-2.5"
        fill="none"
        stroke="#ffdf8a"
        strokeLinecap="round"
        strokeOpacity="0.65"
        strokeWidth="1.4"
      />
      <circle cx="33" cy="20" r="7.5" fill="#4a2c10" />
      <circle cx="33" cy="18.8" r="5.4" fill="#c98a1f" opacity="0.75" />
      <circle cx="41" cy="21.5" r="4.6" fill="#2a1a0a" />
      <circle cx="42.6" cy="20.4" r="1.1" fill="#ffe9b0" />
      <path d="M43 18q3-5 7-5" fill="none" stroke="#2a1a0a" />
    </>
  );
}

function Bee() {
  return (
    <svg viewBox="0 0 48 36" className={styles.bee}>
      <BeeBody />
    </svg>
  );
}

// Dotted flight trails across the sky, with bees looping along them.
const TRAILS = [
  "M-80 320C160 180 300 420 480 300C640 190 760 120 800 220C840 320 700 360 680 280C660 200 860 160 1000 240C1160 330 1300 200 1520 260",
  "M-80 110C120 160 240 70 420 130C640 200 760 80 960 140C1180 200 1300 40 1520 120",
];
const FLIGHTS = [
  { trail: 0, dur: 16, start: 0 },
  { trail: 0, dur: 16, start: 0.5 },
  { trail: 1, dur: 20, start: 0.25 },
];

function FlightPaths() {
  return (
    <svg
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMid slice"
      className={styles.flights}
      aria-hidden="true"
    >
      <mask
        id="sponsor-trail-reveal"
        maskUnits="userSpaceOnUse"
        x="-120"
        y="-20"
        width="1680"
        height="600"
      >
        {TRAILS.map((d, i) => (
          <path key={i} d={d} className={styles.trailReveal} data-draw />
        ))}
      </mask>
      <g mask="url(#sponsor-trail-reveal)">
        {TRAILS.map((d, i) => (
          <path
            key={i}
            id={`sponsor-trail-${i}`}
            d={d}
            className={styles.trail}
          />
        ))}
      </g>
      {FLIGHTS.map(({ trail, dur, start }, i) => (
        <g
          key={i}
          className={styles.flightBee}
          data-bee={trail}
          data-dur={dur}
          data-start={start}
        >
          <g transform="translate(-22 -17) scale(0.9)">
            <BeeBody />
          </g>
        </g>
      ))}
    </svg>
  );
}

function Tile({ sponsor }: { sponsor: Omit<Sponsor, "tier"> }) {
  const face = sponsor.logo_url ? (
    <img
      src={sponsor.logo_url}
      alt={sponsor.name}
      className={styles.logo}
      loading="lazy"
    />
  ) : (
    <span className={styles.wordmark}>{sponsor.name}</span>
  );
  if (!sponsor.website_url) return <div className={styles.tile}>{face}</div>;
  return (
    <a
      href={sponsor.website_url}
      target="_blank"
      rel="noreferrer"
      className={styles.tile}
    >
      {face}
      <span className={styles.visit} aria-hidden="true">
        Visit <Arrow />
      </span>
    </a>
  );
}

function Placeholder() {
  return (
    <div className={`${styles.tile} ${styles.placeholder}`}>Coming soon</div>
  );
}

// Ink label pinned over a panel, with a bee circling its end.
function Label({ children }: { children: string }) {
  return (
    <div className={styles.labelWrap}>
      <h3 className={styles.label}>{children}</h3>
      <span className={styles.orbit} aria-hidden="true">
        <span className={styles.orbitBee}>
          <Bee />
        </span>
      </span>
    </div>
  );
}

function TierGrid({
  label,
  columns,
  medal,
  sponsors,
}: {
  label: string;
  columns: number;
  medal: string;
  sponsors: Omit<Sponsor, "tier">[];
}) {
  const open = (columns - (sponsors.length % columns)) % columns;
  return (
    <div
      className={styles.tier}
      style={{ "--medal": medal, "--cols-wide": columns } as CSSProperties}
    >
      <h4 className={styles.tierTitle}>{label}</h4>
      <ul className={styles.grid}>
        {sponsors.map((sponsor) => (
          <li key={sponsor.id}>
            <Tile sponsor={sponsor} />
          </li>
        ))}
        {Array.from({ length: open }, (_, index) => (
          <li key={`open-${index}`}>
            <Placeholder />
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function SponsorsSection() {
  const sponsors = await getSponsors();
  const groups = sponsorGroups(sponsors);

  return (
    <ForestMotion className={styles.section}>
      {/* The sky sticks while .hold scrolls by, opening the hive in front of it. */}
      <div className={styles.stage} data-hive-stage>
        {/* Past the hold, so the nav link lands in the sky, not inside the hive. */}
        <span id="sponsors" className={`${styles.anchor} scroll-mt-16`} />

        {/* Evening sky over the treeline. */}
        <div className={styles.sky}>
          <FlightPaths />

          <header className={styles.intro}>
            {/* Past 1, so it fires once the sky has stuck and the hive is opening. */}
            <SplitText
              tag="h2"
              text="Sponsors"
              className={styles.title}
              delay={35}
              duration={1}
              threshold={1.45}
              rootMargin="0px"
            />
            <p className={styles.lead}>The teams making HackHive possible.</p>
          </header>

          <div className={styles.far} aria-hidden="true" data-depth="55">
            <Image
              src="/sponsors/far.webp"
              alt=""
              width={2600}
              height={460}
              sizes="max(100vw, 72rem)"
            />
          </div>
          <div className={styles.wall} aria-hidden="true" data-depth="28">
            <Image
              src="/sponsors/wall.webp"
              alt=""
              width={3000}
              height={1120}
              sizes="max(100vw, 72rem)"
            />
          </div>

          <div className={styles.hive} aria-hidden="true" data-hive>
            <div className={styles.hiveWall} data-hive-wall />
            <div className={styles.hiveRim} data-hive-rim />
          </div>
        </div>

        <div className={styles.hold} data-hold />
      </div>

      {/* In among the trees: wax panels in honeycomb frames. */}
      <div className={styles.woods}>
        <div className={styles.trees} aria-hidden="true">
          {TREES.map((tree) => (
            <Tree key={`${tree.side}-${tree.top}`} {...tree} />
          ))}
          {MOTES.map((style, i) => (
            <span key={i} className={styles.mote} style={style} />
          ))}
        </div>

        <div className={styles.boards}>
          <div className={styles.board} data-rise>
            <Label>Sponsor HackHive 2027</Label>
            <div className={styles.frame}>
              <div className={`${styles.panel} ${styles.pitch}`}>
                <p>
                  Our sponsors make it possible to bring hackers together at
                  Ontario Tech for a weekend of building. Put your team in front
                  of them, run a workshop, or meet your next intern.
                </p>
                <p className={styles.reach}>
                  Interested in partnering with us? Reach out at{" "}
                  <a href={SPONSOR_CONTACT}>{SPONSOR_EMAIL}</a>.
                </p>
                <a href={SPONSOR_CONTACT} className={styles.cta}>
                  Become a sponsor <Arrow />
                </a>
              </div>
            </div>
          </div>

          {/* <div className={styles.board} data-rise>
            <Label>Holding up the hive</Label>
            <div className={styles.frame}>
              <div className={styles.panel}>
                {groups.map(({ tier, ...group }) => (
                  <TierGrid key={tier} {...group} />
                ))}

                <p className={styles.more}>and more to come…</p>
              </div>
            </div>
          </div> */}

          <div className={styles.board} data-rise>
            <Label>Previous sponsors</Label>
            <div className={styles.frame}>
              <div className={styles.panel}>
                {PREVIOUS_TIERS.map(({ tier, label, columns, medal }) => (
                  <TierGrid
                    key={tier}
                    label={label}
                    columns={columns}
                    medal={medal}
                    sponsors={PREVIOUS_SPONSORS.filter(
                      (sponsor) => sponsor.tier === tier,
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.floor} aria-hidden="true" data-depth="-36">
          <Image
            src="/sponsors/floor.webp"
            alt=""
            width={3000}
            height={560}
            sizes="max(100vw, 72rem)"
          />
        </div>
      </div>
    </ForestMotion>
  );
}
