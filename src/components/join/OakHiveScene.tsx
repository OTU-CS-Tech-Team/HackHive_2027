"use client";

import { Component, useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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

function OakTrunk() {
  const trunkGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.8, 1.4, 6, 16, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const wiggle = Math.sin(y * 2) * 0.1 + Math.sin(y * 5) * 0.05;
      pos.setX(i, pos.getX(i) + wiggle);
      pos.setZ(i, pos.getZ(i) + Math.cos(y * 3) * 0.05);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const trunkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x5c4033),
        roughness: 0.95,
        metalness: 0,
      }),
    []
  );

  return (
    <mesh geometry={trunkGeometry} material={trunkMaterial} castShadow receiveShadow />
  );
}

function OakBranches() {
  const branchMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x4a3728),
        roughness: 0.9,
        metalness: 0,
      }),
    []
  );

  const branches = useMemo(() => {
    return [
      { pos: [0.6, 1.8, 0.3] as const, rot: [0.3, 0.5, 0.8] as const, length: 2.5, radius: 0.15 },
      { pos: [-0.3, 2.2, -0.2] as const, rot: [-0.2, -0.3, -0.6] as const, length: 2, radius: 0.12 },
      { pos: [0.4, 2.5, -0.4] as const, rot: [-0.4, 0.2, 0.5] as const, length: 1.8, radius: 0.1 },
      { pos: [-0.5, 1.5, 0.5] as const, rot: [0.5, -0.4, -0.7] as const, length: 2.2, radius: 0.13 },
      { pos: [0.2, 2.8, 0.1] as const, rot: [0.1, 0.6, 0.3] as const, length: 1.5, radius: 0.08 },
    ];
  }, []);

  return (
    <group>
      {branches.map((b, i) => (
        <mesh
          key={i}
          position={[b.pos[0], b.pos[1], b.pos[2]]}
          rotation={[b.rot[0], b.rot[1], b.rot[2]]}
          material={branchMaterial}
          castShadow
        >
          <cylinderGeometry args={[b.radius * 0.6, b.radius, b.length, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function OakFoliage() {
  const foliageMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x3d6b35),
        roughness: 0.85,
        metalness: 0,
      }),
    []
  );

  const foliageLightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x5a8a4f),
        roughness: 0.8,
        metalness: 0,
      }),
    []
  );

  const clusters = useMemo(() => [
    { pos: [0, 4, 0] as const, scale: 2.5, mat: foliageMaterial },
    { pos: [1.5, 3.5, 0.5] as const, scale: 1.8, mat: foliageLightMaterial },
    { pos: [-1.2, 3.8, -0.3] as const, scale: 1.6, mat: foliageMaterial },
    { pos: [0.8, 4.5, -0.5] as const, scale: 1.4, mat: foliageLightMaterial },
    { pos: [-0.5, 4.2, 0.8] as const, scale: 1.5, mat: foliageMaterial },
    { pos: [2, 3, 0] as const, scale: 1.2, mat: foliageLightMaterial },
    { pos: [-1.8, 3.2, 0.5] as const, scale: 1.3, mat: foliageMaterial },
    { pos: [0.3, 5, 0.2] as const, scale: 1.1, mat: foliageLightMaterial },
  ], [foliageMaterial, foliageLightMaterial]);

  return (
    <group>
      {clusters.map((c, i) => (
        <mesh
          key={i}
          position={[c.pos[0], c.pos[1], c.pos[2]]}
          scale={c.scale}
          material={c.mat}
          castShadow
        >
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function OakTree() {
  return (
    <group position={[3.5, -2, -1]}>
      <OakTrunk />
      <OakBranches />
      <OakFoliage />
    </group>
  );
}

function BirdhouseHive() {
  const woodMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xc4a35a),
        roughness: 0.85,
        metalness: 0.05,
      }),
    []
  );

  const roofMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8b6914),
        roughness: 0.9,
        metalness: 0.05,
      }),
    []
  );

  const ropeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x8b7355),
        roughness: 1,
        metalness: 0,
      }),
    []
  );

  const entranceMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x1a1408),
        roughness: 1,
        metalness: 0,
      }),
    []
  );

  return (
    <Float speed={0.8} rotationIntensity={0.02} floatIntensity={0.15}>
      <group position={[4.5, 1.5, 1.5]}>
        {/* Ropes */}
        <mesh position={[-0.2, 0.9, 0]} material={ropeMaterial}>
          <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
        </mesh>
        <mesh position={[0.2, 0.9, 0]} material={ropeMaterial}>
          <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
        </mesh>

        {/* Main body */}
        <mesh position={[0, 0, 0]} material={woodMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.8, 0.5]} />
        </mesh>

        {/* Roof */}
        <group position={[0, 0.55, 0]}>
          <mesh material={roofMaterial} castShadow>
            <boxGeometry args={[0.85, 0.08, 0.6]} />
          </mesh>
          <mesh position={[0, 0.15, 0]} rotation={[0, 0, 0]} material={roofMaterial} castShadow>
            <coneGeometry args={[0.55, 0.35, 4]} />
          </mesh>
        </group>

        {/* Landing perch */}
        <mesh position={[0.35, -0.15, 0.25]} rotation={[0, 0, Math.PI / 2]} material={woodMaterial}>
          <cylinderGeometry args={[0.03, 0.03, 0.15, 6]} />
        </mesh>

        {/* Entrance hole */}
        <mesh position={[0.351, 0.05, 0]} rotation={[0, Math.PI / 2, 0]} material={entranceMaterial}>
          <circleGeometry args={[0.1, 16]} />
        </mesh>

        {/* Sitting bee on perch */}
        <group position={[0.42, -0.1, 0.25]} scale={0.4}>
          <mesh>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color={0xf4c430} roughness={0.6} />
          </mesh>
          <mesh position={[0.02, 0, 0]}>
            <torusGeometry args={[0.09, 0.02, 6, 12]} />
            <meshStandardMaterial color={0x1a1a1a} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </Float>
  );
}

