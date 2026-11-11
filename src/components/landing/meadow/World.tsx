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
  type Object3D,
} from "three";
import { createCardGeometry, createDaisyGeometry, createGrassGeometry, createHillsGeometry, createLilyGeometry, createLupinGeometry, createSparkPoints, createTrunkGeometry } from "@/components/landing/meadow/geometry";
import {
  BARK_FRAG,
  BARK_VERT,
  BLOSSOM_FRAG,
  BLOSSOM_VERT,
  CLOUD_FRAG,
  CLOUD_VERT,
  GLOW_FRAG,
  GLOW_VERT,
  GROUND_FRAG,
  GROUND_VERT,
  HILL_FRAG,
  HILL_VERT,
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
import { TREE } from "@/components/landing/meadow/tree";
import { readForcedTrim, trimmedInstances, trimmedSparks, type TrimKind } from "@/components/landing/meadow/trim";
import { readForcedDpr, type Quality } from "@/components/landing/meadow/quality";
import { descentAmount, introPlaying, reportIntroProgress, rushDescent } from "@/components/landing/intro/introBus";

/**
 * Where the first-load descent starts, added to the hero pose: up above
 * the near clouds, a step back, looking down over them. Kept modest so the
 * planted meadow still fills the frame at the start.
 */
const INTRO_POSE = { rise: 3.4, back: 1.2, lookRise: 2.6 } as const;

const FULL_COUNT = "fullCount";
const KIND = "meadowKind";
/** The loop parks past this. The homepage walk stops well short of it (WALK_END). */
const VEIL_HOLD = 0.9;
const liveMeshes: InstancedMesh[] = [];
const livePoints: BufferGeometry[] = [];

function kindOf(value: unknown): TrimKind {
  if (value === "grass" || value === "flower" || value === "mid" || value === "far" || value === "tree") return value;
  return "other";
}

function applyTrim(level: 1 | 2 | 3) {
  for (const mesh of liveMeshes) {
    const full = Number(mesh.userData[FULL_COUNT] ?? mesh.count);
    const kind = kindOf(mesh.userData[KIND]);
    if (kind === "tree") {
      const canopy = Number(mesh.userData.canopy ?? full);
      const petals = Math.max(0, full - canopy);
      const kept = level >= 3 ? Math.floor(petals * 0.35) : petals;
      mesh.count = Math.min(full, canopy + kept);
      continue;
    }
    mesh.count = trimmedInstances(full, kind, level);
  }
  for (const geometry of livePoints) {
    const full = geometry.getAttribute("position").count;
    geometry.setDrawRange(0, trimmedSparks(full, level));
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
  intro: number,
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
    if (material.uniforms.uIntro) material.uniforms.uIntro.value = intro;
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
  cutout = false,
) {
  // MSAA is off, so alpha-to-coverage would not soften the cut.
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
    transparent: soft && !cutout,
    depthWrite: true,
    alphaToCoverage: false,
    premultipliedAlpha: soft && !cutout,
    alphaTest: cutout ? 0.5 : 0,
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
  bark: ShaderMaterial;
  blossom: ShaderMaterial;
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
      uAspect: { value: 1.6 },
    },
    vertexShader: HILL_VERT,
    fragmentShader: HILL_FRAG,
    vertexColors: true,
    side: DoubleSide,
  });
  const grass = plantMaterial(0.08, [0, 0, 0], DoubleSide, 0, false, true);
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
    uniforms: { ...baseUniforms(), uAspect: { value: 1.6 }, uIntro: { value: 0 } },
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
  const bark = new ShaderMaterial({
    uniforms: { ...baseUniforms(), uAspect: { value: 1.6 } },
    vertexShader: BARK_VERT,
    fragmentShader: BARK_FRAG,
    side: DoubleSide,
  });
  const blossom = new ShaderMaterial({
    uniforms: { ...baseUniforms(), uAspect: { value: 1.6 } },
    vertexShader: BLOSSOM_VERT,
    fragmentShader: BLOSSOM_FRAG,
    transparent: false,
    depthWrite: true,
    // The fragment bleeds petal pink into the fringe. Coverage would need
    // MSAA, and the hero is already fill-rate bound, so the cut stays hard.
    alphaTest: 0.5,
    alphaToCoverage: false,
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
    bark,
    blossom,
    all: [sky, ground, hill, grass, lily, daisy, lupin, cloud, glow, spark, bark, blossom],
  };
}

