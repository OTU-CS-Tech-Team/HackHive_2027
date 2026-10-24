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

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, "rgba(255, 220, 140, 1)");
  gradient.addColorStop(0.3, "rgba(255, 200, 100, 0.6)");
  gradient.addColorStop(0.6, "rgba(255, 180, 80, 0.2)");
  gradient.addColorStop(1, "rgba(255, 160, 60, 0)");
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function RealisticBee({ 
  initialPosition, 
  speed, 
  radius, 
  offset,
  depth = 1,
}: { 
  initialPosition: [number, number, number]; 
  speed: number; 
  radius: number; 
  offset: number;
  depth?: number;
}) {
  const beeRef = useRef<THREE.Group>(null);
  const wingRef1 = useRef<THREE.Mesh>(null);
  const wingRef2 = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  const depthScale = 0.6 + depth * 0.4;
  const depthOpacity = 0.5 + depth * 0.5;

  useFrame((state) => {
    if (!beeRef.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    
    const x = initialPosition[0] + Math.sin(t) * radius;
    const y = initialPosition[1] + Math.sin(t * 1.3) * (radius * 0.25) + Math.sin(t * 2.1) * 0.03;
    const z = initialPosition[2] + Math.cos(t * 0.8) * radius * 0.3;
    
    beeRef.current.position.set(x, y, z);
    beeRef.current.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.8) * 0.5);
    beeRef.current.rotation.z = Math.sin(t * 1.5) * 0.06;
    
    const wingFlap = Math.sin(state.clock.elapsedTime * 60) * 0.5;
    if (wingRef1.current) wingRef1.current.rotation.x = 0.2 + wingFlap;
    if (wingRef2.current) wingRef2.current.rotation.x = -0.2 - wingFlap;
    
    if (trailRef.current) {
      const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 4 + offset) * 0.3;
      trailRef.current.scale.setScalar(pulse);
      (trailRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 * pulse * depthOpacity;
    }
  });

  return (
    <group ref={beeRef} position={initialPosition} scale={0.025 * depthScale}>
      {/* Soft glow trail behind bee */}
      <mesh ref={trailRef} position={[-1.5, 0, 0]}>
        <sphereGeometry args={[2, 8, 6]} />
        <meshBasicMaterial 
          color={0xffcc66} 
          transparent 
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>
      
      {/* Thorax (front body segment) - fuzzy amber */}
      <mesh position={[0.4, 0, 0]} scale={[0.7, 0.5, 0.5]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color={new THREE.Color(0xc4873a).multiplyScalar(depthOpacity)} />
      </mesh>
      
      {/* Abdomen (rear body) - elongated with stripes */}
      <mesh position={[-0.5, 0, 0]} scale={[1.2, 0.55, 0.55]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color={new THREE.Color(0xd4973a).multiplyScalar(depthOpacity)} />
      </mesh>
      
      {/* Stripes on abdomen */}
      <mesh position={[-0.2, 0, 0]} scale={[0.15, 0.58, 0.58]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color(0x2a1a0a).multiplyScalar(depthOpacity)} />
      </mesh>
      <mesh position={[-0.6, 0, 0]} scale={[0.15, 0.52, 0.52]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color(0x2a1a0a).multiplyScalar(depthOpacity)} />
      </mesh>
      <mesh position={[-1.0, 0, 0]} scale={[0.12, 0.45, 0.45]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color(0x2a1a0a).multiplyScalar(depthOpacity)} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0.9, 0.05, 0]} scale={[0.35, 0.32, 0.32]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color(0x3a2a1a).multiplyScalar(depthOpacity)} />
      </mesh>
      
      {/* Wings - translucent planes with fast flap */}
      <mesh ref={wingRef1} position={[0.2, 0.35, 0.25]} rotation={[0.2, 0.1, 0.3]}>
        <planeGeometry args={[1.4, 0.5]} />
        <meshBasicMaterial 
          color={0xffffff}
          transparent 
          opacity={0.25 * depthOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={wingRef2} position={[0.2, 0.35, -0.25]} rotation={[-0.2, -0.1, 0.3]}>
        <planeGeometry args={[1.4, 0.5]} />
        <meshBasicMaterial 
          color={0xffffff}
          transparent 
          opacity={0.25 * depthOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
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
        { pos: [-1.2, 0.4, 0.3] as [number, number, number], speed: 0.35, radius: 0.5, offset: 0, depth: 0.9 },
        { pos: [-0.3, 0.8, 0.15] as [number, number, number], speed: 0.3, radius: 0.35, offset: 2.5, depth: 0.7 },
      ];
    }
    
    return [
      { pos: [-2.2, 0.2, 0.4] as [number, number, number], speed: 0.4, radius: 0.7, offset: 0, depth: 1.0 },
      { pos: [-1.3, 0.7, 0.25] as [number, number, number], speed: 0.35, radius: 0.5, offset: 1.8, depth: 0.85 },
      { pos: [-0.5, 0.15, 0.35] as [number, number, number], speed: 0.45, radius: 0.4, offset: 3.5, depth: 0.7 },
      { pos: [-1.8, -0.2, 0.15] as [number, number, number], speed: 0.38, radius: 0.55, offset: 5, depth: 0.6 },
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
          depth={c.depth}
        />
      ))}
    </>
  );
}