function FlyingBee({ 
  initialPosition, 
  speed = 1,
  pathRadius = 0.5,
  timeOffset = 0,
  showTrail = true
}: { 
  initialPosition: [number, number, number]; 
  speed?: number;
  pathRadius?: number;
  timeOffset?: number;
  showTrail?: boolean;
}) {
  const beeRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);
  const trailBufferRef = useRef<Float32Array | null>(null);
  const trailIndexRef = useRef(0);

  useFrame((state) => {
    if (!beeRef.current) return;
    const t = state.clock.elapsedTime * speed + timeOffset;
    
    const x = initialPosition[0] + Math.sin(t) * pathRadius;
    const y = initialPosition[1] + Math.sin(t * 1.5) * (pathRadius * 0.4);
    const z = initialPosition[2] + Math.cos(t * 0.7) * pathRadius;
    
    beeRef.current.position.set(x, y, z);
    beeRef.current.rotation.y = Math.atan2(
      Math.cos(t) * pathRadius,
      -Math.sin(t * 0.7) * pathRadius
    );

    if (showTrail && trailRef.current) {
      const geo = trailRef.current.geometry;
      const posAttr = geo.getAttribute('position');
      if (posAttr) {
        if (!trailBufferRef.current) {
          trailBufferRef.current = posAttr.array as Float32Array;
        }
        const buffer = trailBufferRef.current;
        const idx = (trailIndexRef.current % 10) * 3;
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
      <group ref={beeRef} position={initialPosition} scale={0.6}>
        {/* Body */}
        <mesh scale={[1.2, 1, 1]}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color={0xf4c430} roughness={0.6} metalness={0.1} />
        </mesh>
        {/* Stripes */}
        <mesh position={[0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.075, 0.018, 6, 12]} />
          <meshStandardMaterial color={0x1a1a1a} roughness={0.7} />
        </mesh>
        <mesh position={[-0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.07, 0.015, 6, 12]} />
          <meshStandardMaterial color={0x1a1a1a} roughness={0.7} />
        </mesh>
        {/* Wings */}
        <mesh position={[0, 0.05, 0.03]} scale={[0.5, 0.2, 0.8]}>
          <sphereGeometry args={[0.06, 6, 4]} />
          <meshStandardMaterial color={0xffffff} roughness={0.2} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, 0.05, -0.03]} scale={[0.5, 0.2, 0.8]}>
          <sphereGeometry args={[0.06, 6, 4]} />
          <meshStandardMaterial color={0xffffff} roughness={0.2} transparent opacity={0.5} />
        </mesh>
      </group>
      {showTrail && (
        <points ref={trailRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(30), 3]}
            />
          </bufferGeometry>
          <pointsMaterial size={0.03} color={0x888866} transparent opacity={0.4} sizeAttenuation />
        </points>
      )}
    </>
  );
}