function buildGeometries(layout: SceneLayout, quality: Quality) {
  return {
    patches: layout.patches.map((patch, index) => {
      const far = index === 2;
      const nearFull = quality === "high" && index === 0;
      return {
        grass: createGrassGeometry(patch.grass),
        lilies: createLilyGeometry(patch.lilies, far ? "speck" : "full", nearFull ? "near" : "mid"),
        daisies: createDaisyGeometry(patch.daisies, far ? "speck" : "full", nearFull ? "near" : "mid"),
        lupins: createLupinGeometry(patch.lupins, far ? "speck" : "full", nearFull ? "near" : "mid"),
      };
    }),
    hills: createHillsGeometry(),
    trunk: createTrunkGeometry(),
    blossoms: createCardGeometry(layout.blossoms, "blossom"),
    clouds: createCardGeometry(layout.clouds, "cloud"),
    glows: createCardGeometry(layout.glows, "glow"),
    sparks: createSparkPoints(layout.sparks),
  };
}

function Instances({
  geometry,
  material,
  scatter,
  renderOrder = 0,
  kind = "",
  canopy,
}: {
  geometry: BufferGeometry;
  material: ShaderMaterial;
  scatter: Scatter;
  renderOrder?: number;
  kind?: string;
  canopy?: number;
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
    if (canopy !== undefined) mesh.userData.canopy = canopy;
    mesh.computeBoundingSphere();
    // The flower and crown shaders move vertices after the instance matrix
    // (sway, portrait settle, the tree's aspect shift). A tight sphere was
    // slicing the right-hand lupins and lilies. Draw them anyway.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 2.6;
    mesh.frustumCulled = false;
    if (!liveMeshes.includes(mesh)) liveMeshes.push(mesh);
    return () => {
      const index = liveMeshes.indexOf(mesh);
      if (index >= 0) liveMeshes.splice(index, 1);
    };
  }, [canopy, kind, scatter]);
  if (scatter.count === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, scatter.count]}
      frustumCulled={false}
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
  reduced,
  onReady,
  onDone,
}: {
  materialsRef: RefObject<ShaderMaterial[]>;
  sky: RefObject<Mesh | null>;
  progress: RefObject<number>;
  reduced: boolean;
  onReady?: () => void;
  onDone: (settled: boolean) => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const clock = useRef(0);
  const frames = useRef(0);
  const ready = useRef(false);
  const settled = useRef(false);
  const perf = useRef({ warm: 0, hot: 0 });
  // Animation frames seen by the poll below, and the one the last draw ran in.
  const tickCount = useRef(0);
  const lastDrawTick = useRef(-2);
  const trimStage = useRef(0);
  const forcedTrim = useRef<0 | 1 | 2 | 3 | null>(null);
  const forcedDpr = useRef<number | null>(null);
  const lockTrim = useRef(false);
  const logStats = useRef(false);
  const reducedRef = useRef(reduced);
  const onReadyRef = useRef(onReady);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    reducedRef.current = reduced;
    onReadyRef.current = onReady;
    onDoneRef.current = onDone;
  }, [onDone, onReady, reduced]);

  useEffect(() => {
    // Every animation frame, not on a timer: with reduced motion the canvas
    // only draws on demand, and a coarse poll left it a few frames behind the
    // scroll, so the walk advanced in visible steps. A compare per frame is
    // free; the draw still only happens when progress actually moved.
    let lastP = Number.NaN;
    let id = 0;
    const tick = () => {
      tickCount.current += 1;
      const walked = progress.current ?? 0;
      if (settled.current && walked < VEIL_HOLD) {
        settled.current = false;
        onDoneRef.current(false);
      }
      if (reducedRef.current && walked !== lastP) {
        lastP = walked;
        invalidate();
      }
      id = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(id);
  }, [invalidate, progress]);

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05);
    const frameMs = Math.min(delta, 0.25);
    const walked = progress.current ?? 0;
    const t = walked;
    const still = reducedRef.current;
    // From r3f's measured size, not clientWidth, which can force a layout every frame.
    const aspect = state.size.width / Math.max(state.size.height, 1);
    const portrait = aspect < 0.85 ? 1 : 0;
    // First-load descent: 1 at the start pose above the clouds, 0 at rest.
    // A scroll mid-descent lands it quickly rather than fighting the walk.
    const now = performance.now();
    if (walked > 0.002 && introPlaying()) rushDescent(now);
    const lift = 1 - descentAmount(now);
    const x = 0;
    const y = VIEW.eye + t * 0.04 + portrait * 0.72 + lift * INTRO_POSE.rise;
    const walkZ = VIEW.startZ + (VIEW.endZ - VIEW.startZ) * t;
    const z = walkZ + lift * INTRO_POSE.back;
    camera.position.set(x, y, z);
    camera.lookAt(0, VIEW.eye + VIEW.lookLift - portrait * 0.78 + lift * INTRO_POSE.lookRise, walkZ - VIEW.lookAhead);
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
      lift,
    );

    const done = walked >= VEIL_HOLD;
    if (done !== settled.current) {
      settled.current = done;
      onDoneRef.current(done);
    }

    const stats = perf.current;
    if (forcedTrim.current === null) {
      const search = window.location.search;
      forcedTrim.current = readForcedTrim(search);
      lockTrim.current = process.env.NODE_ENV !== "production" && new URLSearchParams(search).has("meadowTrim");
      forcedDpr.current = readForcedDpr(search) ?? 0;
      logStats.current = new URLSearchParams(search).has("meadowStats");
    }
    const forced = forcedTrim.current;
    const pinnedDpr = forcedDpr.current;
    if (pinnedDpr !== null && pinnedDpr > 0) {
      if (trimStage.current === 0) {
        gl.setPixelRatio(pinnedDpr);
        trimStage.current = 3;
      }
    } else if (lockTrim.current && forced === 0) {
      // `?meadowTrim=0` holds the full scene for a screenshot. Production ignores it.
    } else if (forced !== 0 && trimStage.current === 0) {
      applyTrim(forced);
      gl.setPixelRatio(forced === 1 ? 1 : 0.85);
      trimStage.current = 3;
    } else if (trimStage.current < 3 && !introPlaying()) {
      // Not sampled during the first-load intro: the honeycomb wipe animates
      // hundreds of tiles on the main thread, and those slow frames would
      // trim the meadow for good.
      // On demand (reduced motion) the delta after a pause is the idle gap,
      // not a slow frame. Counting it trimmed the meadow and dropped the
      // pixel ratio a few scroll frames in, which read as the frame jumping.
      // Only time draws that follow a draw in the previous animation frame.
      const back = tickCount.current - lastDrawTick.current <= 1;
      if (back) stats.warm += 1;
      if (back && stats.warm > 1 && frameMs > 0.018) stats.hot += 1;
      if (stats.hot >= 3) {
        const next = (trimStage.current + 1) as 1 | 2 | 3;
        applyTrim(next);
        gl.setPixelRatio(next === 1 ? 1 : 0.85);
        trimStage.current = next;
        stats.hot = 0;
        stats.warm = 0;
      }
    }

    if (logStats.current) {
      const info = gl.info.render;
      const report = {
        triangles: info.triangles,
        calls: info.calls,
        dpr: gl.getPixelRatio(),
        width: gl.domElement.width,
        height: gl.domElement.height,
        meshes: liveMeshes.map((mesh) => {
          const indexCount = mesh.geometry.index?.count ?? 0;
          return {
            kind: String(mesh.userData[KIND] ?? ""),
            count: mesh.count,
            index: indexCount,
            tris: (indexCount / 3) * mesh.count,
          };
        }),
      };
      (window as Window & { __meadow?: typeof report }).__meadow = report;
    }

    lastDrawTick.current = tickCount.current;
    frames.current += 1;
    // The first useFrame is the first presented frame, after compile.
    // Signal on the next one, which is two animation frames after commit.
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
  reduced,
  onReady,
  onDone,
  onCompiled,
}: {
  quality: Quality;
  progress: RefObject<number>;
  reduced: boolean;
  onReady?: () => void;
  onDone: (settled: boolean) => void;
  /** Once every program has compiled and linked off the main thread. */
  onCompiled?: () => void;
}) {
  const layout = useMemo(() => buildLayout(quality), [quality]);
  const geometries = useMemo(() => buildGeometries(layout, quality), [layout, quality]);
  const materials = useMemo(() => buildMaterials(), []);
  const materialsRef = useRef(materials.all);
  const sky = useRef<Mesh>(null);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    materialsRef.current = materials.all;
  }, [materials]);

  const invalidate = useThree((state) => state.invalidate);
  const onCompiledRef = useRef(onCompiled);
  useEffect(() => {
    onCompiledRef.current = onCompiled;
  }, [onCompiled]);

  // Compile and link every program before the first draw, one object per
  // animation frame, while the poster holds the frame. Chrome on Windows
  // (ANGLE/D3D) reports KHR_parallel_shader_compile as done at once and
  // really compiles each program on its first query, so compileAsync and a
  // plain first render both froze the page for about half a second on a cold
  // shader cache. Asking each program for its uniforms here moves that work
  // into short, separate tasks. A warm cache makes every step near free.
  useLayoutEffect(() => {
    let live = true;
    let frame = 0;
    const objects: Object3D[] = [];
    scene.traverse((object) => {
      if ((object as Mesh).material) objects.push(object);
    });
    let next = 0;
    const step = () => {
      if (!live) return;
      const started = performance.now();
      while (next < objects.length && performance.now() - started < 6) {
        const object = objects[next];
        next += 1;
        if (!object) continue;
        for (const material of gl.compile(object, camera, scene)) {
          (gl.properties.get(material) as { currentProgram?: { getUniforms: () => unknown } }).currentProgram?.getUniforms();
        }
      }
      reportIntroProgress(0.3 + 0.6 * (next / Math.max(objects.length, 1)));
      if (next < objects.length) {
        frame = requestAnimationFrame(step);
        return;
      }
      onCompiledRef.current?.();
    };
    frame = requestAnimationFrame(step);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [camera, geometries, gl, scene]);

  // The loop is parked ("never") until the compile above finishes, and r3f
  // drops an invalidate made while parked. Draw once it is allowed to run,
  // so an on-demand (reduced motion) canvas does not wait for a scroll.
  const frameloop = useThree((state) => state.frameloop);
  useEffect(() => {
    if (frameloop !== "never") invalidate();
  }, [frameloop, invalidate]);

  return (
    <>
      <FrameDriver
        materialsRef={materialsRef}
        sky={sky}
        progress={progress}
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
            <Instances geometry={patch.lilies} material={materials.lily} scatter={scatter.lilies} renderOrder={2} kind={index === 0 ? "flower" : index === 1 ? "mid" : "far"} />
            <Instances geometry={patch.daisies} material={materials.daisy} scatter={scatter.daisies} kind={index === 0 ? "flower" : index === 1 ? "mid" : "far"} />
            <Instances geometry={patch.lupins} material={materials.lupin} scatter={scatter.lupins} kind={index === 0 ? "flower" : index === 1 ? "mid" : "far"} />
          </group>
        );
      })}
      <mesh geometry={geometries.trunk} position={[TREE.x, TREE.baseY, TREE.z]} frustumCulled={false} renderOrder={2}>
        <primitive object={materials.bark} attach="material" />
      </mesh>
      <Instances
        geometry={geometries.blossoms}
        material={materials.blossom}
        scatter={layout.blossoms}
        renderOrder={3}
        kind="tree"
        canopy={layout.canopyCount}
      />
      <Instances geometry={geometries.clouds} material={materials.cloud} scatter={layout.clouds} renderOrder={1} kind="cloud" />
      <SparkPoints geometry={geometries.sparks} material={materials.spark} />
      <Instances geometry={geometries.glows} material={materials.glow} scatter={layout.glows} renderOrder={4} kind="glow" />
    </>
  );
}
