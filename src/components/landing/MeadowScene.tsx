"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * STUB for Jiwoo's Three.js meadow. This file must not import three.
 * Replace the whole component; keep the props. One warm light, no sunset shift.
 * `progress` is only the hero walk and is 1 at the hand-off into chapter 2.
 * The scene pauses while it is off screen so a later render loop can stop with it.
 */
export type MeadowSceneProps = {
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reducedMotion?: boolean;
  quality?: "low" | "high";
  onReady?: () => void;
  className?: string;
};

export default function MeadowScene({
  progress,
  pointer,
  reducedMotion = false,
  quality = "high",
  onReady,
  className,
}: MeadowSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      pausedRef.current = entry ? !entry.isIntersecting : true;
    });
    observer.observe(el);
    onReady?.();
    return () => observer.disconnect();
  }, [onReady, pointer, progress]);

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 ${className ?? ""}`}
      data-meadow-stub=""
      data-quality={quality}
      data-reduced={reducedMotion ? "true" : "false"}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#d7eef8_0%,#f4e4b4_40%,#b7d57a_72%,#8fbe58_100%)]" />
    </div>
  );
}
