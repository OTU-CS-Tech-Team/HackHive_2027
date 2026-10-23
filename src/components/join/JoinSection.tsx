"use client";

import { OakHiveScene } from "./OakHiveScene";

export function JoinSection() {
  return (
    <section
      id="join"
      aria-label="Join HackHive 2027"
      className="relative min-h-screen w-full overflow-hidden"
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
        - Layout positions card in center-left on desktop, upper area on mobile
        - Lower area on mobile is kept clear for buttons that should NOT overlap the tree/hive
        
        CSS hooks available:
        - .join-card-slot: the positioning container
        - Mobile: card should be in upper portion, Join now button below the fold or at bottom
        - Desktop: card can overlay center-left area, tree is on right
      */}
      <div className="join-card-slot pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4 md:justify-start md:pl-12 lg:pl-24">
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
            The canvas leaves the center-left area open on desktop and upper half + bottom CTAs on mobile.
          */}
        </div>
      </div>

      {/* 
        Mobile CTA zone - guaranteed clear space at bottom for buttons
        Tabish: You can place the Join now / Learn more buttons here on mobile,
        or use this as a safety zone reference. This area is above the canvas z-index.
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-6 md:hidden">
        {/* 
          Tabish: Mobile CTAs go here if needed, e.g.:
          <Link href="/apply" className="pointer-events-auto w-full max-w-sm min-h-12 ...">Join now</Link>
          <Link href="#learn-more" className="pointer-events-auto min-h-12 ...">Learn more</Link>
        */}
      </div>
    </section>
  );
}
