"use client";

import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import dynamic from "next/dynamic";

const WindCanvas = dynamic(
  () => import("./WindCanvas").then((mod) => mod.WindCanvas),
  { ssr: false },
);

class CanvasErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

type WindWindow = Window & { __SKIP_WEBGL_PREFLIGHT__?: boolean };

function canCreateWebGLContext(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as WindWindow).__SKIP_WEBGL_PREFLIGHT__) return true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function checkShouldUseFallback(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if ("connection" in navigator) {
      const conn = navigator.connection as { saveData?: boolean; effectiveType?: string };
      if (conn.saveData) return true;
      if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
    }
    const memory = (navigator as { deviceMemory?: number }).deviceMemory;
    if (memory !== undefined && memory < 2) return true;
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === "number" && cores > 0 && cores <= 2) return true;
  } catch {
    return true;
  }
  return false;
}

function BackdropImage({ imgRef }: { imgRef: RefObject<HTMLImageElement | null> }) {
  return (
    <picture className="absolute inset-0 h-full w-full">
      <source
        media="(max-width: 767px), (max-width: 1024px) and (orientation: portrait)"
        type="image/avif"
        srcSet="/join/backdrop-mobile-640w.avif 640w, /join/backdrop-mobile-1024w.avif 1024w, /join/backdrop-mobile-1600w.avif 1600w"
        sizes="100vw"
      />
      <source
        media="(max-width: 767px), (max-width: 1024px) and (orientation: portrait)"
        type="image/webp"
        srcSet="/join/backdrop-mobile-640w.webp 640w, /join/backdrop-mobile-1024w.webp 1024w, /join/backdrop-mobile-1600w.webp 1600w"
        sizes="100vw"
      />
      <source
        media="(min-width: 768px)"
        type="image/avif"
        srcSet="/join/backdrop-desktop-640w.avif 640w, /join/backdrop-desktop-1024w.avif 1024w, /join/backdrop-desktop-1600w.avif 1600w, /join/backdrop-desktop-2400w.avif 2400w"
        sizes="100vw"
      />
      <source
        media="(min-width: 768px)"
        type="image/webp"
        srcSet="/join/backdrop-desktop-640w.webp 640w, /join/backdrop-desktop-1024w.webp 1024w, /join/backdrop-desktop-1600w.webp 1600w, /join/backdrop-desktop-2400w.webp 2400w"
        sizes="100vw"
      />
      <img
        ref={imgRef}
        src="/join/backdrop-desktop.jpg"
        alt=""
        className="backdrop-img h-full w-full"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      <style jsx>{`
        .backdrop-img {
          object-fit: cover;
          object-position: center center;
        }
        @media (min-width: 768px) {
          .backdrop-img {
            object-position: 50% center;
          }
        }
        @media (max-width: 767px) {
          .backdrop-img {
            object-position: center top;
          }
        }
        @media (min-width: 768px) and (max-width: 1024px) and (orientation: portrait) {
          .backdrop-img {
            object-position: center 20%;
          }
        }
      `}</style>
    </picture>
  );
}

type SceneState = "poster" | "wind" | "fallback";

export function OakHiveScene({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webglOk, setWebglOk] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [sceneState, setSceneState] = useState<SceneState>("poster");
  const [dpr, setDpr] = useState<[number, number]>([1, 1]);

  useEffect(() => {
    queueMicrotask(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const narrow = window.matchMedia("(max-width: 767px)").matches;
      const blocked = reduce || checkShouldUseFallback() || !canCreateWebGLContext();
      setReducedMotion(reduce);
      setDpr(narrow ? [1, 1.25] : [1, 1.5]);
      setWebglOk(!blocked);
      setTabHidden(document.hidden);
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 767px)");
    const onMotion = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      if (event.matches) setWebglOk(false);
    };
    const onNarrow = (event: MediaQueryListEvent) => {
      setDpr(event.matches ? [1, 1.25] : [1, 1.5]);
    };
    const onVisibility = () => setTabHidden(document.hidden);
    motion.addEventListener("change", onMotion);
    narrow.addEventListener("change", onNarrow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      motion.removeEventListener("change", onMotion);
      narrow.removeEventListener("change", onNarrow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mounted]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleReady = useCallback(() => setSceneState("wind"), []);
  const handleError = useCallback(() => {
    setWebglOk(false);
    setSceneState("fallback");
  }, []);

  const showWind = mounted && webglOk && !reducedMotion && sceneState !== "fallback";
  const paused = !isVisible || tabHidden;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
      data-scene={showWind && sceneState === "wind" ? "wind" : "poster"}
    >
      <div className="absolute inset-0">
        <BackdropImage imgRef={imgRef} />
      </div>
      {showWind ? (
        <CanvasErrorBoundary onError={handleError}>
          <div
            className="absolute inset-0"
            style={{
              opacity: sceneState === "wind" ? 1 : 0,
              transition: "opacity 0.35s ease",
            }}
          >
            <WindCanvas
              imgRef={imgRef}
              paused={paused}
              dpr={dpr}
              onReady={handleReady}
              onError={handleError}
            />
          </div>
        </CanvasErrorBoundary>
      ) : null}
    </div>
  );
}
