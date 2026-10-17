import { FaqSection } from "@/components/sections/FaqSection";
import { HackHive2025Section } from "@/components/sections/HackHive2025Section";
import { SponsorsSection } from "@/components/sections/SponsorsSection";
import { TeamSection } from "@/components/sections/teamSection";

export default function Home() {
  return (
    <main>
      <SponsorsSection />
      <HackHive2025Section />
      <FaqSection />
      <TeamSection />
    </main>
  );
}