function GoldenPollen({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { size } = useThree();
  const isMobile = size.width < 768;
  const count = isMobile ? 30 : 60;
  
  const texture = useMemo(() => createSoftParticleTexture(), []);
  
  const { positions, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (seededRandom(8000 + i * 3) - 0.5) * 5;
      pos[i * 3 + 1] = seededRandom(8000 + i * 3 + 1) * 2.5 - 0.3;
      pos[i * 3 + 2] = seededRandom(8000 + i * 3 + 2) * 1.5;
      sz[i] = 0.015 + seededRandom(8000 + i * 3 + 3) * 0.02;
    }
    return { positions: pos, sizes: sz };
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current || reducedMotion) return;
    const posAttr = pointsRef.current.geometry.getAttribute("position");
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.05;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(t + i * 0.35) * 0.001;
      arr[i * 3] += Math.cos(t * 0.4 + i * 0.2) * 0.0006;
      arr[i * 3 + 2] += Math.sin(t * 0.3 + i * 0.25) * 0.0004;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.03}
        map={texture}
        color={0xffd070}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function DustMotes({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { size } = useThree();
  const isMobile = size.width < 768;
  const count = isMobile ? 20 : 40;
  
  const texture = useMemo(() => createSoftParticleTexture(), []);
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (seededRandom(9000 + i * 3) - 0.5) * 4;
      arr[i * 3 + 1] = seededRandom(9000 + i * 3 + 1) * 2 - 0.2;
      arr[i * 3 + 2] = seededRandom(9000 + i * 3 + 2) * 1.2;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current || reducedMotion) return;
    const posAttr = pointsRef.current.geometry.getAttribute("position");
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.03;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(t + i * 0.5) * 0.0008;
      arr[i * 3] += Math.cos(t * 0.6 + i * 0.3) * 0.0005;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02}
        map={texture}
        color={0xffe8c0}
        transparent
        opacity={0.4}
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

function SceneContent({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <CameraSetup />
      <Bees reducedMotion={reducedMotion} />
      <GoldenPollen reducedMotion={reducedMotion} />
      <DustMotes reducedMotion={reducedMotion} />
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
      
      {/* Fallback - use mobile for narrow, desktop for wide */}
      <img
        src="/join/backdrop-desktop.jpg"
        alt=""
        className="h-full w-full object-cover"
        style={{ objectPosition: "center 60%" }}
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
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    queueMicrotask(() => setReducedMotion(mq.matches));
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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
