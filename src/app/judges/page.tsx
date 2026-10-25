import Link from "next/link";
import { HoneycombGroup } from "@/components/sections/HoneycombGroup";
import styles from "@/components/sections/SpeakersSection.module.css";
import { getPeople } from "@/lib/content";

export default async function JudgesPage() {
  const judges = (await getPeople()).filter((person) => person.role === "judge");

  return (
    <main className={`${styles.section} ${styles.judgesPage}`}>
      <div className={styles.stage}>
        <Link className={styles.backToHome} href="/#speakers">
          ← Speakers &amp; Judges
        </Link>
        <h1 className={styles.title}>All Judges</h1>
        <HoneycombGroup
          role="judge"
          heading="Meet the judges"
          blurb="The people scoring every project at demo time."
          people={judges}
        />
      </div>
    </main>
  );
}
