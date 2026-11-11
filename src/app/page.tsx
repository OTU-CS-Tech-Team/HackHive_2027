import { existsSync } from "node:fs";
import path from "node:path";
import { preload } from "react-dom";
import { Suspense } from "react";
import { HeroCta, HeroCtaFallback } from "@/components/landing/HeroCta";
import { HeroScroll } from "@/components/landing/HeroScroll";
import { IntroOverlay } from "@/components/landing/intro/IntroOverlay";
import { CombEdge } from "@/components/sections/CombEdge";
import { FaqSection } from "@/components/sections/FaqSection";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SpeakersSection } from "@/components/sections/SpeakersSection";
import { SponsorsSection } from "@/components/sections/SponsorsSection";

const HAS_POSTER = existsSync(path.join(process.cwd(), "public/path/poster.webp"));

export default function Home() {
  if (HAS_POSTER) {
    preload("/path/poster.avif", {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
      media: "(min-width: 1024px)",
    });
    preload("/path/poster-tablet.avif", {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
      media: "(max-width: 1023px) and (min-width: 768px)",
    });
    preload("/path/poster-phone.avif", {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
      media: "(max-width: 767px)",
    });
  }

  return (
    <main>
      <IntroOverlay />
      <HeroScroll poster={HAS_POSTER}>
        <Suspense fallback={<HeroCtaFallback />}>
          <HeroCta />
        </Suspense>
      </HeroScroll>
      <SponsorsSection />
      <CombEdge colour="#14110b" tip="#0b2419" seed={500} />
      <SpeakersSection />
      <div className="relative max-sm:[&>#faq]:pb-[8.5rem]!">
        <FaqSection />
        <SiteFooter />
      </div>
    </main>
  );
}
