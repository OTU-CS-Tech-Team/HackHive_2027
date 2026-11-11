"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { LinearSRGBColorSpace, NoToneMapping } from "three";
import MeadowWorld from "@/components/landing/meadow/World";
import { VIEW } from "@/components/landing/meadow/palette";
import { countsFor, detectQuality, readForcedQuality, webglAvailable, type Quality } from "@/components/landing/meadow/quality";
import { reportIntroProgress, reportIntroReady } from "@/components/landing/intro/introBus";

const FALLBACK =
  "linear-gradient(180deg, #e2f2f8 0%, #d7eef8 20%, #f4e4b4 48%, #c5de8a 70%, #78a84a 100%)";

export type MeadowSceneProps = {
  progress: RefObject<number>;
  /** Accepted so the page can keep passing it. The scene never reads it. */
  pointer: RefObject<{ x: number; y: number }>;
  reducedMotion?: boolean;
  quality?: "low" | "high";
  onReady?: () => void;
  className?: string;
};

type BoundaryProps = { children: ReactNode; onFail: () => void };
type BoundaryState = { failed: boolean };

class SceneBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function Fallback() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
      style={{
        backgroundColor: "#e2f2f8",
        backgroundImage: `url(/path/poster.webp), ${FALLBACK}`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}

function subscribeReduced(onStoreChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function reducedSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useSystemReducedMotion(override: boolean | undefined) {
  const system = useSyncExternalStore(subscribeReduced, reducedSnapshot, () => false);
  return override ?? system;
}

export default function MeadowScene({
  progress,
  reducedMotion,
  quality,
  onReady,
  className,
}: MeadowSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const mountedAt = useRef(0);
  const [supported] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [running, setRunning] = useState(true);
  const [settled, setSettled] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const markCompiled = useCallback(() => setCompiled(true), []);
  const [tier] = useState<Quality>(() => {
    if (quality) return quality;
    if (typeof window === "undefined") return "high";
    return readForcedQuality(window.location.search) ?? detectQuality();
  });
  const reduced = useSystemReducedMotion(reducedMotion);
  const counts = countsFor(quality ?? tier);

  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    mountedAt.current = performance.now();
    // The scene's code has arrived and mounted.
    reportIntroProgress(0.3);
  }, []);
  const markReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    const started = mountedAt.current;
    if (started > 0) {
      (window as Window & { __meadowReadyMs?: number }).__meadowReadyMs = performance.now() - started;
    }
    onReadyRef.current?.();
    reportIntroReady();
  }, []);

  useEffect(() => {
    if (supported) return;
    let pending = 0;
    let id = 0;
    const step = () => {
      pending += 1;
      if (pending >= 2) markReady();
      else id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [markReady, supported]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let onScreen = true;
    let visible = document.visibilityState !== "hidden";
    const sync = () => setRunning(onScreen && visible);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      sync();
    }, { threshold: 0.01 });
    observer.observe(el);
    const onVisibility = () => {
      visible = document.visibilityState !== "hidden";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const hold = useCallback((done: boolean) => {
    setSettled((current) => (current === done ? current : done));
  }, []);

  // Parked until the shaders have compiled in the background, so the first
  // draw never waits on the driver. The poster covers the canvas meanwhile.
  const frameLoop = lost || !running || settled || !compiled ? "never" : reduced ? "demand" : "always";

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      aria-hidden
    >
      {supported ? (
        <SceneBoundary onFail={() => { setLost(true); markReady(); }}>
          <Canvas
            className="pointer-events-none"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            dpr={[1, counts.dpr]}
            frameloop={frameLoop}
            gl={{
              antialias: counts.antialias,
              alpha: false,
              stencil: false,
              powerPreference: "high-performance",
              failIfMajorPerformanceCaveat: false,
            }}
            camera={{ fov: VIEW.fov, near: 0.08, far: 160, position: [0, VIEW.eye, VIEW.startZ] }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = LinearSRGBColorSpace;
              gl.toneMapping = NoToneMapping;
              gl.domElement.style.pointerEvents = "none";
              gl.domElement.addEventListener("webglcontextlost", (event) => {
                event.preventDefault();
                setLost(true);
                markReady();
              });
            }}
          >
            <MeadowWorld
              quality={quality ?? tier}
              progress={progress}
              reduced={reduced}
              onReady={markReady}
              onDone={hold}
              onCompiled={markCompiled}
            />
          </Canvas>
        </SceneBoundary>
      ) : null}
      {!supported || lost ? <Fallback /> : null}
    </div>
  );
}
