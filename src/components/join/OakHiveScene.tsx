"use client";

import { Component, useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

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
  // Allow test scripts to bypass the strict check
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

function createBarkTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const furrow = Math.sin(y * 0.3 + Math.sin(x * 0.1) * 2) * 0.5 + 0.5;
      const detail = Math.sin(x * 0.8 + y * 0.2) * 0.15;
      const noise = seededRandom(y * size + x) * 0.1;
      const v = Math.floor((0.25 + furrow * 0.35 + detail + noise) * 255);
      
      const hasMoss = seededRandom(y * size + x + 10000) > 0.92 && furrow > 0.6;
      if (hasMoss) {
        data[i] = Math.floor(v * 0.7);
        data[i + 1] = Math.floor(v * 0.85);
        data[i + 2] = Math.floor(v * 0.6);
      } else {
        data[i] = v;
        data[i + 1] = Math.floor(v * 0.9);
        data[i + 2] = Math.floor(v * 0.75);
      }
      data[i + 3] = 255;
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.needsUpdate = true;
  return texture;
}

function createBarkNormalMap() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const furrowArg = y * 0.3 + Math.sin(x * 0.1) * 2;
      const dx = Math.cos(furrowArg) * Math.cos(x * 0.1) * 2 * 0.3;
      const dy = Math.cos(furrowArg) * 0.3;
      
      data[i] = Math.floor((dx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.needsUpdate = true;
  return texture;
}

function OakTrunk() {
  const barkTexture = useMemo(() => createBarkTexture(), []);
  const barkNormal = useMemo(() => createBarkNormalMap(), []);
  
  const trunkGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1.2, 2.0, 8, 32, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const angle = Math.atan2(pos.getZ(i), pos.getX(i));
      const gnarl = Math.sin(y * 1.5 + angle * 3) * 0.15 + Math.sin(y * 0.5) * 0.2;
      const bulge = Math.sin(angle * 2 + y * 0.3) * 0.1;
      const r = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2);
      const newR = r + gnarl + bulge;
      pos.setX(i, pos.getX(i) * (newR / r));
      pos.setZ(i, pos.getZ(i) * (newR / r));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const trunkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: barkTexture,
        normalMap: barkNormal,
        normalScale: new THREE.Vector2(1.5, 1.5),
        roughness: 0.95,
        metalness: 0,
        color: new THREE.Color(0x4a3a2a),
      }),
    [barkTexture, barkNormal]
  );

  return (
    <group>
      <mesh geometry={trunkGeometry} material={trunkMaterial} castShadow receiveShadow />
      <mesh position={[-0.3, -2, 0.8]} rotation={[0.1, 0.3, 0]}>
        <sphereGeometry args={[0.8, 16, 12]} />
        <meshStandardMaterial color={0x0a0805} roughness={1} />
      </mesh>
    </group>
  );
}

function OakBranch({ start, end, radius, seed = 0 }: { start: [number, number, number]; end: [number, number, number]; radius: number; seed?: number }) {
  const barkTexture = useMemo(() => createBarkTexture(), []);
  
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3(
        (start[0] + end[0]) * 0.5 + (seededRandom(seed) - 0.5) * 0.5,
        (start[1] + end[1]) * 0.5 + 0.3,
        (start[2] + end[2]) * 0.5
      ),
      new THREE.Vector3(...end),
    ]);
    return new THREE.TubeGeometry(curve, 12, radius, 12, false);
  }, [start, end, radius, seed]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        map={barkTexture}
        color={0x3a2a1a}
        roughness={0.92}
        metalness={0}
      />
    </mesh>
  );
}

