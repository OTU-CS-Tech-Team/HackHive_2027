/* eslint-disable @next/next/no-img-element -- logos come from Supabase Storage */
import type { CSSProperties } from "react";
import Image from "next/image";
import SplitText from "@/components/SplitText";
import type { Sponsor } from "@/lib/content";
import { rand } from "./comb";
import { ForestMotion } from "./ForestMotion";
import styles from "./SponsorsSection.module.css";

// TODO: real sponsorship inbox.
const SPONSOR_EMAIL = "otu.csclub@gmail.com";
const SPONSOR_CONTACT = `mailto:${SPONSOR_EMAIL}?subject=Sponsoring%20HackHive%202027`;

// Last HackHive's line-up, which has a diamond tier the /admin list doesn't.
const PREVIOUS_TIERS = [
  {
    tier: "diamond",
    label: "Diamond sponsors",
    columns: 3,
    medal: "/sponsors/tiers/diamond.webp",
  },
  {
    tier: "gold",
    label: "Gold sponsors",
    columns: 3,
    medal: "/sponsors/tiers/gold.webp",
  },
  {
    tier: "silver",
    label: "Silver sponsors",
    columns: 3,
    medal: "/sponsors/tiers/silver.webp",
  },
  {
    tier: "bronze",
    label: "Bronze sponsors",
    columns: 4,
    medal: "/sponsors/tiers/bronze.webp",
  },
] as const;

const PREVIOUS_SPONSORS: (Omit<Sponsor, "tier"> & {
  tier: (typeof PREVIOUS_TIERS)[number]["tier"];
})[] = [
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
// px. All of them stand behind the panels, so the further back, the bigger the
// depth. Right-hand trees are mirrored so the light always falls toward the clearing.
const TREES: {
  art: keyof typeof ART;
  side: "left" | "right";
  top: string;
  x: string;
  w: string;
  depth: number;
}[] = [
  {
    art: "oak-b",
    side: "right",
    top: "-13%",
    x: "-15rem",
    w: "38rem",
    depth: 90,
  },
  {
    art: "pine-a",
    side: "left",
    top: "-17%",
    x: "-9rem",
    w: "34rem",
    depth: 70,
  },
  {
    art: "oak-a",
    side: "left",
    top: "18%",
    x: "-19rem",
    w: "40rem",
    depth: 60,
  },
  {
    art: "pine-a",
    side: "right",
    top: "15%",
    x: "-10rem",
    w: "32rem",
    depth: 110,
  },
  {
    art: "pine-b",
    side: "left",
    top: "48%",
    x: "-8rem",
    w: "26rem",
    depth: 130,
  },
  {
    art: "oak-a",
    side: "right",
    top: "44%",
    x: "-19rem",
    w: "40rem",
    depth: 60,
  },
  {
    art: "oak-b",
    side: "left",
    top: "68%",
    x: "-17rem",
    w: "36rem",
    depth: 100,
  },
  {
    art: "pine-b",
    side: "right",
    top: "71%",
    x: "-7rem",
    w: "26rem",
    depth: 130,
  },
];

const PANORAMA_SIZES = "(max-width: 56.25rem) 100vw, max(100vw, 72rem, 200vh)";
/* The ground is drawn wider than the viewport so the fade stays tall. Cap the
   slot so a phone still takes the 1600w file, not the full painting. */
const GROUND_SIZES = "(max-width: 64rem) 800px, 1200px";

function Panorama({
  name,
  width,
  height,
}: {
  name: "far" | "wall" | "floor";
  width: number;
  height: number;
}) {
  return (
    <img
      src={`/sponsors/${name}.webp`}
      srcSet={`/sponsors/${name}-960.webp 960w, /sponsors/${name}-1600.webp 1600w, /sponsors/${name}.webp ${width}w`}
      sizes={name === "floor" ? GROUND_SIZES : PANORAMA_SIZES}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  );
}

function Tree({ art, side, top, x, w, depth }: (typeof TREES)[number]) {
  return (
    <div
      className={`${styles.tree} ${styles[side]}`}
      style={
        { "--top": top, "--x": x, "--w": w, "--depth": depth } as CSSProperties
      }
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

function Label({ children }: { children: string }) {
  return (
    <div className={styles.labelWrap}>
      <h3 className={styles.label}>{children}</h3>
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
  const open = sponsors.length === 0 ? columns : 0;
  return (
    <div
      className={styles.tier}
      style={{ "--cols-wide": columns } as CSSProperties}
    >
      <h4 className={styles.tierTitle}>
        <img src={medal} alt="" className={styles.medal} />
        {label}
      </h4>
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

export function SponsorsSection() {
  return (
    <ForestMotion className={styles.section}>
      {/* White hero lifts into the honey-lit sky. */}
      <div className={styles.dawn} aria-hidden="true" />

      {/* The sky sticks while .hold scrolls by, opening the hive in front of it. */}
      <div className={styles.stage} data-hive-stage>
        {/* Past the hold, so the nav link lands in the sky, not inside the hive. */}
        <span id="sponsors" className={`${styles.anchor} scroll-mt-16`} />

        {/* Evening sky over the treeline. */}
        <div className={styles.sky}>
          <header className={styles.intro} data-drift>
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

          <div className={styles.far} aria-hidden="true">
            <Panorama name="far" width={2600} height={460} />
          </div>
          <div className={styles.wall} aria-hidden="true">
            <Panorama name="wall" width={3000} height={1120} />
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
                  Put your team in front of hackers, host a workshop, or meet
                  your next intern while helping bring Ontario Tech’s builders
                  together.
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

        <div className={styles.floor} aria-hidden="true">
          <Panorama name="floor" width={3000} height={383} />
        </div>
      </div>
    </ForestMotion>
  );
}
