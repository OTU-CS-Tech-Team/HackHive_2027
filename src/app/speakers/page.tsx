import Link from "next/link";
import { HoneycombGroup } from "@/components/sections/HoneycombGroup";
import { MegaphoneBanner, MegaphoneRain } from "@/components/sections/Megaphone";
import styles from "@/components/sections/SpeakersSection.module.css";
import { getPeople } from "@/lib/content";

export default async function SpeakersPage() {
  const speakers = (await getPeople()).filter((person) => person.role === "speaker");

  return (
    <main className={`${styles.section} ${styles.judgesPage}`}>
      <MegaphoneRain x={0.5} y={0.5} dim={0.35} />
      <div className={styles.stage}>
        <Link className={styles.backToHome} href="/#judges">
          ← Judges
        </Link>
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
      </div>
    </main>
  );
}
