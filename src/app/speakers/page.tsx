import Link from "next/link";
import { HoneycombGroup } from "@/components/sections/HoneycombGroup";
import styles from "@/components/sections/SpeakersSection.module.css";
import { getPeople } from "@/lib/content";

export default async function SpeakersPage() {
  const speakers = (await getPeople()).filter((person) => person.role === "speaker");

  return (
    <main className={`${styles.section} ${styles.judgesPage}`}>
      <div className={styles.stage}>
        <Link className={styles.backToHome} href="/#judges">
          ← Judges
        </Link>
        <h1 className={styles.title}>All Speakers</h1>
        <HoneycombGroup
          role="speaker"
          heading="Meet the speakers"
          blurb="The people opening and closing the weekend."
          people={speakers}
        />
      </div>
    </main>
  );
}
