import { FaqSection } from "@/components/sections/FaqSection";
import { HackHive2025Section } from "@/components/sections/HackHive2025Section";
import { HeroSection } from "@/components/sections/HeroSection";
import { SpeakersSection } from "@/components/sections/SpeakersSection";
import { SponsorsSection } from "@/components/sections/SponsorsSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <SpeakersSection />
      <SponsorsSection />
      <HackHive2025Section />
      <FaqSection />
    </main>
  );
}
