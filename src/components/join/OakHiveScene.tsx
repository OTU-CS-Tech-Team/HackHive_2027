"use client";

import { Component, useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
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

function createBarkTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const furrow = Math.sin(y * 0.15 + Math.sin(x * 0.05) * 3) * 0.5 + 0.5;
      const crack = Math.sin(y * 0.4 + x * 0.1) * 0.1;
      const detail = Math.sin(x * 0.3 + y * 0.08) * 0.08;
      const noise = seededRandom(y * size + x) * 0.12;
      const v = Math.max(0, Math.min(255, Math.floor((0.22 + furrow * 0.28 + crack + detail + noise) * 255)));
      
      const hasMoss = seededRandom(y * size + x + 50000) > 0.94 && furrow > 0.55;
      if (hasMoss) {
        data[i] = Math.floor(v * 0.65);
        data[i + 1] = Math.floor(v * 0.82);
        data[i + 2] = Math.floor(v * 0.55);
      } else {
        data[i] = v;
        data[i + 1] = Math.floor(v * 0.88);
        data[i + 2] = Math.floor(v * 0.72);
      }
      data[i + 3] = 255;
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  texture.needsUpdate = true;
  return texture;
}

function createBarkNormalMap(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const furrowArg = y * 0.15 + Math.sin(x * 0.05) * 3;
      const dx = Math.cos(furrowArg) * Math.cos(x * 0.05) * 3 * 0.15 + seededRandom(y * size + x + 1000) * 0.1;
      const dy = Math.cos(furrowArg) * 0.15 + seededRandom(y * size + x + 2000) * 0.1;
      
      data[i] = Math.floor((dx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
      data[i + 2] = 200;
      data[i + 3] = 255;
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  texture.needsUpdate = true;
  return texture;
}

function createWoodTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const plank = Math.floor(y / 20);
      const grain = Math.sin(x * 0.3 + plank * 10) * 0.08;
      const noise = seededRandom(y * size + x + 30000) * 0.1;
      const base = 0.65 + grain + noise;
      const v = Math.floor(Math.max(0, Math.min(1, base)) * 255);
      
      data[i] = v;
      data[i + 1] = Math.floor(v * 0.85);
      data[i + 2] = Math.floor(v * 0.6);
      data[i + 3] = 255;
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createLeafTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#5a7a3a";
  
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(20, 8, 8, 20, 12, 32);
  ctx.bezierCurveTo(8, 44, 20, 56, 32, 60);
  ctx.bezierCurveTo(44, 56, 56, 44, 52, 32);
  ctx.bezierCurveTo(56, 20, 44, 8, 32, 4);
  ctx.fill();
  
  for (let lobe = 0; lobe < 5; lobe++) {
    const angle = (lobe / 5) * Math.PI * 2 - Math.PI / 2;
    const cx = 32 + Math.cos(angle) * 18;
    const cy = 32 + Math.sin(angle) * 18;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 14, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.strokeStyle = "#4a6a2a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 60);
  ctx.lineTo(32, 20);
  ctx.stroke();
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function GnarledTrunk() {
  const barkTexture = useMemo(() => createBarkTexture(), []);
  const barkNormal = useMemo(() => createBarkNormalMap(), []);
  
  const trunkGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.8, 1.8, 12, 24, 20);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const angle = Math.atan2(pos.getZ(i), pos.getX(i));
      const normalizedY = (y + 6) / 12;
      
      const taper = 1 - normalizedY * 0.3;
      const gnarl = Math.sin(y * 0.8 + angle * 4) * 0.12 * (1 - normalizedY * 0.5);
      const bulge = Math.sin(angle * 2 + y * 0.2) * 0.15 * Math.pow(1 - normalizedY, 0.5);
      const twist = Math.sin(y * 0.3) * 0.08;
      
      const r = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2);
      const newR = r * taper + gnarl + bulge;
      const newAngle = angle + twist;
      
      pos.setX(i, Math.cos(newAngle) * newR);
      pos.setZ(i, Math.sin(newAngle) * newR);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const trunkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: barkTexture,
        normalMap: barkNormal,
        normalScale: new THREE.Vector2(2, 2),
        roughness: 0.92,
        metalness: 0,
        color: new THREE.Color(0x3a2a1a),
      }),
    [barkTexture, barkNormal]
  );

  return (
    <group>
      <mesh geometry={trunkGeometry} material={trunkMaterial} castShadow receiveShadow />
      <mesh position={[0.5, -3.5, 0.6]} rotation={[0.15, 0.2, 0.1]}>
        <sphereGeometry args={[1.1, 20, 16]} />
        <meshStandardMaterial color={0x080604} roughness={1} />
      </mesh>
      <mesh position={[0.3, -3.8, 0.4]} rotation={[0.1, 0.15, 0]}>
        <sphereGeometry args={[0.7, 16, 12]} />
        <meshStandardMaterial color={0x050302} roughness={1} />
      </mesh>
    </group>
  );
}