function Bees({ showTrails = true }: { showTrails?: boolean }) {
  const beeConfigs = useMemo(() => [
    { pos: [1.5, 0.5, 1.5] as [number, number, number], speed: 0.6, radius: 0.8, offset: 0 },
    { pos: [0.5, 0, 1.2] as [number, number, number], speed: 0.5, radius: 0.6, offset: 2.1 },
    { pos: [2, 1, 0.5] as [number, number, number], speed: 0.7, radius: 0.5, offset: 4.2 },
    { pos: [-0.5, -0.5, 1] as [number, number, number], speed: 0.55, radius: 0.7, offset: 1.5 },
  ], []);

  return (
    <>
      {beeConfigs.map((config, i) => (
        <FlyingBee 
          key={i} 
          initialPosition={config.pos} 
          speed={config.speed}
          pathRadius={config.radius}
          timeOffset={config.offset}
          showTrail={showTrails}
        />
      ))}
    </>
  );
}

const FLOWERS = [
  { x: -5.2, z: 1.3, color: 0xffffff, scale: 0.045 },
  { x: -3.8, z: 2.1, color: 0xffeb99, scale: 0.038 },
  { x: -2.1, z: 1.7, color: 0xffb6c1, scale: 0.052 },
  { x: -0.5, z: 2.8, color: 0xe6e6fa, scale: 0.041 },
  { x: 0.8, z: 1.4, color: 0xffffff, scale: 0.048 },
  { x: 2.3, z: 2.5, color: 0xffeb99, scale: 0.035 },
  { x: 3.6, z: 1.9, color: 0xffb6c1, scale: 0.055 },
  { x: 4.8, z: 2.2, color: 0xe6e6fa, scale: 0.042 },
  { x: -4.5, z: 3.2, color: 0xffffff, scale: 0.039 },
  { x: -2.8, z: 3.8, color: 0xffeb99, scale: 0.047 },
  { x: -1.2, z: 3.4, color: 0xffb6c1, scale: 0.036 },
  { x: 0.2, z: 4.1, color: 0xe6e6fa, scale: 0.051 },
  { x: 1.5, z: 3.6, color: 0xffffff, scale: 0.044 },
  { x: 3.1, z: 4.3, color: 0xffeb99, scale: 0.038 },
  { x: 4.2, z: 3.1, color: 0xffb6c1, scale: 0.053 },
  { x: 5.5, z: 3.7, color: 0xe6e6fa, scale: 0.040 },
  { x: -5.8, z: 2.6, color: 0xffffff, scale: 0.046 },
  { x: -4.1, z: 4.5, color: 0xffeb99, scale: 0.037 },
  { x: -2.5, z: 2.9, color: 0xffb6c1, scale: 0.049 },
  { x: -0.9, z: 4.8, color: 0xe6e6fa, scale: 0.043 },
  { x: 0.6, z: 3.2, color: 0xffffff, scale: 0.054 },
  { x: 2.0, z: 4.6, color: 0xffeb99, scale: 0.041 },
  { x: 3.4, z: 2.4, color: 0xffb6c1, scale: 0.048 },
  { x: 5.1, z: 4.9, color: 0xe6e6fa, scale: 0.035 },
  { x: -3.2, z: 1.1, color: 0xffffff, scale: 0.050 },
  { x: -1.6, z: 4.2, color: 0xffeb99, scale: 0.039 },
  { x: 1.1, z: 2.0, color: 0xffb6c1, scale: 0.045 },
  { x: 2.7, z: 3.9, color: 0xe6e6fa, scale: 0.052 },
  { x: 4.5, z: 1.6, color: 0xffffff, scale: 0.038 },
  { x: -5.5, z: 3.9, color: 0xffeb99, scale: 0.047 },
  { x: -0.2, z: 1.8, color: 0xffb6c1, scale: 0.042 },
  { x: 1.8, z: 4.4, color: 0xe6e6fa, scale: 0.036 },
  { x: 3.9, z: 2.8, color: 0xffffff, scale: 0.051 },
  { x: 5.8, z: 4.2, color: 0xffeb99, scale: 0.044 },
  { x: -4.8, z: 4.8, color: 0xffb6c1, scale: 0.040 },
  { x: -2.2, z: 1.5, color: 0xe6e6fa, scale: 0.055 },
  { x: 0.4, z: 3.8, color: 0xffffff, scale: 0.037 },
  { x: 2.5, z: 1.2, color: 0xffeb99, scale: 0.049 },
  { x: 4.0, z: 4.6, color: 0xffb6c1, scale: 0.043 },
  { x: -3.5, z: 2.4, color: 0xe6e6fa, scale: 0.046 },
];

