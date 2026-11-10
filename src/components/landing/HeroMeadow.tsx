"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type RefObject } from "react";

const MeadowScene = dynamic(() => import("@/components/landing/MeadowScene"), {
  ssr: false,
});

const FALLBACK =
  "linear-gradient(180deg, #d7eef8 0%, #f4e4b4 40%, #b7d57a 72%, #8fbe58 100%)";

export function HeroMeadow({
  progress,
  pointer,
  poster,
}: {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  poster: boolean;
}) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    return () => reduce.removeEventListener("change", sync);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <MeadowScene
        className="absolute inset-0"
        progress={progress}
        pointer={pointer}
        reducedMotion={reducedMotion}
        onReady={markReady}
      />
      <div
        className={`absolute inset-0 ${ready ? "opacity-0" : "opacity-100"} ${reducedMotion ? "" : "transition-opacity duration-700"}`}
        style={{
          backgroundColor: "#d7eef8",
          backgroundImage: poster ? `url(/path/poster.webp), ${FALLBACK}` : FALLBACK,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </div>
  );
}