function ThickBranch({ start, end, startRadius, endRadius, seed = 0 }: { 
  start: [number, number, number]; 
  end: [number, number, number]; 
  startRadius: number;
  endRadius: number;
  seed?: number 
}) {
  const barkTexture = useMemo(() => createBarkTexture(), []);
  
  const geometry = useMemo(() => {
    const midX = (start[0] + end[0]) * 0.5 + (seededRandom(seed) - 0.5) * 1.5;
    const midY = (start[1] + end[1]) * 0.5 + seededRandom(seed + 1) * 0.8;
    const midZ = (start[2] + end[2]) * 0.5 + (seededRandom(seed + 2) - 0.5) * 0.5;
    
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3(midX, midY, midZ),
      new THREE.Vector3(...end),
    ]);
    
    const radiusFunc = (t: number) => startRadius * (1 - t) + endRadius * t;
    const radii: number[] = [];
    for (let i = 0; i <= 12; i++) {
      radii.push(radiusFunc(i / 12));
    }
    
    return new THREE.TubeGeometry(curve, 12, startRadius * 0.7, 10, false);
  }, [start, end, startRadius, endRadius, seed]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        map={barkTexture}
        color={0x2a1a0a}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
}

function LeafCluster({ position, scale = 1, count = 40, seed = 0 }: { 
  position: [number, number, number]; 
  scale?: number; 
  count?: number;
  seed?: number;
}) {
  const leafTexture = useMemo(() => createLeafTexture(), []);
  const groupRef = useRef<THREE.Group>(null);
  
  const leafData = useMemo(() => {
    const leaves: { pos: THREE.Vector3; rot: THREE.Euler; scale: number }[] = [];
    for (let i = 0; i < count; i++) {
      const theta = seededRandom(seed + i * 3) * Math.PI * 2;
      const phi = seededRandom(seed + i * 3 + 1) * Math.PI;
      const r = 0.3 + seededRandom(seed + i * 3 + 2) * 0.7;
      
      leaves.push({
        pos: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * r,
          Math.sin(phi) * Math.sin(theta) * r * 0.6,
          Math.cos(phi) * r
        ),
        rot: new THREE.Euler(
          seededRandom(seed + i * 3 + 3) * 0.8 - 0.4,
          theta,
          seededRandom(seed + i * 3 + 4) * 0.6 - 0.3
        ),
        scale: 0.15 + seededRandom(seed + i * 3 + 5) * 0.1,
      });
    }
    return leaves;
  }, [count, seed]);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime * 0.5;
    groupRef.current.rotation.y = Math.sin(t + seed) * 0.02;
    groupRef.current.rotation.x = Math.cos(t * 0.7 + seed) * 0.015;
  });
  
  return (
    <group ref={groupRef} position={position} scale={scale}>
      {leafData.map((leaf, i) => (
        <mesh key={i} position={leaf.pos} rotation={leaf.rot} scale={leaf.scale}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            map={leafTexture}
            transparent
            alphaTest={0.3}
            side={THREE.DoubleSide}
            color={i % 3 === 0 ? 0x6a8a4a : 0x5a7a3a}
            roughness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

function OakCanopy() {
  return (
    <group position={[0, 6, 0]}>
      <LeafCluster position={[-2, 1, 0.5]} scale={2.5} count={60} seed={100} />
      <LeafCluster position={[-1, 1.5, -0.5]} scale={2.2} count={55} seed={200} />
      <LeafCluster position={[0, 2, 0]} scale={2} count={50} seed={300} />
      <LeafCluster position={[1, 1.2, 0.3]} scale={2.3} count={55} seed={400} />
      <LeafCluster position={[2, 0.8, -0.2]} scale={2} count={50} seed={500} />
      <LeafCluster position={[-1.5, 0.5, 1]} scale={1.8} count={45} seed={600} />
      <LeafCluster position={[1.5, 0.3, 0.8]} scale={1.8} count={45} seed={700} />
      <LeafCluster position={[0, 0, 1.5]} scale={1.5} count={35} seed={800} />
      <LeafCluster position={[-2.5, -0.2, 0]} scale={1.6} count={40} seed={900} />
      <LeafCluster position={[2.5, -0.3, 0.5]} scale={1.6} count={40} seed={1000} />
    </group>
  );
}

function WoodenHive() {
  const { size } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const woodTexture = useMemo(() => createWoodTexture(), []);
  
  useFrame(() => {
    if (!groupRef.current) return;
    const w = size.width;
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    
    if (isMobile) {
      // Mobile: hive at x=75%, y=50-58% (middle-ish of viewport)
      groupRef.current.position.set(2.5, 3.2, 2);
      groupRef.current.scale.setScalar(0.65);
    } else if (isTablet) {
      // Tablet: hive needs to be lower to be fully visible, not cut off at top
      groupRef.current.position.set(3.2, 3, 2);
      groupRef.current.scale.setScalar(0.75);
    } else {
      // Desktop: hive at top-right, y=10-30% from top, fully visible
      groupRef.current.position.set(6, 4.5, 2);
      groupRef.current.scale.setScalar(1);
    }
  });

  const woodMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      map: woodTexture,
      color: new THREE.Color(0xd4a050),
      roughness: 0.75,
      metalness: 0.02,
    }),
    [woodTexture]
  );

  const roofMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      map: woodTexture,
      color: new THREE.Color(0x8a6a40),
      roughness: 0.8,
      metalness: 0.02,
    }),
    [woodTexture]
  );

  return (
    <group ref={groupRef}>
      <Float speed={0.3} rotationIntensity={0.008} floatIntensity={0.06}>
        <group>
          <mesh position={[-0.15, 1.2, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.8, 8]} />
            <meshStandardMaterial color={0x5a4a3a} roughness={1} />
          </mesh>
          <mesh position={[0.15, 1.2, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.8, 8]} />
            <meshStandardMaterial color={0x5a4a3a} roughness={1} />
          </mesh>

          <mesh position={[0, 0, 0]} material={woodMaterial} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.85, 0.5]} />
          </mesh>
          
          {[-0.25, 0, 0.25].map((yOff, i) => (
            <mesh key={i} position={[0.351, yOff - 0.1, 0]}>
              <boxGeometry args={[0.015, 0.2, 0.45]} />
              <meshStandardMaterial color={0xb8986a} roughness={0.85} />
            </mesh>
          ))}

          <group position={[0, 0.55, 0]}>
            <mesh material={roofMaterial} castShadow>
              <boxGeometry args={[0.85, 0.08, 0.6]} />
            </mesh>
            <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0]} material={roofMaterial} castShadow>
              <boxGeometry args={[0.75, 0.18, 0.55]} />
            </mesh>
            <mesh position={[0, 0.26, 0]} rotation={[0, 0, 0]} material={roofMaterial} castShadow>
              <boxGeometry args={[0.55, 0.1, 0.45]} />
            </mesh>
          </group>

          <mesh position={[0.36, -0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.22, 0.1]} />
            <meshStandardMaterial color={0x080604} roughness={1} />
          </mesh>
          
          <mesh position={[0.4, -0.18, 0.12]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 0.15, 8]} />
            <meshStandardMaterial color={0xb89868} roughness={0.8} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}