function OakLeafCluster({ position, scale = 1, backlit = false, seed = 0 }: { position: [number, number, number]; scale?: number; backlit?: boolean; seed?: number }) {
  const leafColor = backlit ? 0x8a9a5a : 0x5a6a3a;
  const opacity = backlit ? 0.85 : 0.95;
  
  const leafData = useMemo(() => {
    return [...Array(8)].map((_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      r: 0.3 + seededRandom(seed + i * 10) * 0.2,
      y: (seededRandom(seed + i * 10 + 1) - 0.5) * 0.3,
      rotX: seededRandom(seed + i * 10 + 2) * 0.5,
      rotZ: seededRandom(seed + i * 10 + 3) * 0.3,
    }));
  }, [seed]);
  
  return (
    <group position={position} scale={scale}>
      {leafData.map((leaf, i) => (
        <mesh
          key={i}
          position={[Math.cos(leaf.angle) * leaf.r, leaf.y, Math.sin(leaf.angle) * leaf.r]}
          rotation={[leaf.rotX, leaf.angle, leaf.rotZ]}
        >
          <planeGeometry args={[0.4, 0.25]} />
          <meshStandardMaterial
            color={leafColor}
            roughness={0.7}
            metalness={0}
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
            alphaTest={0.1}
          />
        </mesh>
      ))}
    </group>
  );
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
      // Mobile: tree on right, card on left
      groupRef.current.position.set(8, -4, -2);
      groupRef.current.scale.setScalar(0.65);
    } else if (isTablet) {
      // Tablet: tree on right, card on left  
      groupRef.current.position.set(7, -4, -2);
      groupRef.current.scale.setScalar(0.75);
    } else {
      // Desktop: trunk center-right, hollow at ~x=50-60% behind centered card
      // Move trunk slightly left so hollow is more centered
      groupRef.current.position.set(1, -3.5, -2);
      groupRef.current.scale.setScalar(1.1);
    }
  });
  
  return (
    <group ref={groupRef} position={[2.5, -4, -2]}>
      <OakTrunk />
      
      <OakBranch start={[0.5, 3, 0]} end={[-4, 4.5, 1]} radius={0.25} seed={1} />
      <OakBranch start={[0.3, 3.5, -0.3]} end={[3, 5, 0.5]} radius={0.2} seed={2} />
      <OakBranch start={[-0.2, 2.5, 0.5]} end={[-2, 3.5, 2]} radius={0.18} seed={3} />
      
      <OakLeafCluster position={[-3.5, 4.5, 1]} scale={1.2} backlit seed={100} />
      <OakLeafCluster position={[-2.5, 4.8, 0.5]} scale={1} backlit seed={200} />
      <OakLeafCluster position={[-4, 4.2, 1.5]} scale={0.9} backlit seed={300} />
      <OakLeafCluster position={[2.5, 5, 0.5]} scale={1.1} seed={400} />
      <OakLeafCluster position={[3, 4.5, 1]} scale={0.8} seed={500} />
      <OakLeafCluster position={[-2, 3.5, 2]} scale={0.9} seed={600} />
      <OakLeafCluster position={[-1, 4, 1.5]} scale={0.7} backlit seed={700} />
    </group>
  );
}

function WoodenHive() {
  const { size } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!groupRef.current) return;
    const w = size.width;
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    
    if (isMobile) {
      // Mobile: hive visible on right
      groupRef.current.position.set(7, 0, 2);
      groupRef.current.scale.setScalar(0.8);
    } else if (isTablet) {
      // Tablet: hive on right
      groupRef.current.position.set(6, 0.5, 2);
      groupRef.current.scale.setScalar(0.9);
    } else {
      // Desktop: hive top-right at ~x=75%, y=10-30% (high up, clear of centered card)
      groupRef.current.position.set(5.5, 2.5, 1);
      groupRef.current.scale.setScalar(1);
    }
  });
  
  const woodMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xc9a86c),
        roughness: 0.8,
        metalness: 0.02,
      }),
    []
  );

  const roofMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8a7a5a),
        roughness: 0.85,
        metalness: 0.02,
      }),
    []
  );

  const ropeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x6a5a4a),
        roughness: 1,
        metalness: 0,
      }),
    []
  );

  return (
    <group ref={groupRef}>
      <Float speed={0.4} rotationIntensity={0.01} floatIntensity={0.08}>
        <group>
        <mesh position={[-0.2, 0.8, 0]} material={ropeMaterial}>
          <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
        </mesh>
        <mesh position={[0.2, 0.8, 0]} material={ropeMaterial}>
          <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
        </mesh>

        <mesh position={[0, 0, 0]} material={woodMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.7, 0.45]} />
        </mesh>
        
        {[-0.2, 0, 0.2].map((y, i) => (
          <mesh key={i} position={[0.301, y - 0.1, 0]}>
            <boxGeometry args={[0.02, 0.15, 0.4]} />
            <meshStandardMaterial color={0x9a8a6a} roughness={0.9} />
          </mesh>
        ))}

        <group position={[0, 0.5, 0]}>
          <mesh material={roofMaterial} castShadow>
            <boxGeometry args={[0.75, 0.08, 0.55]} />
          </mesh>
          <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0]} material={roofMaterial} castShadow>
            <boxGeometry args={[0.7, 0.16, 0.5]} />
          </mesh>
        </group>

        <mesh position={[0.31, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.25, 0.08]} />
          <meshStandardMaterial color={0x0a0805} roughness={1} />
        </mesh>
        
        <mesh position={[0.35, -0.1, 0.15]} rotation={[0, 0, Math.PI / 2]} material={woodMaterial}>
          <cylinderGeometry args={[0.025, 0.025, 0.12, 8]} />
        </mesh>
        </group>
      </Float>
    </group>
  );
}

