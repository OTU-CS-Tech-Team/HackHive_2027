"use client";

import { OakHiveScene } from "./OakHiveScene";

export function JoinSection() {
  return (
    <section
      id="join"
      aria-label="Join HackHive 2027"
      className="relative w-full overflow-hidden"
      style={{ 
        minHeight: "calc(100svh + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Still oak plate, with a wind shader over it when WebGL is available. */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          minHeight: "calc(100svh + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <OakHiveScene />
      </div>

      {/* 
        SLOT FOR TABISH'S FROSTED JOIN CARD (PR #11)
        =============================================
        The card will be placed inside this container.
        - z-10 ensures it sits above the backdrop canvas
        - pointer-events-auto on the card itself ensures buttons are tappable
        
        DESKTOP FRAMING:
        - The backdrop shows trunk hollow centered at about 50-60% from left
        - Tabish's card will be centered over the hollow (around 60-66% from left)
        - This slot is neutral (no forced alignment) so #11 can position as needed
        
        MOBILE FRAMING:
        - Card at top of viewport
        - Trunk and hive in lower portion of frame
        - Bottom area available for Join now / Learn more buttons
        
        TABLET FRAMING:
        - Portrait uses mobile art/layout
        - Landscape uses desktop art/layout
      */}
      <div className="join-card-slot pointer-events-none absolute inset-0 z-10">
        {/* Tabish: Insert your frosted Join card component here with its own positioning */}
      </div>
    </section>
  );
}
