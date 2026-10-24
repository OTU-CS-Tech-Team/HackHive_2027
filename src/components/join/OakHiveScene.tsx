"use client";

import { Component, useRef, useEffect, useState, useMemo, useCallback } from "react";
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

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function RealisticBee({ 
  initialPosition, 
  speed, 
  radius, 
  offset,
  glowIntensity = 0.3 
}: { 
  initialPosition: [number, number, number]; 
  speed: number; 
  radius: number; 
  offset: number;
  glowIntensity?: number;
}) {
  const beeRef = useRef<THREE.Group>(null);
  const wingRef1 = useRef<THREE.Mesh>(null);
  const wingRef2 = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!beeRef.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    
    const x = initialPosition[0] + Math.sin(t) * radius;
    const y = initialPosition[1] + Math.sin(t * 1.3) * (radius * 0.3) + Math.sin(t * 2.1) * 0.05;
    const z = initialPosition[2] + Math.cos(t * 0.8) * radius * 0.4;
    
    beeRef.current.position.set(x, y, z);
    beeRef.current.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.8) * 0.5);
    beeRef.current.rotation.z = Math.sin(t * 1.5) * 0.08;
    
    const wingFlap = Math.sin(state.clock.elapsedTime * 45) * 0.35;
    if (wingRef1.current) wingRef1.current.rotation.z = 0.25 + wingFlap;
    if (wingRef2.current) wingRef2.current.rotation.z = -0.25 - wingFlap;
    
    if (glowRef.current) {
      const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 3 + offset) * 0.2;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={beeRef} position={initialPosition} scale={0.05}>
      {/* Glow trail */}
      <mesh ref={glowRef} position={[-0.8, 0, 0]}>
        <sphereGeometry args={[1.5, 8, 6]} />
        <meshBasicMaterial 
          color={0xffdd88} 
          transparent 
          opacity={glowIntensity} 
          depthWrite={false}
        />
      </mesh>
      
      {/* Body */}
      <mesh>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={0xe8a820} />
      </mesh>
      
      {/* Stripes */}
      {[-0.3, 0.3].map((zPos, i) => (
        <mesh key={i} position={[0, 0, zPos]}>
          <cylinderGeometry args={[1.05, 1.05, 0.18, 10]} />
          <meshBasicMaterial color={0x1a1a1a} />
        </mesh>
      ))}
      
      {/* Head */}
      <mesh position={[0.9, 0, 0]}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshBasicMaterial color={0x2a2a2a} />
      </mesh>
      
      {/* Wings */}
      <mesh ref={wingRef1} position={[0, 0.6, 0.35]} rotation={[0, 0, 0.25]} scale={[0.7, 0.1, 1]}>
        <sphereGeometry args={[0.7, 6, 4]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wingRef2} position={[0, 0.6, -0.35]} rotation={[0, 0, -0.25]} scale={[0.7, 0.1, 1]}>
        <sphereGeometry args={[0.7, 6, 4]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Bees({ reducedMotion }: { reducedMotion: boolean }) {
  const { size } = useThree();
  const isMobile = size.width < 768;
  
  const configs = useMemo(() => {
    if (reducedMotion) return [];
    
    if (isMobile) {
      return [
        { pos: [-1.5, 0.5, 0.5] as [number, number, number], speed: 0.4, radius: 0.6, offset: 0, glow: 0.25 },
        { pos: [-0.5, 1, 0.3] as [number, number, number], speed: 0.35, radius: 0.4, offset: 2, glow: 0.2 },
      ];
    }
    
    return [
      { pos: [-2.5, 0.3, 0.5] as [number, number, number], speed: 0.45, radius: 0.8, offset: 0, glow: 0.3 },
      { pos: [-1.5, 0.8, 0.3] as [number, number, number], speed: 0.38, radius: 0.6, offset: 1.5, glow: 0.25 },
      { pos: [-0.8, 0.2, 0.4] as [number, number, number], speed: 0.5, radius: 0.5, offset: 3, glow: 0.2 },
      { pos: [-2, -0.3, 0.2] as [number, number, number], speed: 0.42, radius: 0.7, offset: 4.5, glow: 0.25 },
    ];
  }, [isMobile, reducedMotion]);

  return (
    <>
      {configs.map((c, i) => (
        <RealisticBee 
          key={i} 
          initialPosition={c.pos} 
          speed={c.speed} 
          radius={c.radius} 
          offset={c.offset}
          glowIntensity={c.glow}
        />
      ))}
    </>
  );
}

function DustMotes({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { size } = useThree();
  const isMobile = size.width < 768;
  const count = isMobile ? 25 : 50;
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (seededRandom(8000 + i * 3) - 0.5) * 6;
      arr[i * 3 + 1] = seededRandom(8000 + i * 3 + 1) * 3 - 0.5;
      arr[i * 3 + 2] = seededRandom(8000 + i * 3 + 2) * 2 - 0.5;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current || reducedMotion) return;
    const posAttr = pointsRef.current.geometry.getAttribute("position");
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.06;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(t + i * 0.4) * 0.0015;
      arr[i * 3] += Math.cos(t * 0.5 + i * 0.25) * 0.0008;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.06} 
        color={0xffd880} 
        transparent 
        opacity={0.6} 
        sizeAttenuation 
        depthWrite={false}
      />
    </points>
  );
}

function PollenParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { size } = useThree();
  const isMobile = size.width < 768;
  const count = isMobile ? 15 : 35;
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (seededRandom(9000 + i * 3) - 0.5) * 5;
      arr[i * 3 + 1] = seededRandom(9000 + i * 3 + 1) * 2;
      arr[i * 3 + 2] = seededRandom(9000 + i * 3 + 2) * 1.5;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current || reducedMotion) return;
    const posAttr = pointsRef.current.geometry.getAttribute("position");
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.04;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(t * 1.2 + i * 0.5) * 0.002;
      arr[i * 3] += Math.cos(t * 0.8 + i * 0.3) * 0.001;
      arr[i * 3 + 2] += Math.sin(t * 0.6 + i * 0.4) * 0.0008;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.04} 
        color={0xffffee} 
        transparent 
        opacity={0.4} 
        sizeAttenuation 
        depthWrite={false}
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

function SceneContent({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <CameraSetup />
      <Bees reducedMotion={reducedMotion} />
      <DustMotes reducedMotion={reducedMotion} />
      <PollenParticles reducedMotion={reducedMotion} />
    </>
  );
}

function BackdropImage({ className = "" }: { className?: string }) {
  return (
    <picture className={className}>
      {/* Mobile art for portrait/narrow viewports */}
      <source
        media="(max-width: 767px), (max-width: 1024px) and (orientation: portrait)"
        type="image/avif"
        srcSet="
          /join/backdrop-mobile-640w.avif 640w,
          /join/backdrop-mobile-1024w.avif 1024w,
          /join/backdrop-mobile-1600w.avif 1600w
        "
        sizes="100vw"
      />
      <source
        media="(max-width: 767px), (max-width: 1024px) and (orientation: portrait)"
        type="image/webp"
        srcSet="
          /join/backdrop-mobile-640w.webp 640w,
          /join/backdrop-mobile-1024w.webp 1024w,
          /join/backdrop-mobile-1600w.webp 1600w
        "
        sizes="100vw"
      />
      <source
        media="(max-width: 767px), (max-width: 1024px) and (orientation: portrait)"
        type="image/jpeg"
        srcSet="/join/backdrop-mobile.jpg"
      />
      
      {/* Desktop art for wide/landscape viewports */}
      <source
        media="(min-width: 768px)"
        type="image/avif"
        srcSet="
          /join/backdrop-desktop-640w.avif 640w,
          /join/backdrop-desktop-1024w.avif 1024w,
          /join/backdrop-desktop-1600w.avif 1600w,
          /join/backdrop-desktop-2400w.avif 2400w
        "
        sizes="100vw"
      />
      <source
        media="(min-width: 768px)"
        type="image/webp"
        srcSet="
          /join/backdrop-desktop-640w.webp 640w,
          /join/backdrop-desktop-1024w.webp 1024w,
          /join/backdrop-desktop-1600w.webp 1600w,
          /join/backdrop-desktop-2400w.webp 2400w
        "
        sizes="100vw"
      />
      
      {/* Fallback */}
      <img
        src="/join/backdrop-desktop.jpg"
        alt=""
        className="h-full w-full object-cover"
        style={{
          objectPosition: "center 60%",
        }}
        loading="eager"
        decoding="async"
      />
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

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    });
  }, []);

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
        minHeight: "100svh",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <BackdropImage className="absolute inset-0 h-full w-full" />
    </div>
  );

  if (!mounted || webglSupported === null) {
    return (
      <div ref={containerRef} className={`relative h-full w-full ${className}`}>
        {backdropElement}
      </div>
    );
  }

  if (sceneState === "fallback" || webglSupported === false) {
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
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