function RealisticBee({ position, speed, radius, offset }: { 
  position: [number, number, number]; 
  speed: number; 
  radius: number; 
  offset: number 
}) {
  const beeRef = useRef<THREE.Group>(null);
  const wingRef1 = useRef<THREE.Mesh>(null);
  const wingRef2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!beeRef.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    
    const x = position[0] + Math.sin(t) * radius;
    const y = position[1] + Math.sin(t * 1.3) * (radius * 0.4) + Math.sin(t * 2.1) * 0.1;
    const z = position[2] + Math.cos(t * 0.8) * radius * 0.6;
    
    beeRef.current.position.set(x, y, z);
    beeRef.current.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.8) * 0.5);
    beeRef.current.rotation.z = Math.sin(t * 1.5) * 0.1;
    
    const wingFlap = Math.sin(state.clock.elapsedTime * 40) * 0.4;
    if (wingRef1.current) wingRef1.current.rotation.z = 0.3 + wingFlap;
    if (wingRef2.current) wingRef2.current.rotation.z = -0.3 - wingFlap;
  });

  return (
    <group ref={beeRef} position={position} scale={0.12}>
      <mesh>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={0xe8a820} roughness={0.4} />
      </mesh>
      
      {[-0.3, 0.3].map((zPos, i) => (
        <mesh key={i} position={[0, 0, zPos]}>
          <cylinderGeometry args={[1.05, 1.05, 0.2, 12]} />
          <meshStandardMaterial color={0x1a1a1a} roughness={0.5} />
        </mesh>
      ))}
      
      <mesh position={[0.9, 0, 0]}>
        <sphereGeometry args={[0.55, 8, 6]} />
        <meshStandardMaterial color={0x2a2a2a} roughness={0.3} />
      </mesh>
      
      <mesh ref={wingRef1} position={[0, 0.7, 0.4]} rotation={[0, 0, 0.3]} scale={[0.8, 0.12, 1.2]}>
        <sphereGeometry args={[0.8, 8, 6]} />
        <meshStandardMaterial color={0xffffff} transparent opacity={0.4} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wingRef2} position={[0, 0.7, -0.4]} rotation={[0, 0, -0.3]} scale={[0.8, 0.12, 1.2]}>
        <sphereGeometry args={[0.8, 8, 6]} />
        <meshStandardMaterial color={0xffffff} transparent opacity={0.4} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Bees() {
  const { size } = useThree();
  const isDesktop = size.width >= 1024;
  
  const configs = useMemo(() => isDesktop ? [
    { pos: [-3, 1.5, 2.5] as [number, number, number], speed: 0.5, radius: 1.8, offset: 0 },
    { pos: [-2, 2.5, 2] as [number, number, number], speed: 0.4, radius: 1.4, offset: 2 },
    { pos: [-4, 0.5, 1.5] as [number, number, number], speed: 0.55, radius: 1.2, offset: 4 },
    { pos: [-1.5, 3, 2.5] as [number, number, number], speed: 0.45, radius: 1, offset: 1 },
    { pos: [-2.5, 1, 3] as [number, number, number], speed: 0.5, radius: 1.5, offset: 3 },
  ] : [
    { pos: [2, 2, 2] as [number, number, number], speed: 0.5, radius: 1, offset: 0 },
    { pos: [3, 3, 1.5] as [number, number, number], speed: 0.4, radius: 0.8, offset: 2 },
    { pos: [2.5, 1.5, 2.5] as [number, number, number], speed: 0.55, radius: 0.9, offset: 4 },
  ], [isDesktop]);

  return (
    <>
      {configs.map((c, i) => (
        <RealisticBee key={i} position={c.pos} speed={c.speed} radius={c.radius} offset={c.offset} />
      ))}
    </>
  );
}

