import { HackHive2025Section } from "@/components/sections/HackHive2025Section";
import { ScheduleSection } from "@/components/sections/ScheduleSection";
import { SpeakersSection } from "@/components/sections/SpeakersSection";
import { SponsorsSection } from "@/components/sections/SponsorsSection";
import { PATH_CHAPTERS } from "@/components/path/chapters";
import { PathScroll } from "@/components/path/PathScroll";
import {
  AboutPanel,
  HivePanel,
  ReadingPanel,
  StreamPanel,
  TracksPanel,
  TrailheadPanel,
} from "@/components/path/panels";

export default function Home() {
  return (
    <main>
      <PathScroll chapters={PATH_CHAPTERS}>
        <TrailheadPanel />
        <AboutPanel />
        <TracksPanel />
        <ReadingPanel kicker="Under the old oak">
          <ScheduleSection />
        </ReadingPanel>
        <StreamPanel />
        <ReadingPanel kicker="Along the fence" frame="sponsor">
          <SponsorsSection />
        </ReadingPanel>
        <HivePanel />
      </PathScroll>
      <div className="h-24 bg-gradient-to-b from-[#c44e3a] to-[#14110b]" aria-hidden="true" />
      <SpeakersSection />
      <HackHive2025Section />
    </main>
  );
}
