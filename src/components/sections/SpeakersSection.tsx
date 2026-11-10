import { getPeople } from "@/lib/content";
import { HoneycombGroup } from "./HoneycombGroup";
import { GavelRain } from "./GavelRain";
import { MegaphoneBanner } from "./Megaphone";
import styles from "./SpeakersSection.module.css";
import { CodeToRain } from "./CodeToRain";


// to add new people images to judges or speakers add them into public\Images\"FirstName_LastName.png"

// Extra rain-only height (px) added under the judges. Raise for a taller rain area.
const RAIN_EXTRA = 100;
// Pushes the banner + honeycomb down so they start a bit below the rain area's halfway point.
// Any CSS length. Raise for lower, lower for higher.
const CONTENT_SHIFT = "35vh";

export async function SpeakersSection() {
  const people = await getPeople();
  const judges = people.filter((person) => person.role === "judge");

      return (
    <div id="judges" className="scroll-mt-16">
      {/* Pinned scroll animation lives OUTSIDE the padded/clipped section so
          position: sticky works. When the shatter finishes, the judges section below slides
          up over it and fades in. */}
      <CodeToRain />
      <section className={`${styles.section} ${styles.judgesSection}`}>
        {/* The one and only gavel rain */}
        <GavelRain extend={RAIN_EXTRA} />
        {/* spacer: shifts the banner and honeycomb down */}
        <div aria-hidden="true" style={{ height: CONTENT_SHIFT }} />
        <div className={styles.stage}>
          <MegaphoneBanner
            icon="hammer-gavel"
            title="Meet the judges"
            subtitle="Get to know the people scoring every project at demo time."
            ctaHref=""
          />
          <HoneycombGroup
            role="judge"
            heading=""
            blurb=""
            people={judges}
            moreHref="/speakers"
          />
        </div>
        {/* spacer: gives the rain canvas more height without moving the content or the gavel */}
        <div aria-hidden="true" style={{ height: RAIN_EXTRA }} />
      </section>
    </div>
  );
}