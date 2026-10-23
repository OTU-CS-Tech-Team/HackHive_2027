"use client";

import { OakHiveScene } from "./OakHiveScene";

export function JoinSection() {
  return (
    <section
      id="join"
      aria-label="Join HackHive 2027"
      className="relative w-full overflow-hidden"
      style={{ minHeight: "100svh" }}
    >
      {/* Three.js Canvas Background */}
      <div className="absolute inset-0 z-0">
        <OakHiveScene />
      </div>

      {/* 
        SLOT FOR TABISH'S FROSTED JOIN CARD
        ====================================
        The card should be placed inside this container.
        - z-10 ensures it sits above the canvas
        - pointer-events-auto on the card itself ensures buttons are tappable
        - Layout positions card in center-left on desktop, upper-left area on mobile/tablet
        - Mobile/Tablet: tree is on RIGHT side of viewport; LEFT side is clear for the card
        - Bottom area on mobile is kept clear for Join now / Learn more buttons
        
        CSS hooks available:
        - .join-card-slot: the positioning container
        - Mobile (~390px): card in upper-left, tree on right, bottom clear for CTAs
        - Tablet (~768px): card on left, tree/hive on right (fully visible)
        - Desktop: card can overlay center-left area, tree is on right
      */}
      <div className="join-card-slot pointer-events-none absolute inset-0 z-10 flex items-start justify-start px-4 pt-20 md:items-center md:justify-start md:pt-0 md:pl-12 lg:pl-24">
        <div className="pointer-events-auto w-full max-w-md">
          {/* 
            Tabish: Insert your frosted Join card component here.
            Example structure:
            
            <div className="rounded-2xl bg-white/80 backdrop-blur-md p-8 shadow-lg">
              <p className="text-sm font-medium text-amber-700">MLH Official Member</p>
              <h2 className="text-3xl font-bold text-neutral-900">HackHive 2027</h2>
              <p className="text-neutral-600">March 14-15 2027</p>
              <p className="text-neutral-700">Join as a hacker</p>
              <Link href="/apply" className="...">Join now</Link>
              <Link href="#learn-more" className="...">Learn more</Link>
            </div>
            
            On mobile (~390px), position buttons at bottom with min-h-12 (48px) touch targets.
            The canvas leaves the LEFT side open on mobile/tablet and center-left on desktop.
          */}
        </div>
      </div>

      {/* 
        Mobile CTA zone - guaranteed clear space at bottom for buttons
        Tabish: You can place the Join now / Learn more buttons here on mobile,
        or use this as a safety zone reference. This area is above the canvas z-index.
        The canvas tree is positioned to the RIGHT, so this bottom area stays clear.
        Uses padding to stay above mobile browser chrome (with svh on parent).
      */}
      <div 
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-6 md:hidden"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* 
          Tabish: Mobile CTAs go here if needed, e.g.:
          <Link href="/apply" className="pointer-events-auto w-full max-w-sm min-h-12 ...">Join now</Link>
          <Link href="#learn-more" className="pointer-events-auto min-h-12 ...">Learn more</Link>
        */}
      </div>
    </section>
  );
}
