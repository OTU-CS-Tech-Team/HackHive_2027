import { existsSync } from "node:fs";
import path from "node:path";
import { HeroScroll } from "@/components/landing/HeroScroll";
import { CombEdge } from "@/components/sections/CombEdge";
import { FaqSection } from "@/components/sections/FaqSection";
import { HackHive2025Section } from "@/components/sections/HackHive2025Section";
import { SpeakersSection } from "@/components/sections/SpeakersSection";
import { SponsorsSection } from "@/components/sections/SponsorsSection";

const HAS_POSTER = existsSync(path.join(process.cwd(), "public/path/poster.webp"));

export default function Home() {
  return (
    <main>
      <HeroScroll poster={HAS_POSTER} />
      <SponsorsSection />
      <CombEdge colour="#14110b" tip="#0b2419" seed={500} />
      <SpeakersSection />
      <HackHive2025Section />
      <FaqSection />
    </main>
  );
}
