"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type RefObject } from "react";
import styles from "@/components/path/path.module.css";

function loadMeadowScene() {
  return import("@/components/landing/MeadowScene");
}

const MeadowScene = dynamic(loadMeadowScene, { ssr: false });

if (typeof window !== "undefined") {
  void loadMeadowScene();
}

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
  const [quality, setQuality] = useState<"low" | "high">("high");

  useEffect(() => {
    void loadMeadowScene();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setReducedMotion(reduce.matches);
      setQuality(mobile.matches ? "low" : "high");
    };
    sync();
    reduce.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <MeadowScene
        className="absolute inset-0"
        progress={progress}
        pointer={pointer}
        reducedMotion={reducedMotion}
        quality={quality}
        onReady={markReady}
      />
      <div className={styles.poster} data-hero-poster="" data-ready={ready ? "true" : "false"}>
        {poster ? (
          <picture>
            <source media="(max-width: 767px)" srcSet="/path/poster-phone.avif" type="image/avif" />
            <source media="(max-width: 767px)" srcSet="/path/poster-phone.webp" type="image/webp" />
            <source media="(max-width: 1023px)" srcSet="/path/poster-tablet.avif" type="image/avif" />
            <source media="(max-width: 1023px)" srcSet="/path/poster-tablet.webp" type="image/webp" />
            <source srcSet="/path/poster.avif" type="image/avif" />
            <source srcSet="/path/poster.webp" type="image/webp" />
            <img
              className={styles.posterImg}
              src="/path/poster.webp"
              alt=""
              width={1280}
              height={800}
              fetchPriority="high"
            />
          </picture>
        ) : (
          <div className={styles.posterFallback} />
        )}
      </div>
    </div>
  );
}
