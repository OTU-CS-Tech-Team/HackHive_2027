import { getPeople } from "@/lib/content";
import { HoneycombGroup } from "./HoneycombGroup";
import { GavelRain } from "./GavelRain";
import { MegaphoneBanner } from "./Megaphone";
import styles from "./SpeakersSection.module.css";




export async function SpeakersSection() {
  const people = await getPeople();
  const judges = people.filter((person) => person.role === "judge");

      return (
    <section id="judges" className={`${styles.section} scroll-mt-16`}>
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
