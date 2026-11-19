import { Caveat, JetBrains_Mono, VT323 } from "next/font/google";
import { ABOUT_INTRO, ABOUT_PROJECTS, ABOUT_STATS, ARCHIVE_PAGE } from "@/lib/about";
import { cn } from "@/lib/utils";
import { AsciiField } from "./AsciiField";
import { HackTransition } from "./HackTransition";
import { ProjectsSequence } from "./ProjectsSequence";
import { StatsSequence } from "./StatsSequence";
import { blockLetters } from "./ascii";
import styles from "./about.module.css";

// The ASCII art face (canvases and the block-letter title): a mono whose glyphs fill their cells,
// so small art reads as characters. Read by the canvases as var(--font-ascii).
const ascii = JetBrains_Mono({
  weight: "500",
  subsets: ["latin"],
  variable: "--font-ascii",
  display: "swap",
});

// Terminal numerals for the big stat numbers.
const numeral = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-numeral",
  display: "swap",
});

// Polaroid captions, written on in marker.
const hand = Caveat({
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
  preload: false,
});

const WIDE = blockLetters("HACK HIVE");
const HACK = blockLetters("HACK");
const HIVE = blockLetters("HIVE");
const BLANK = " ".repeat(HACK.fill[0].length);
const TITLE_WIDE = { fill: WIDE.fill.join("\n"), shade: WIDE.shade.join("\n") };
// HACK over HIVE, with a blank line between
const TITLE_STACKED = {
  fill: [...HACK.fill, BLANK, ...HIVE.fill].join("\n"),
  shade: [...HACK.shade, BLANK, ...HIVE.shade].join("\n"),
};
const RULE = "- ".repeat(120);

/** The block letters: the shadow layer underneath (fades in), the letters on top (decrypt). */
function TitleArt({ art, className }: { art: { fill: string; shade: string }; className: string }) {
  return (
    <span className={cn(styles.titleArt, className)} aria-hidden="true">
      <span className={styles.titleShade} data-hack-after="">
        {art.shade}
      </span>
      <span className={styles.titleFill} data-hack-title="">
        {art.fill}
      </span>
    </span>
  );
}

/**
 * "HackHive": the hero gets hacked into ASCII, the title decrypts, then the year in
 * numbers and projects from 2026 step down the page on an ink night, over a faint ASCII
 * meadow that brightens into Sponsors' sunrise at the bottom.
 */
export function AboutSection() {
  return (
    <section aria-labelledby="about-title" className={cn(styles.section, ascii.variable, numeral.variable, hand.variable)}>
      <AsciiField />

      <HackTransition>
        <div className={cn(styles.titleBlock, styles.quiet)}>
          <h2 id="about-title" className={styles.title}>
            <span className="sr-only">HackHive</span>
            <TitleArt art={TITLE_WIDE} className={styles.titleWide} />
            <TitleArt art={TITLE_STACKED} className={styles.titleStacked} />
          </h2>
          <div className={styles.intro} data-hack-after="">
            {ABOUT_INTRO.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </HackTransition>

      <div className={styles.body}>
        <div className={styles.rule} aria-hidden="true">
          {RULE}
        </div>

        <StatsSequence stats={ABOUT_STATS} />

        <ProjectsSequence projects={ABOUT_PROJECTS} archiveHref={ARCHIVE_PAGE} />
      </div>
    </section>
  );
}
