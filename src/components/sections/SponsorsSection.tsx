/* eslint-disable @next/next/no-img-element -- logos come from Supabase Storage */
import type { CSSProperties } from "react";
import { getSponsors, type Sponsor } from "@/lib/content";
import styles from "./SponsorsSection.module.css";

// TODO: real sponsorship inbox.
const SPONSOR_EMAIL = "sponsors@example.com";
const SPONSOR_CONTACT = `mailto:${SPONSOR_EMAIL}?subject=Sponsoring%20HackHive%202027`;

// Bigger tiers get wider tiles; each row is filled out with placeholder cells.
const TIERS = [
  { tier: "gold", label: "Gold sponsors", columns: 1 },
  { tier: "silver", label: "Silver sponsors", columns: 2 },
  { tier: "bronze", label: "Bronze sponsors", columns: 3 },
] as const;

// Deterministic noise so the mote positions never change between renders.
const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: `${rand(i + 700) * 100}%`,
  top: `${15 + rand(i + 800) * 70}%`,
  "--size": `${3 + rand(i + 900) * 3}px`,
  animationDuration: `${7 + rand(i + 1000) * 6}s`,
  animationDelay: `-${rand(i + 1100) * 10}s`,
})) as CSSProperties[];

function Forest() {
  return (
    <div className={styles.forest} aria-hidden="true">
      {MOTES.map((style, i) => (
        <span key={i} className={styles.mote} style={style} />
      ))}
    </div>
  );
}

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
        <ellipse cx="19" cy="10" rx="8" ry="5" transform="rotate(-25 19 10)" />
        <ellipse cx="27" cy="9" rx="8" ry="5" transform="rotate(15 27 9)" />
      </g>
      <ellipse cx="24" cy="22" rx="14" ry="10" fill="#f5b83d" />
      <path d="M19 12.7v18.6M27 12.2v19.6" stroke="#14110b" strokeWidth="4" />
      <path d="M10.5 20.5 4 22l6.5 1.5z" fill="#14110b" />
      <circle cx="33.5" cy="19" r="1.8" fill="#14110b" />
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
  "M1520 120C1300 40 1180 200 960 140C760 80 640 200 420 130C240 70 120 160-80 110",
];
const FLIGHTS = [
  { trail: 0, dur: 16, begin: 0 },
  { trail: 0, dur: 16, begin: -8 },
  { trail: 1, dur: 20, begin: -5 },
];

function FlightPaths() {
  return (
    <svg
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMid slice"
      className={styles.flights}
      aria-hidden="true"
    >
      {TRAILS.map((d, i) => (
        <path
          key={i}
          id={`sponsor-trail-${i}`}
          d={d}
          className={styles.trail}
        />
      ))}
      {FLIGHTS.map(({ trail, dur, begin }, i) => (
        <g key={i} className={styles.flightBee}>
          <animateMotion
            dur={`${dur}s`}
            begin={`${begin}s`}
            repeatCount="indefinite"
            rotate="auto"
          >
            <mpath href={`#sponsor-trail-${trail}`} />
          </animateMotion>
          <g transform="translate(-26 -20) scale(1.1)">
            <BeeBody />
          </g>
        </g>
      ))}
    </svg>
  );
}

function Tile({ sponsor }: { sponsor: Sponsor }) {
  const face = sponsor.logo_url ? (
    <img src={sponsor.logo_url} alt={sponsor.name} className={styles.logo} />
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

export async function SponsorsSection() {
  const sponsors = await getSponsors();

  return (
    <section data-sponsors-yard="" className={styles.section}>
      {/* Dusk from the section above brightens into the honey-lit sky. */}
      <div className={styles.dawn} aria-hidden="true" />

      {/* A clearing in the woods: heading, then wax panels in honeycomb frames. */}
      <div className={styles.yard}>
        <Forest />
        <FlightPaths />

        <header className={styles.intro}>
          <h2 className={styles.title}>Sponsors</h2>
          <p className={styles.lead}>The teams making HackHive possible.</p>
        </header>

        <div className={styles.boards}>
          <div className={styles.board}>
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

          <div className={styles.board}>
            <Label>Holding up the hive</Label>
            <div className={styles.frame}>
              <div className={styles.panel}>
                {TIERS.map(({ tier, label, columns }) => {
                  const inTier = sponsors.filter(
                    (sponsor) => sponsor.tier === tier,
                  );
                  const open = inTier.length
                    ? (columns - (inTier.length % columns)) % columns
                    : columns;
                  return (
                    <div key={tier} className={styles[tier]}>
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
      </div>
    </section>
  );
}