function MeadowGround() {
  const grassPositions = useMemo(() => {
    const positions: { x: number; z: number; h: number; rot: number }[] = [];
    for (let i = 0; i < 100; i++) {
      positions.push({
        x: (seededRandom(i * 4) - 0.5) * 20,
        z: seededRandom(i * 4 + 1) * 5 + 2,
        h: 0.15 + seededRandom(i * 4 + 2) * 0.25,
        rot: (seededRandom(i * 4 + 3) - 0.5) * 0.3,
      });
    }
    return positions;
  }, []);

  const flowerPositions = useMemo(() => {
    const positions: { x: number; z: number; color: number }[] = [];
    const colors = [0xfff8e8, 0xfffae0, 0xf8f0e0, 0xfff0d0];
    for (let i = 0; i < 30; i++) {
      positions.push({
        x: (seededRandom(5000 + i * 2) - 0.5) * 18,
        z: seededRandom(5000 + i * 2 + 1) * 4 + 2.5,
        color: colors[i % colors.length],
      });
    }
    return positions;
  }, []);

  return (
    <group position={[0, -5.5, 4]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color={0x5a6a3a} roughness={0.95} />
      </mesh>

      {grassPositions.map((g, i) => (
        <mesh key={`g-${i}`} position={[g.x, g.h / 2, g.z]} rotation={[g.rot, 0, 0]}>
          <coneGeometry args={[0.02, g.h, 4]} />
          <meshStandardMaterial color={0x4a5a2a} roughness={0.85} />
        </mesh>
      ))}

      {flowerPositions.map((f, i) => (
        <mesh key={`f-${i}`} position={[f.x, 0.06, f.z]}>
          <sphereGeometry args={[0.04, 6, 4]} />
          <meshStandardMaterial color={f.color} roughness={0.6} emissive={f.color} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function GoldenHourLighting() {
  const { size } = useThree();
  const isMobile = size.width < 768;
  const shadowSize = isMobile ? 512 : 1024;
  
  return (
    <>
      <directionalLight
        position={[-15, 10, 8]}
        intensity={2.8}
        color={new THREE.Color(0xffd8a0)}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-far={40}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      <pointLight position={[-10, 4, 6]} intensity={0.8} color={new THREE.Color(0xffc080)} distance={20} />
      <hemisphereLight args={[new THREE.Color(0xffecd0), new THREE.Color(0x5a6a4a), 0.5]} />
      <ambientLight intensity={0.2} color={new THREE.Color(0xfff5e8)} />
    </>
  );
}

function DustMotes() {
  const moteRef = useRef<THREE.Points>(null);
  
  const positions = useMemo(() => {
    const arr = new Float32Array(50 * 3);
    for (let i = 0; i < 50; i++) {
      arr[i * 3] = seededRandom(8000 + i * 3) * 8 - 6;
      arr[i * 3 + 1] = seededRandom(8000 + i * 3 + 1) * 6;
      arr[i * 3 + 2] = seededRandom(8000 + i * 3 + 2) * 5 + 1;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!moteRef.current) return;
    const posAttr = moteRef.current.geometry.getAttribute("position");
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.08;
    for (let i = 0; i < 50; i++) {
      arr[i * 3 + 1] += Math.sin(t + i * 0.5) * 0.002;
      arr[i * 3] += Math.cos(t * 0.6 + i * 0.3) * 0.001;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={moteRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.1} color={0xffd080} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function CameraSetup() {
  const { size } = useThree();
  const lastSizeRef = useRef<string>("");
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const basePositionRef = useRef(new THREE.Vector3(0, 2, 10));

  useFrame((state) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const w = size.width;
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    const sizeKey = `${w}`;
    
    if (lastSizeRef.current !== sizeKey) {
      lastSizeRef.current = sizeKey;
      
      if (isMobile) {
        // Mobile: close-up, trunk fills lower-right
        basePositionRef.current.set(1, 2, 6);
        targetRef.current.set(1.5, 2.5, 0);
        cam.fov = 60;
      } else if (isTablet) {
        // Tablet: pull back a bit, show full hive
        basePositionRef.current.set(1, 2.5, 7);
        targetRef.current.set(1.2, 3, 0);
        cam.fov = 55;
      } else {
        // Desktop: frame centered trunk reaching up and out of frame
        // Lower camera slightly to see more of the height, look up at canopy
        basePositionRef.current.set(-0.5, 0.5, 10);
        targetRef.current.set(0.5, 4, 0);
        cam.fov = 50;
      }
      cam.position.copy(basePositionRef.current);
      cam.updateProjectionMatrix();
    }
    
    const t = state.clock.elapsedTime * 0.04;
    const bob = Math.sin(t) * 0.02;
    cam.position.y = basePositionRef.current.y + bob;
    cam.lookAt(targetRef.current);
  });

  return null;
}

function OakTree() {
  const { size } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!groupRef.current) return;
    const w = size.width;
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    
    if (isMobile) {
      // Mobile: trunk fills lower-right of frame
      groupRef.current.position.set(2.5, -4, -1);
      groupRef.current.scale.setScalar(1.3);
    } else if (isTablet) {
      // Tablet: trunk fills center-right
      groupRef.current.position.set(2, -4, -1);
      groupRef.current.scale.setScalar(1.25);
    } else {
      // Desktop: trunk center-right, massive - reaches and exits top of frame
      // Shift right a bit so hollow is at x=50-60%
      groupRef.current.position.set(1.5, -2.5, -2);
      groupRef.current.scale.setScalar(1.7);
    }
  });
  
  return (
    <group ref={groupRef} position={[0.5, -3, -2]}>
      <GnarledTrunk />
      
      <ThickBranch start={[0, 5, 0]} end={[-3, 7, 1]} startRadius={0.35} endRadius={0.15} seed={1} />
      <ThickBranch start={[0.2, 5.5, -0.2]} end={[3, 7.5, 0.5]} startRadius={0.3} endRadius={0.12} seed={2} />
      <ThickBranch start={[-0.3, 4.5, 0.3]} end={[-2, 6, 1.5]} startRadius={0.25} endRadius={0.1} seed={3} />
      <ThickBranch start={[0.1, 5.2, 0]} end={[0, 8, 0]} startRadius={0.28} endRadius={0.08} seed={4} />
      
      <OakCanopy />
    </group>
  );
}

function SceneContent() {
  const { size } = useThree();
  const isMobile = size.width < 768;
  const isTablet = size.width >= 768 && size.width < 1024;
  
  const fogNear = isMobile ? 12 : isTablet ? 10 : 8;
  const fogFar = isMobile ? 35 : isTablet ? 30 : 28;
  
  return (
    <>
      <CameraSetup />
      <color attach="background" args={[0xf8ece0]} />
      <fog attach="fog" args={[0xf5e8d8, fogNear, fogFar]} />
      <GoldenHourLighting />
      <OakTree />
      <WoodenHive />
      <Bees />
      <MeadowGround />
      {!isMobile && <DustMotes />}
    </>
  );
}

function FallbackImage() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/join/fallback.jpg"
        alt=""
        className="h-full w-full object-cover object-center"
        loading="eager"
      />
    </div>
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
  const frameTimesRef = useRef<number[]>([]);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
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

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.15;
    setSceneState("ready");
  }, []);

  const handleError = useCallback(() => setSceneState("fallback"), []);

  useEffect(() => {
    if (sceneState !== "ready" || !isVisible) return;

    let frameId: number;
    let lowPerfCount = 0;

    const checkPerformance = (time: number) => {
      frameTimesRef.current.push(time);
      if (frameTimesRef.current.length > 30) frameTimesRef.current.shift();

      if (time - lastCheckRef.current > 2000 && frameTimesRef.current.length >= 10) {
        lastCheckRef.current = time;
        const times = frameTimesRef.current;
        const avgDelta = (times[times.length - 1] - times[0]) / (times.length - 1);
        const fps = 1000 / avgDelta;

        if (fps < 15) {
          lowPerfCount++;
          if (lowPerfCount >= 3) {
            setSceneState("fallback");
            return;
          }
        } else {
          lowPerfCount = Math.max(0, lowPerfCount - 1);
        }
      }

      frameId = requestAnimationFrame(checkPerformance);
    };

    frameId = requestAnimationFrame(checkPerformance);
    return () => cancelAnimationFrame(frameId);
  }, [sceneState, isVisible]);

  const isPaused = !isVisible;

  if (sceneState === "fallback" || webglSupported === false) {
    return (
      <div ref={containerRef} className={`relative h-full w-full ${className}`}>
        <FallbackImage />
      </div>
    );
  }

  if (!mounted || webglSupported === null) {
    return (
      <div ref={containerRef} className={`relative h-full w-full ${className}`}>
        <FallbackImage />
      </div>
    );
  }

  const fallbackElement = (
    <div className={`relative h-full w-full ${className}`}>
      <FallbackImage />
    </div>
  );

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      <FallbackImage />
      <CanvasErrorBoundary fallback={fallbackElement}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: true,
          }}
          camera={{ fov: 50, near: 0.1, far: 60 }}
          onCreated={handleCreated}
          onError={handleError}
          frameloop={isPaused ? "demand" : "always"}
          style={{
            position: "absolute",
            inset: 0,
            opacity: sceneState === "ready" ? 1 : 0,
            transition: "opacity 0.5s ease-in-out",
          }}
        >
          <SceneContent />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