const GRASS_BLADES = [
  { x: -6.2, z: 1.1, height: 0.22, rotation: 0.08 },
  { x: -5.1, z: 0.8, height: 0.18, rotation: -0.12 },
  { x: -4.3, z: 1.4, height: 0.25, rotation: 0.05 },
  { x: -3.5, z: 0.9, height: 0.20, rotation: -0.08 },
  { x: -2.8, z: 1.6, height: 0.17, rotation: 0.11 },
  { x: -2.0, z: 1.0, height: 0.23, rotation: -0.06 },
  { x: -1.2, z: 1.3, height: 0.19, rotation: 0.09 },
  { x: -0.4, z: 0.7, height: 0.21, rotation: -0.10 },
  { x: 0.3, z: 1.5, height: 0.16, rotation: 0.07 },
  { x: 1.1, z: 0.9, height: 0.24, rotation: -0.04 },
  { x: 1.9, z: 1.2, height: 0.18, rotation: 0.12 },
  { x: 2.7, z: 0.8, height: 0.22, rotation: -0.09 },
  { x: 3.4, z: 1.4, height: 0.20, rotation: 0.06 },
  { x: 4.2, z: 1.0, height: 0.17, rotation: -0.11 },
  { x: 5.0, z: 1.3, height: 0.25, rotation: 0.08 },
  { x: 5.8, z: 0.7, height: 0.19, rotation: -0.05 },
  { x: 6.5, z: 1.5, height: 0.21, rotation: 0.10 },
  { x: -5.7, z: 2.2, height: 0.23, rotation: -0.07 },
  { x: -4.8, z: 2.8, height: 0.16, rotation: 0.04 },
  { x: -3.9, z: 2.1, height: 0.20, rotation: -0.12 },
  { x: -3.1, z: 2.6, height: 0.24, rotation: 0.09 },
  { x: -2.3, z: 2.3, height: 0.18, rotation: -0.06 },
  { x: -1.5, z: 2.9, height: 0.22, rotation: 0.11 },
  { x: -0.7, z: 2.0, height: 0.17, rotation: -0.08 },
  { x: 0.1, z: 2.7, height: 0.25, rotation: 0.05 },
  { x: 0.9, z: 2.4, height: 0.19, rotation: -0.10 },
  { x: 1.6, z: 2.1, height: 0.21, rotation: 0.07 },
  { x: 2.4, z: 2.8, height: 0.16, rotation: -0.04 },
  { x: 3.2, z: 2.3, height: 0.23, rotation: 0.12 },
  { x: 4.0, z: 2.6, height: 0.20, rotation: -0.09 },
  { x: 4.7, z: 2.0, height: 0.18, rotation: 0.06 },
  { x: 5.5, z: 2.9, height: 0.24, rotation: -0.11 },
  { x: 6.2, z: 2.2, height: 0.17, rotation: 0.08 },
  { x: -6.0, z: 3.5, height: 0.22, rotation: -0.05 },
  { x: -5.2, z: 3.1, height: 0.19, rotation: 0.10 },
  { x: -4.4, z: 3.8, height: 0.25, rotation: -0.07 },
  { x: -3.6, z: 3.3, height: 0.16, rotation: 0.04 },
  { x: -2.8, z: 3.9, height: 0.21, rotation: -0.12 },
  { x: -2.0, z: 3.4, height: 0.23, rotation: 0.09 },
  { x: -1.2, z: 3.7, height: 0.18, rotation: -0.06 },
  { x: -0.4, z: 3.2, height: 0.20, rotation: 0.11 },
  { x: 0.4, z: 3.6, height: 0.24, rotation: -0.08 },
  { x: 1.2, z: 3.0, height: 0.17, rotation: 0.05 },
  { x: 2.0, z: 3.8, height: 0.22, rotation: -0.10 },
  { x: 2.8, z: 3.4, height: 0.19, rotation: 0.07 },
  { x: 3.5, z: 3.1, height: 0.25, rotation: -0.04 },
  { x: 4.3, z: 3.7, height: 0.16, rotation: 0.12 },
  { x: 5.1, z: 3.3, height: 0.21, rotation: -0.09 },
  { x: 5.9, z: 3.9, height: 0.23, rotation: 0.06 },
  { x: 6.6, z: 3.5, height: 0.18, rotation: -0.11 },
  { x: -5.5, z: 4.2, height: 0.20, rotation: 0.08 },
  { x: -4.6, z: 4.7, height: 0.24, rotation: -0.05 },
  { x: -3.8, z: 4.4, height: 0.17, rotation: 0.10 },
  { x: -3.0, z: 4.9, height: 0.22, rotation: -0.07 },
  { x: -2.2, z: 4.1, height: 0.19, rotation: 0.04 },
  { x: -1.4, z: 4.6, height: 0.25, rotation: -0.12 },
  { x: -0.6, z: 4.3, height: 0.16, rotation: 0.09 },
  { x: 0.2, z: 4.8, height: 0.21, rotation: -0.06 },
  { x: 1.0, z: 4.5, height: 0.23, rotation: 0.11 },
  { x: 1.8, z: 4.0, height: 0.18, rotation: -0.08 },
];

