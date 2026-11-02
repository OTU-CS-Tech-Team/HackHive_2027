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

function Tile({ sponsor }: { sponsor: Sponsor }) {
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

          <div className={styles.board} data-rise>
            <Label>Holding up the hive</Label>
            <div className={styles.frame}>
              <div className={styles.panel}>
                {groups.map(({ tier, label, columns, medal, sponsors: inTier }) => {
                  const open = (columns - (inTier.length % columns)) % columns;
                  return (
                    <div
                      key={tier}
                      className={styles.tier}
                      style={
                        {
                          "--medal": medal,
                          "--cols-wide": columns,
                        } as CSSProperties
                      }
                    >
                      <h4 className={styles.tierTitle}>{label}</h4>
                      <ul className={styles.grid}>
                        {inTier.map((sponsor) => (
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
                })}

                <p className={styles.more}>and more to come…</p>
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
