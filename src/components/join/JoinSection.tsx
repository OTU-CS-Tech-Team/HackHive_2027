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
        Softer, wider, warmer (dark amber/brown tint) with gentle falloff.
      */}
      <div 
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: `radial-gradient(ellipse 120% 90% at 50% 45%, rgba(60,40,20,0.35) 0%, rgba(40,25,10,0.18) 35%, rgba(30,20,10,0.08) 55%, transparent 75%)`
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
