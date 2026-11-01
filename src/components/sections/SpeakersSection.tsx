import { getPeople } from "@/lib/content";
import { HoneycombGroup } from "./HoneycombGroup";
import { GavelRain } from "./GavelRain";
import { MegaphoneBanner } from "./Megaphone";
import styles from "./SpeakersSection.module.css";


// to add new people images to judges or speakers add them into public\Images\"FirstName_LastName.png"

export async function SpeakersSection() {
  const people = await getPeople();
  const judges = people.filter((person) => person.role === "judge");

      return (
    <section id="judges" className={`${styles.section} ${styles.judgesSection} scroll-mt-16`}>
      <GavelRain />
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
    </section>
  );
}
