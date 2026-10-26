import { getPeople } from "@/lib/content";
import { HoneycombGroup } from "./HoneycombGroup";
import { GavelRain } from "./GavelRain";
import styles from "./SpeakersSection.module.css";




export async function SpeakersSection() {
  const people = await getPeople();
  const judges = people.filter((person) => person.role === "judge");

      return (
    <section id="judges" className={`${styles.section} scroll-mt-16`}>
      <GavelRain />
      <div className={styles.stage}>
        <h2 className={styles.title}>Judges</h2>
        <HoneycombGroup
          role="judge"
          heading="Meet the judges"
          blurb="They score every project at demo time."
          people={judges}
          moreHref="/speakers"
        />
      </div>
    </section>
  );
}
