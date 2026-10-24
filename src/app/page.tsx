import { FaqSection } from "@/components/sections/FaqSection";
import { HackHive2025Section } from "@/components/sections/HackHive2025Section";
import { JoinSection } from "@/components/join/JoinSection";
import { SpeakersSection } from "@/components/sections/SpeakersSection";
import { SponsorsSection } from "@/components/sections/SponsorsSection";

export default function Home() {
  return (
    <main>
      <JoinSection />
      <SpeakersSection />
      <SponsorsSection />
      <HackHive2025Section />
      <FaqSection />
    </main>
  );
}
