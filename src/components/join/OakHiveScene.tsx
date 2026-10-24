"use client";

import { Component, useRef, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function canCreateWebGLContext(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as { __SKIP_WEBGL_PREFLIGHT__?: boolean }).__SKIP_WEBGL_PREFLIGHT__) return true;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      failIfMajorPerformanceCaveat: true,
    }) || canvas.getContext("experimental-webgl", {
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) return false;
    const glContext = gl as WebGLRenderingContext;
    glContext.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const BEE_CONFIGS_DESKTOP = [
  { x: -2.5, y: 0.5, z: 0.4, speed: 0.28, radius: 0.35, phase: 0 },
  { x: -1.8, y: -0.3, z: 0.3, speed: 0.24, radius: 0.3, phase: 1.8 },
  { x: -2.1, y: 0.8, z: 0.35, speed: 0.3, radius: 0.25, phase: 3.5 },
];

const BEE_CONFIGS_MOBILE = [
  { x: -1.5, y: 0.3, z: 0.35, speed: 0.25, radius: 0.25, phase: 0 },
  { x: -1.0, y: -0.1, z: 0.3, speed: 0.22, radius: 0.2, phase: 2.2 },
];

const POLLEN_SEEDS = Array.from({ length: 40 }, (_, i) => ({
  x: ((Math.sin(i * 127.1) * 10000) % 1 - 0.5) * 3.5,
  y: ((Math.sin(i * 311.7) * 10000) % 1) * 1.8 - 0.4,
  z: ((Math.sin(i * 74.3) * 10000) % 1) * 1.0,
}));

function SmallBee({ 
  config,
  baseScale,
}: { 
  config: { x: number; y: number; z: number; speed: number; radius: number; phase: number };
  baseScale: number;
}) {
  const beeRef = useRef<THREE.Group>(null);
  const wingRef1 = useRef<THREE.Mesh>(null);
  const wingRef2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!beeRef.current) return;
    const t = state.clock.elapsedTime * config.speed + config.phase;
    
    const x = config.x + Math.sin(t) * config.radius;
    const y = config.y + Math.sin(t * 1.4) * (config.radius * 0.25);
    const z = config.z + Math.cos(t * 0.7) * config.radius * 0.2;
    
    beeRef.current.position.set(x, y, z);
    beeRef.current.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.7) * 0.4) + Math.PI;
    beeRef.current.rotation.z = Math.sin(t * 1.2) * 0.04;
    
    const wingFlap = Math.sin(state.clock.elapsedTime * 50) * 0.7;
    if (wingRef1.current) wingRef1.current.rotation.z = 0.3 + wingFlap;
    if (wingRef2.current) wingRef2.current.rotation.z = -0.3 - wingFlap;
  });

  return (
    <group ref={beeRef} position={[config.x, config.y, config.z]} scale={baseScale}>
      {/* Abdomen - dark brown/gold striped */}
      <mesh position={[-0.04, 0, 0]} scale={[0.045, 0.022, 0.022]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={0xc9a227} />
      </mesh>
      
      {/* Stripes - dark brown */}
      <mesh position={[-0.02, 0, 0]} scale={[0.008, 0.024, 0.024]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color={0x3d2914} />
      </mesh>
      <mesh position={[-0.05, 0, 0]} scale={[0.008, 0.021, 0.021]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color={0x3d2914} />
      </mesh>
      
      {/* Thorax - darker */}
      <mesh position={[0.02, 0, 0]} scale={[0.025, 0.018, 0.018]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={0x4a3520} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0.04, 0.002, 0]} scale={[0.012, 0.01, 0.01]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color={0x2d1f10} />
      </mesh>
      
      {/* Wings - translucent, larger */}
      <mesh ref={wingRef1} position={[0.01, 0.015, 0.012]} rotation={[0, 0, 0.3]}>
        <planeGeometry args={[0.055, 0.02]} />
        <meshBasicMaterial 
          color={0xffffff}
          transparent 
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={wingRef2} position={[0.01, 0.015, -0.012]} rotation={[0, 0, -0.3]}>
        <planeGeometry args={[0.055, 0.02]} />
        <meshBasicMaterial 
          color={0xffffff}
          transparent 
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Faint thin trail - very subtle */}
      <mesh position={[-0.08, 0, 0]} scale={[0.03, 0.008, 0.008]}>
        <sphereGeometry args={[1, 4, 3]} />
        <meshBasicMaterial 
          color={0xd4a84020}
          transparent 
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Bees({ isMobile }: { isMobile: boolean }) {
  const configs = isMobile ? BEE_CONFIGS_MOBILE : BEE_CONFIGS_DESKTOP;
  const baseScale = isMobile ? 2.0 : 2.8;

  return (
    <>
      {configs.map((config, i) => (
        <SmallBee key={i} config={config} baseScale={baseScale} />
      ))}
    </>
  );
}

function Pollen({ isMobile }: { isMobile: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const seeds = isMobile ? POLLEN_SEEDS.slice(0, 20) : POLLEN_SEEDS;
  const count = seeds.length;
  
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = seeds[i].x;
    positions[i * 3 + 1] = seeds[i].y;
    positions[i * 3 + 2] = seeds[i].z;
  }

  useFrame((state) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute("position");
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.03;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] = seeds[i].y + Math.sin(t + i * 0.25) * 0.04;
      arr[i * 3] = seeds[i].x + Math.cos(t * 0.4 + i * 0.15) * 0.02;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial 
        size={isMobile ? 0.012 : 0.015}
        color={0xffd080}
        transparent
        opacity={0.45}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CameraSetup() {
  const { camera } = useThree();
  
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function SceneContent({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <CameraSetup />
      <Bees isMobile={isMobile} />
      <Pollen isMobile={isMobile} />
    </>
  );
}

function BackdropImage() {
  return (
    <picture className="absolute inset-0 h-full w-full">
      {/* Mobile art for portrait/narrow viewports */}
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
      
      {/* Desktop art for wide/landscape viewports */}
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
      
      {/* Fallback */}
      <img
        src="/join/backdrop-desktop.jpg"
        alt=""
        className="backdrop-img h-full w-full"
        loading="eager"
        decoding="async"
      />
      <style jsx>{`
        .backdrop-img {
          object-fit: cover;
          object-position: center center;
        }
        /* Desktop: center the composition, trunk at ~50-60% x */
        @media (min-width: 768px) {
          .backdrop-img {
            object-position: 50% center;
          }
        }
        /* Phone: use mobile art from top, hive in lower middle-right */
        @media (max-width: 767px) {
          .backdrop-img {
            object-position: center top;
          }
        }
        /* Tablet portrait: mobile art, show tree/canopy clearly */
        @media (min-width: 768px) and (max-width: 1024px) and (orientation: portrait) {
          .backdrop-img {
            object-position: center 20%;
          }
        }
      `}</style>
    </picture>
  );
}

type SceneState = "loading" | "ready" | "fallback";

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
  } catch {
    return true;
  }
  return false;
}

export function OakHiveScene({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [sceneState, setSceneState] = useState<SceneState>("loading");
  const [mounted, setMounted] = useState(false);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqMobile = window.matchMedia("(max-width: 767px)");
    
    queueMicrotask(() => {
      setReducedMotion(mqMotion.matches);
      setIsMobile(mqMobile.matches);
    });
    
    const handleMotion = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const handleMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    
    mqMotion.addEventListener("change", handleMotion);
    mqMobile.addEventListener("change", handleMobile);
    return () => {
      mqMotion.removeEventListener("change", handleMotion);
      mqMobile.removeEventListener("change", handleMobile);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    queueMicrotask(() => {
      if (checkShouldUseFallback()) {
        setWebglSupported(false);
        setSceneState("fallback");
        return;
      }
      
      const canCreate = canCreateWebGLContext();
      setWebglSupported(canCreate);
      if (!canCreate) setSceneState("fallback");
    });
  }, [mounted]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleCreated = useCallback(() => {
    setSceneState("ready");
  }, []);

  const handleError = useCallback(() => setSceneState("fallback"), []);

  const isPaused = !isVisible || reducedMotion;

  const backdropElement = (
    <div 
      className="absolute inset-0"
      style={{
        minHeight: "calc(100svh + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <BackdropImage />
    </div>
  );

  if (!mounted) {
    return (
      <div ref={containerRef} className={`relative h-full w-full ${className}`}>
        {backdropElement}
      </div>
    );
  }

  if (webglSupported === null) {
    return (
      <div ref={containerRef} className={`relative h-full w-full ${className}`}>
        {backdropElement}
      </div>
    );
  }

  if (sceneState === "fallback" || webglSupported === false || reducedMotion) {
    return (
      <div ref={containerRef} className={`relative h-full w-full ${className}`}>
        {backdropElement}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      {backdropElement}
      <CanvasErrorBoundary fallback={backdropElement}>
        <Canvas
          dpr={[1, 1.5]}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: true,
          }}
          camera={{ fov: 50, near: 0.1, far: 20 }}
          onCreated={handleCreated}
          onError={handleError}
          frameloop={isPaused ? "demand" : "always"}
          style={{
            position: "absolute",
            inset: 0,
            opacity: sceneState === "ready" ? 1 : 0,
            transition: "opacity 0.5s ease-in-out",
            pointerEvents: "none",
          }}
        >
          <SceneContent isMobile={isMobile} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
