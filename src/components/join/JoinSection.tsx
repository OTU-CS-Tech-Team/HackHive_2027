"use client";

import { OakHiveScene } from "./OakHiveScene";
import { JoinHero, JoinHeroMobile, JoinCTAButtons } from "./JoinCard";

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
        Text glow overlay for readability over bright/moving backgrounds.
        Radial gradient centered on text area at ~0.45-0.55 opacity.
      */}
      <div 
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 45%, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.25) 40%, transparent 70%)`
        }}
      />

      {/* 
        TEXT HERO OVERLAY (Hack the North style)
        ========================================
        - Desktop/Tablet: Centered over the trunk hollow
        - Mobile: At the top, CTAs at bottom safe zone
        
        All CTAs are ≥48px tall for touch targets.
      */}

      {/* Desktop & Tablet (≥768px): Full hero centered */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center md:flex">
        <div className="pointer-events-auto">
          <JoinHero />
        </div>
      </div>

      {/* Mobile (<768px): Hero content at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-center pt-20 md:hidden">
        <div className="pointer-events-auto">
          <JoinHeroMobile />
        </div>
      </div>

      {/* Mobile (<768px): CTA safe zone at bottom */}
      <div 
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 bg-gradient-to-t from-black/50 via-black/25 to-transparent px-6 pt-16 md:hidden"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto w-full">
          <JoinCTAButtons />
        </div>
      </div>
    </section>
  );
}
