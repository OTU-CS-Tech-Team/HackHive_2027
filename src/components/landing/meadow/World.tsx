"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  DoubleSide,
  InstancedMesh,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
  type Side,
  type BufferGeometry,
} from "three";
import { createCardGeometry, createDaisyGeometry, createGrassGeometry, createHillsGeometry, createLilyGeometry, createLupinGeometry, createSparkPoints } from "@/components/landing/meadow/geometry";
import {
  CLOUD_FRAG,
  CLOUD_VERT,
  GLOW_FRAG,
  GLOW_VERT,
  GROUND_FRAG,
  GROUND_VERT,
  HILL_FRAG,
  LUPIN_FRAG,
  LUPIN_VERT,
  PLANT_FRAG,
  PLANT_VERT,
  SPARK_FRAG,
  SPARK_VERT,
  SKY_FRAG,
  SKY_VERT,
} from "@/components/landing/meadow/glsl";
import { buildLayout, type Scatter, type SceneLayout } from "@/components/landing/meadow/layout";
import {
  AMBIENT,
  FOG_DENSITY,
  GRASS_FAR,
  GRASS_NEAR,
  FOREST,
  HANDOFF,
  HORIZON,
  PATH,
  PATH_EDGE,
  SKY_MID,
  SKY_TOP,
  SUN,
  SUN_DIR,
  VIEW,
  fogDensityFor,
  handoffVeil,
  hexToRgb,
  windScale,
} from "@/components/landing/meadow/palette";
import { SKY_SEGMENTS } from "@/components/landing/meadow/stats";
import type { Quality } from "@/components/landing/meadow/quality";

const FULL_COUNT = "fullCount";
const KIND = "meadowKind";
/** His veil is clear, then tan, then solid white at progress 0.9. */
const VEIL_HOLD = 0.9;
const liveMeshes: InstancedMesh[] = [];
const livePoints: BufferGeometry[] = [];

function thinEvenly() {
  for (const mesh of liveMeshes) {
    const full = Number(mesh.userData[FULL_COUNT] ?? mesh.count);
    mesh.count = Math.min(full, Math.max(4, Math.floor(full * 0.5)));
  }
  for (const geometry of livePoints) {
    const full = geometry.getAttribute("position").count;
    geometry.setDrawRange(0, Math.max(8, Math.floor(full * 0.5)));
  }
}

function thinFurther() {
  for (const mesh of liveMeshes) {
    if (mesh.userData[KIND] !== "grass") continue;
    const full = Number(mesh.userData[FULL_COUNT] ?? mesh.count);
    mesh.count = Math.min(full, Math.max(4, Math.floor(full * 0.25)));
  }
  for (const geometry of livePoints) {
    const full = geometry.getAttribute("position").count;
    geometry.setDrawRange(0, Math.max(8, Math.floor(full * 0.25)));
  }
}

function writeUniforms(
  materials: ShaderMaterial[] | null,
  time: number,
  wind: number,
  veil: number,
  fog: number,
  x: number,
  y: number,
  z: number,
  aspect: number,
  spread: number,
) {
  if (!materials) return;
  for (const material of materials) {
    material.uniforms.uTime.value = time;
    material.uniforms.uWind.value = wind;
    material.uniforms.uVeil.value = veil;
    material.uniforms.uFogDensity.value = fog;
    material.uniforms.uCamPos.value.set(x, y, z);
    if (material.uniforms.uAspect) material.uniforms.uAspect.value = aspect;
    if (material.uniforms.uSpread) material.uniforms.uSpread.value = spread;
  }
}

function colorOf(hex: string) {
  return new Vector3(...hexToRgb(hex));
}

function baseUniforms() {
  return {
    uSunDir: { value: new Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize() },
    uSunColor: { value: colorOf(SUN) },
    uHorizon: { value: colorOf(HORIZON) },
    uForest: { value: colorOf(FOREST) },
    uHandoff: { value: colorOf(HANDOFF) },
    uSkyTop: { value: colorOf(SKY_TOP) },
    uSkyMid: { value: colorOf(SKY_MID) },
    uAmbient: { value: colorOf(AMBIENT) },
    uCamPos: { value: new Vector3() },
    uTime: { value: 0 },
    uWind: { value: 1 },
    uVeil: { value: 0 },
    uFogDensity: { value: FOG_DENSITY },
  };
}

function plantMaterial(
  sss: number,
  emissive: [number, number, number],
  side: Side = DoubleSide,
  rim = 0,
  soft = false,
) {
  return new ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uSss: { value: sss },
      uRim: { value: rim },
      uEmissive: { value: new Vector3(...emissive) },
      uAspect: { value: 1.6 },
    },
    vertexShader: PLANT_VERT,
    fragmentShader: PLANT_FRAG,
    vertexColors: true,
    side,
    transparent: soft,
    depthWrite: true,
    alphaToCoverage: soft,
  });
}

type Materials = {
  all: ShaderMaterial[];
  sky: ShaderMaterial;
  ground: ShaderMaterial;
  hill: ShaderMaterial;
  grass: ShaderMaterial;
  lily: ShaderMaterial;
  daisy: ShaderMaterial;
  lupin: ShaderMaterial;
  cloud: ShaderMaterial;
  glow: ShaderMaterial;
  spark: ShaderMaterial;
};

