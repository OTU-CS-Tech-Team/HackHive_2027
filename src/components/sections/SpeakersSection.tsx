import { getPeople, type Person } from "@/lib/content";
import { HoneycombGroup } from "./HoneycombGroup";
import { GavelRain } from "./GavelRain";
import styles from "./SpeakersSection.module.css";
// remove min judges and slice on line 28 to remove placeholders
const MIN_JUDGES =10; // try to avoid 13,11,9 or 6judges  if possible

function addPlaceholderJudges(people: Person[]) {
  const judges = people.filter((person) => person.role === "judge");
  const placeholders = Array.from(
    { length: Math.max(0, MIN_JUDGES - judges.length) },
    (_, index): Person => ({
      id: `placeholder-judge-${index + 1}`,
      name: `Judge ${judges.length + index + 1}`,
      role: "judge",
      title: null,
      company: null,
      bio: "Details coming soon.",
      photo_url: null,
      linkedin_url: null,
    }),
  );

  return [...people, ...placeholders];
}

export async function SpeakersSection() {
  const people = addPlaceholderJudges(await getPeople());
  const judges = people.filter((person) => person.role === "judge").slice(0, MIN_JUDGES);

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
