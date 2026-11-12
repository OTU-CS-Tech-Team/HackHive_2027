import Link from "next/link";
import { HoneycombGroup } from "@/components/sections/HoneycombGroup";
import { MegaphoneBanner, MegaphoneRain } from "@/components/sections/Megaphone";
import styles from "@/components/sections/SpeakersSection.module.css";
import { getPeople } from "@/lib/content";

// Same values as the judges section on the home page.
// Extra rain-only height (px) added under the speakers. Raise for a taller rain area.
const RAIN_EXTRA = 5000;
// Pushes the banner + honeycomb down. Any CSS length.
const CONTENT_SHIFT = "15vh";

export default async function SpeakersPage() {
  const speakers = (await getPeople()).filter((person) => person.role === "speaker");
  const keynoteSpeakers = (await getPeople()).filter((person) => person.role === "keynote speaker");

  return (
    <main className={`${styles.section} ${styles.judgesPage}`}>
      <MegaphoneRain x={0.5} y={0.1} dim={0.65} />
      <div className={styles.stage}>
        <Link className={styles.backToHome} href="/#judges">
                ← Judges
        </Link>
        {/* spacer: shifts the banner and honeycomb down */}
        <div aria-hidden="true" style={{ height: CONTENT_SHIFT }} />
        <MegaphoneBanner
          title="Your Keynote Speakers"
          subtitle="Get to know the people opening and closing the weekend."
          ctaHref=""
        />
        <HoneycombGroup
          role="keynote speaker"
          heading=""
          blurb=""
          people={keynoteSpeakers}
        />
        <MegaphoneBanner
          title="Meet the speakers"
          subtitle="Get to know the people opening and closing the weekend."
          ctaHref=""
        />
        <HoneycombGroup
          role="speaker"
          heading=""
          blurb=""
          people={speakers}
        />
        {/* spacer: gives the rain canvas more height */}
        <div aria-hidden="true" style={{ height: RAIN_EXTRA }} />
      </div>
    </main>
  );
}