function buildMaterials(): Materials {
  const sky = new ShaderMaterial({
    uniforms: baseUniforms(),
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: BackSide,
    depthWrite: false,
  });
  const ground = new ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uGrassNear: { value: colorOf(GRASS_NEAR) },
      uGrassFar: { value: colorOf(GRASS_FAR) },
      uPath: { value: colorOf(PATH) },
      uPathEdge: { value: colorOf(PATH_EDGE) },
      uAspect: { value: 1.6 },
    },
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
  });
  const hill = new ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uGrassNear: { value: colorOf(GRASS_NEAR) },
      uGrassFar: { value: colorOf(GRASS_FAR) },
    },
    vertexShader: PLANT_VERT,
    fragmentShader: HILL_FRAG,
    vertexColors: true,
    side: DoubleSide,
  });
  const grass = plantMaterial(0.08, [0, 0, 0], DoubleSide, 0, true);
  const lily = plantMaterial(0.92, [1, 0.98, 0.94], DoubleSide, 0.34, true);
  const daisy = plantMaterial(0.45, [0.08, 0.07, 0.04]);
  const lupin = new ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uAspect: { value: 1.6 },
      uRim: { value: 0.22 },
    },
    vertexShader: LUPIN_VERT,
    fragmentShader: LUPIN_FRAG,
    vertexColors: true,
    side: DoubleSide,
  });
  const cloud = new ShaderMaterial({
    uniforms: baseUniforms(),
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const glow = new ShaderMaterial({
    uniforms: baseUniforms(),
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const spark = new ShaderMaterial({
    uniforms: baseUniforms(),
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return {
    sky,
    ground,
    hill,
    grass,
    lily,
    daisy,
    lupin,
    cloud,
    glow,
    spark,
    all: [sky, ground, hill, grass, lily, daisy, lupin, cloud, glow, spark],
  };
}

function buildGeometries(layout: SceneLayout) {
  return {
    patches: layout.patches.map((patch) => ({
      grass: createGrassGeometry(patch.grass),
      lilies: createLilyGeometry(patch.lilies),
      daisies: createDaisyGeometry(patch.daisies),
      lupins: createLupinGeometry(patch.lupins),
    })),
    hills: createHillsGeometry(),
    clouds: createCardGeometry(layout.clouds),
    glows: createCardGeometry(layout.glows),
    sparks: createSparkPoints(layout.sparks),
  };
}

function Instances({
  geometry,
  material,
  scatter,
  renderOrder = 0,
  kind = "",
}: {
  geometry: BufferGeometry;
  material: ShaderMaterial;
  scatter: Scatter;
  renderOrder?: number;
  kind?: string;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || scatter.count === 0) return;
    mesh.count = scatter.count;
    mesh.instanceMatrix.array.set(scatter.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData[FULL_COUNT] = scatter.count;
    mesh.userData[KIND] = kind;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = true;
    if (!liveMeshes.includes(mesh)) liveMeshes.push(mesh);
    return () => {
      const index = liveMeshes.indexOf(mesh);
      if (index >= 0) liveMeshes.splice(index, 1);
    };
  }, [kind, scatter]);
  if (scatter.count === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, scatter.count]}
      frustumCulled
      renderOrder={renderOrder}
    />
  );
}

function SparkPoints({ geometry, material }: { geometry: BufferGeometry; material: ShaderMaterial }) {
  const ref = useRef<Points>(null);
  useLayoutEffect(() => {
    if (!livePoints.includes(geometry)) livePoints.push(geometry);
    return () => {
      const index = livePoints.indexOf(geometry);
      if (index >= 0) livePoints.splice(index, 1);
    };
  }, [geometry]);
  if (geometry.getAttribute("position").count === 0) return null;
  return (
    <points ref={ref} geometry={geometry} frustumCulled={false} renderOrder={2}>
      <primitive object={material} attach="material" />
    </points>
  );
}

function FrameDriver({
  materialsRef,
  sky,
  progress,
  pointer,
  reduced,
  onReady,
  onDone,
}: {
  materialsRef: RefObject<ShaderMaterial[]>;
  sky: RefObject<Mesh | null>;
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
  onReady?: () => void;
  onDone: (settled: boolean) => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const eased = useRef({ x: 0, y: 0, snapped: false });
  const clock = useRef(0);
  const frames = useRef(0);
  const ready = useRef(false);
  const settled = useRef(false);
  const perf = useRef({ warm: 0, hot: 0, dropped: false, trimmed: false });
  const reducedRef = useRef(reduced);
  const onReadyRef = useRef(onReady);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    reducedRef.current = reduced;
    onReadyRef.current = onReady;
    onDoneRef.current = onDone;
  }, [onDone, onReady, reduced]);

  useEffect(() => {
    let lastP = Number.NaN;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    const tick = () => {
      const walked = progress.current ?? 0;
      const aim = pointer.current ?? { x: 0, y: 0 };
      if (settled.current && walked < VEIL_HOLD) {
        settled.current = false;
        onDoneRef.current(false);
      }
      if (!reducedRef.current) return;
      if (walked !== lastP || aim.x !== lastX || aim.y !== lastY) {
        lastP = walked;
        lastX = aim.x;
        lastY = aim.y;
        invalidate();
      }
    };
    tick();
    const id = window.setInterval(tick, 48);
    return () => window.clearInterval(id);
  }, [invalidate, pointer, progress]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    const frameMs = Math.min(delta, 0.25);
    const walked = progress.current ?? 0;
    const t = walked;
    const aim = pointer.current ?? { x: 0, y: 0 };
    const still = reducedRef.current;
    if (!eased.current.snapped || still) {
      eased.current.x = aim.x;
      eased.current.y = aim.y;
      eased.current.snapped = true;
    } else {
      const ease = 1 - Math.exp(-3.2 * step);
      eased.current.x += (aim.x - eased.current.x) * ease;
      eased.current.y += (aim.y - eased.current.y) * ease;
    }
    const canvas = gl.domElement;
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    const portrait = aspect < 0.85 ? 1 : 0;
    const x = eased.current.x * 0.22;
    const y = VIEW.eye + t * 0.04 + portrait * 0.72;
    const z = VIEW.startZ + (VIEW.endZ - VIEW.startZ) * t;
    camera.position.set(x, y, z);
    camera.lookAt(
      eased.current.x * 0.45,
      VIEW.eye + VIEW.lookLift - portrait * 0.78 - eased.current.y * 0.1,
      z - VIEW.lookAhead,
    );
    if (sky.current) sky.current.position.set(x, y, z);
    if (!still) clock.current += step;
    writeUniforms(
      materialsRef.current,
      clock.current,
      windScale(walked, still),
      handoffVeil(walked),
      fogDensityFor(walked),
      x,
      y,
      z,
      aspect,
      portrait,
    );

    const done = walked >= VEIL_HOLD;
    if (done !== settled.current) {
      settled.current = done;
      onDoneRef.current(done);
    }

    const stats = perf.current;
    if (!stats.trimmed) {
      stats.warm += 1;
      if (stats.warm > 1 && frameMs > 0.018) stats.hot += 1;
      if (!stats.dropped && stats.hot >= 3) {
        stats.dropped = true;
        stats.hot = 0;
        stats.warm = 0;
        thinEvenly();
        gl.setPixelRatio(1);
      } else if (stats.dropped && stats.hot >= 3) {
        stats.trimmed = true;
        thinFurther();
        gl.setPixelRatio(0.85);
      }
    }

    frames.current += 1;
    if (!ready.current && frames.current >= 2) {
      ready.current = true;
      onReadyRef.current?.();
    } else if (frames.current < 2) {
      invalidate();
    }
  });

  return null;
}

