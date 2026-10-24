import { getPeople, type Person } from "@/lib/content";
import { HoneycombGroup } from "./HoneycombGroup";
import styles from "./SpeakersSection.module.css";

const GROUPS: { role: Person["role"]; heading: string; blurb: string }[] = [
  { role: "speaker", heading: "Keynote speakers", blurb: "The people opening and closing the weekend." },
  { role: "judge", heading: "Judges", blurb: "They score every project at demo time." },
];

const MIN_JUDGES = 10;

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

  return (
    <section id="speakers" className={`${styles.section} scroll-mt-16`}>
      <div className={styles.stage}>
        <h2 className={styles.title}>Speakers &amp; Judges</h2>

        {GROUPS.map(({ role, heading, blurb }) => {
          const rolePeople = people.filter((person) => person.role === role);
          const group = role === "judge" ? rolePeople.slice(0, MIN_JUDGES) : rolePeople;
          return (
            <HoneycombGroup
              key={role}
              role={role}
              heading={heading}
              blurb={blurb}
              people={group}
              moreHref={role === "judge" ? "/judges" : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