function Bee({ position, speed, radius, offset }: { position: [number, number, number]; speed: number; radius: number; offset: number }) {
  const beeRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);
  const trailBufferRef = useRef<Float32Array | null>(null);
  const trailIndexRef = useRef(0);

  useFrame((state) => {
    if (!beeRef.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    
    const x = position[0] + Math.sin(t) * radius;
    const y = position[1] + Math.sin(t * 1.3) * (radius * 0.3);
    const z = position[2] + Math.cos(t * 0.8) * radius * 0.5;
    
    beeRef.current.position.set(x, y, z);
    beeRef.current.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.8) * 0.5);

    if (trailRef.current) {
      const posAttr = trailRef.current.geometry.getAttribute('position');
      if (posAttr) {
        if (!trailBufferRef.current) trailBufferRef.current = posAttr.array as Float32Array;
        const buffer = trailBufferRef.current;
        const idx = (trailIndexRef.current % 8) * 3;
        buffer[idx] = x;
        buffer[idx + 1] = y;
        buffer[idx + 2] = z;
        trailIndexRef.current++;
        posAttr.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <group ref={beeRef} position={position} scale={0.08}>
        <mesh>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={0xd4a020} roughness={0.5} />
        </mesh>
        <mesh position={[0.2, 0, 0]}>
          <torusGeometry args={[0.85, 0.2, 6, 12]} />
          <meshStandardMaterial color={0x1a1a1a} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.6, 0.3]} scale={[0.6, 0.15, 1]}>
          <sphereGeometry args={[0.5, 6, 4]} />
          <meshStandardMaterial color={0xffffff} transparent opacity={0.5} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.6, -0.3]} scale={[0.6, 0.15, 1]}>
          <sphereGeometry args={[0.5, 6, 4]} />
          <meshStandardMaterial color={0xffffff} transparent opacity={0.5} roughness={0.1} />
        </mesh>
      </group>
      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(24), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color={0xd4a020} transparent opacity={0.4} sizeAttenuation />
      </points>
    </>
  );
}

function Bees() {
  const { size } = useThree();
  const isMobile = size.width < 768;
  const isDesktop = size.width >= 1024;
  
  // Desktop: bees on left half; Mobile/tablet: bees near hive on right
  const configs = useMemo(() => isDesktop ? [
    { pos: [-3, 0.5, 3] as [number, number, number], speed: 0.4, radius: 1.5, offset: 0 },
    { pos: [-2, 1.5, 2.5] as [number, number, number], speed: 0.35, radius: 1.2, offset: 2 },
    { pos: [-4, 0, 2] as [number, number, number], speed: 0.45, radius: 1, offset: 4 },
    { pos: [-1.5, -0.5, 3.5] as [number, number, number], speed: 0.38, radius: 0.9, offset: 1 },
    { pos: [-2.5, 2, 2] as [number, number, number], speed: 0.42, radius: 1.1, offset: 3 },
  ] : [
    { pos: [4, 0.5, 3] as [number, number, number], speed: 0.4, radius: 1.2, offset: 0 },
    { pos: [5, 1, 2.5] as [number, number, number], speed: 0.35, radius: 0.8, offset: 2 },
    { pos: [3.5, 0, 2] as [number, number, number], speed: 0.45, radius: 1, offset: 4 },
    { pos: [4.5, 0.2, 3.5] as [number, number, number], speed: 0.38, radius: 0.9, offset: 1 },
  ], [isDesktop]);

  if (isMobile) {
    return (
      <>
        {configs.slice(0, 2).map((c, i) => (
          <Bee key={i} position={c.pos} speed={c.speed} radius={c.radius} offset={c.offset} />
        ))}
      </>
    );
  }

  return (
    <>
      {configs.map((c, i) => (
        <Bee key={i} position={c.pos} speed={c.speed} radius={c.radius} offset={c.offset} />
      ))}
    </>
  );
}