export default function MeadowWorld({
  quality,
  progress,
  pointer,
  reduced,
  onReady,
  onDone,
}: {
  quality: Quality;
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
  onReady?: () => void;
  onDone: (settled: boolean) => void;
}) {
  const layout = useMemo(() => buildLayout(quality), [quality]);
  const geometries = useMemo(() => buildGeometries(layout), [layout]);
  const materials = useMemo(() => buildMaterials(), []);
  const materialsRef = useRef(materials.all);
  const sky = useRef<Mesh>(null);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    materialsRef.current = materials.all;
  }, [materials]);

  useLayoutEffect(() => {
    gl.compile(scene, camera);
  }, [camera, geometries, gl, scene]);

  return (
    <>
      <FrameDriver
        materialsRef={materialsRef}
        sky={sky}
        progress={progress}
        pointer={pointer}
        reduced={reduced}
        onReady={onReady}
        onDone={onDone}
      />
      <mesh ref={sky} frustumCulled={false} renderOrder={-2}>
        <sphereGeometry args={[48, SKY_SEGMENTS[0], SKY_SEGMENTS[1]]} />
        <primitive object={materials.sky} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} frustumCulled={false}>
        <planeGeometry args={[160, 200, 1, 1]} />
        <primitive object={materials.ground} attach="material" />
      </mesh>
      <mesh geometry={geometries.hills} frustumCulled={false}>
        <primitive object={materials.hill} attach="material" />
      </mesh>
      {geometries.patches.map((patch, index) => {
        const scatter = layout.patches[index];
        if (!scatter) return null;
        return (
          <group key={index}>
            <Instances geometry={patch.grass} material={materials.grass} scatter={scatter.grass} kind="grass" />
            <Instances geometry={patch.lilies} material={materials.lily} scatter={scatter.lilies} />
            <Instances geometry={patch.daisies} material={materials.daisy} scatter={scatter.daisies} />
            <Instances geometry={patch.lupins} material={materials.lupin} scatter={scatter.lupins} />
          </group>
        );
      })}
      <Instances geometry={geometries.clouds} material={materials.cloud} scatter={layout.clouds} renderOrder={1} />
      <SparkPoints geometry={geometries.sparks} material={materials.spark} />
      <Instances geometry={geometries.glows} material={materials.glow} scatter={layout.glows} renderOrder={3} />
    </>
  );
}