function Meadow() {
  const grassMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x7a9a5a),
        roughness: 0.9,
        metalness: 0,
      }),
    []
  );

  return (
    <group position={[0, -3.5, 2]}>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color={0x8fbc6a} roughness={0.95} />
      </mesh>

      {/* Grass blades */}
      {GRASS_BLADES.map((blade, i) => (
        <mesh
          key={`grass-${i}`}
          position={[blade.x, blade.height / 2, blade.z]}
          rotation={[blade.rotation, 0, 0]}
          material={grassMaterial}
        >
          <coneGeometry args={[0.02, blade.height, 4]} />
        </mesh>
      ))}

      {/* Wildflowers */}
      {FLOWERS.map((flower, i) => (
        <mesh key={`flower-${i}`} position={[flower.x, 0.05, flower.z]}>
          <sphereGeometry args={[flower.scale, 6, 4]} />
          <meshStandardMaterial color={flower.color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function GoldenLighting() {
  return (
    <>
      {/* Main warm sunlight from left */}
      <directionalLight
        position={[-8, 10, 5]}
        intensity={2}
        color={new THREE.Color(0xffd89b)}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={25}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.001}
      />
      {/* Soft ambient */}
      <ambientLight intensity={0.5} color={new THREE.Color(0xfff5e6)} />
      {/* Back rim */}
      <pointLight position={[5, 5, -5]} intensity={0.4} color={new THREE.Color(0xffe4b5)} />
      {/* Sky/ground colors */}
      <hemisphereLight
        args={[new THREE.Color(0xffecd2), new THREE.Color(0x8fbc6a), 0.4]}
      />
    </>
  );
}

function CameraController({ isPaused, isMobile, isTablet }: { isPaused: boolean; isMobile: boolean; isTablet: boolean }) {
  useFrame((state) => {
    const cam = state.camera;
    
    if (isMobile) {
      cam.position.x = -2;
      cam.position.z = 10;
      cam.lookAt(2, 0.5, 0);
    } else if (isTablet) {
      cam.position.x = -2.5;
      cam.position.z = 10;
      cam.lookAt(2, 0.5, 0);
    } else {
      cam.position.x = -3;
      cam.position.z = 11;
      cam.lookAt(1.5, 0.5, 0);
    }

    if (!isPaused) {
      const t = state.clock.elapsedTime * 0.08;
      const bobAmount = Math.sin(t) * 0.03;
      cam.position.y = (isMobile ? 0.8 : isTablet ? 0.8 : 0.8) + bobAmount;
    } else {
      cam.position.y = isMobile ? 0.8 : isTablet ? 0.8 : 0.8;
    }
  });

  return null;
}

function Scene({ isPaused, isMobile, isTablet }: { isPaused: boolean; isMobile: boolean; isTablet: boolean }) {
  return (
    <>
      <CameraController isPaused={isPaused} isMobile={isMobile} isTablet={isTablet} />
      <GoldenLighting />
      <color attach="background" args={[0xfdf6e9]} />
      <fog attach="fog" args={[0xfff8f0, 6, 20]} />
      <OakTree />
      <BirdhouseHive />
      <Bees showTrails={!isMobile} />
      <Meadow />
    </>
  );
}

function FallbackImage() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
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
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    const checkSize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      
      if (checkShouldUseFallback()) {
        setWebglSupported(false);
        setSceneState("fallback");
        return;
      }
      
      const canCreate = canCreateWebGLContext();
      setWebglSupported(canCreate);
      if (!canCreate) {
        setSceneState("fallback");
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleCreated = useCallback(() => {
    setSceneState("ready");
  }, []);

  const handleError = useCallback(() => {
    setSceneState("fallback");
  }, []);

  useEffect(() => {
    if (sceneState !== "ready" || !isVisible) return;

    let frameId: number;
    let lowPerfCount = 0;

    const checkPerformance = (time: number) => {
      frameTimesRef.current.push(time);
      if (frameTimesRef.current.length > 30) {
        frameTimesRef.current.shift();
      }

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

  if (webglSupported === null) {
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
          <Scene isPaused={isPaused} isMobile={isMobile} isTablet={isTablet} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