function MeadowGrass() {
  const grassPositions = useMemo(() => {
    const positions: { x: number; z: number; h: number; r: number }[] = [];
    for (let i = 0; i < 60; i++) {
      positions.push({
        x: (seededRandom(i * 4) - 0.5) * 16,
        z: seededRandom(i * 4 + 1) * 4 + 1,
        h: 0.2 + seededRandom(i * 4 + 2) * 0.3,
        r: (seededRandom(i * 4 + 3) - 0.5) * 0.2,
      });
    }
    return positions;
  }, []);

  const flowerPositions = useMemo(() => {
    const positions: { x: number; z: number; color: number }[] = [];
    const colors = [0xfff8e8, 0xfff4d0, 0xf8f0e0];
    for (let i = 0; i < 20; i++) {
      positions.push({
        x: (seededRandom(1000 + i * 2) - 0.5) * 14,
        z: seededRandom(1000 + i * 2 + 1) * 3 + 1.5,
        color: colors[i % 3],
      });
    }
    return positions;
  }, []);

  return (
    <group position={[0, -3.5, 3]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 15]} />
        <meshStandardMaterial color={0x6a7a4a} roughness={0.98} />
      </mesh>

      {grassPositions.map((g, i) => (
        <mesh key={`g-${i}`} position={[g.x, g.h / 2, g.z]} rotation={[g.r, 0, 0]}>
          <coneGeometry args={[0.015, g.h, 4]} />
          <meshStandardMaterial color={0x5a6a3a} roughness={0.9} />
        </mesh>
      ))}

      {flowerPositions.map((f, i) => (
        <mesh key={`f-${i}`} position={[f.x, 0.08, f.z]}>
          <sphereGeometry args={[0.03, 6, 4]} />
          <meshStandardMaterial color={f.color} roughness={0.7} emissive={f.color} emissiveIntensity={0.1} />
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
        position={[-12, 8, 6]}
        intensity={2.2}
        color={new THREE.Color(0xffecd0)}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-far={35}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <ambientLight intensity={0.25} color={new THREE.Color(0xfff0e0)} />
      <pointLight position={[-8, 2, 5]} intensity={0.6} color={new THREE.Color(0xffd090)} distance={15} />
      <hemisphereLight args={[new THREE.Color(0xffecd0), new THREE.Color(0x6a7a4a), 0.4]} />
    </>
  );
}

function DustMotes() {
  const moteRef = useRef<THREE.Points>(null);
  
  // Dust motes on left half (desktop golden glow area)
  const positions = useMemo(() => {
    const arr = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i++) {
      arr[i * 3] = seededRandom(2000 + i * 3) * 6 - 5; // x: -5 to 1 (left half)
      arr[i * 3 + 1] = seededRandom(2000 + i * 3 + 1) * 5 - 1; // y: -1 to 4
      arr[i * 3 + 2] = seededRandom(2000 + i * 3 + 2) * 4 + 1;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!moteRef.current) return;
    const posAttr = moteRef.current.geometry.getAttribute('position');
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime * 0.1;
    for (let i = 0; i < 40; i++) {
      arr[i * 3 + 1] += Math.sin(t + i) * 0.002;
      arr[i * 3] += Math.cos(t * 0.7 + i * 0.5) * 0.001;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={moteRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color={0xffd080} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function CameraSetup() {
  const { size } = useThree();
  const lastSizeRef = useRef<string>("");
  const targetRef = useRef(new THREE.Vector3(2, 0, 0));
  const basePositionRef = useRef(new THREE.Vector3(-3, 0.5, 12));

  useFrame((state) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const w = size.width;
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    const sizeKey = `${w}`;
    
    if (lastSizeRef.current !== sizeKey) {
      lastSizeRef.current = sizeKey;
      
      if (isMobile) {
        basePositionRef.current.set(-4, 0.5, 16);
        targetRef.current.set(6, -1, 0);
        cam.fov = 55;
      } else if (isTablet) {
        basePositionRef.current.set(-5, 0.5, 14);
        targetRef.current.set(5, -0.5, 0);
        cam.fov = 52;
      } else {
        // Desktop: trunk center-right, camera centered to frame hollow at ~50-60% x
        basePositionRef.current.set(0, 0.5, 12);
        targetRef.current.set(1.5, -0.5, 0);
        cam.fov = 48;
      }
      cam.position.copy(basePositionRef.current);
      cam.updateProjectionMatrix();
    }
    
    const t = state.clock.elapsedTime * 0.05;
    const bob = Math.sin(t) * 0.015;
    cam.position.y = basePositionRef.current.y + bob;
    cam.lookAt(targetRef.current);
  });

  return null;
}

function SceneContent() {
  const { size } = useThree();
  const isMobile = size.width < 768;
  
  return (
    <>
      <CameraSetup />
      <color attach="background" args={[0xf8ece0]} />
      <fog attach="fog" args={[0xf5e8d8, 6, 25]} />
      <GoldenHourLighting />
      <OakTree />
      <WoodenHive />
      <Bees />
      <MeadowGrass />
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
        className="h-full w-full object-cover"
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
    gl.toneMappingExposure = 1.1;
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
          camera={{ fov: 50, near: 0.1, far: 50 }}
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
