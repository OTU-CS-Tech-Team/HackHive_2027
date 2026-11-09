"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  DoubleSide,
  FrontSide,
  InstancedMesh,
  Mesh,
  ShaderMaterial,
  Vector3,
  type Side,
  type BufferGeometry,
} from "three";
import { createCardGeometry, createDaisyGeometry, createGrassGeometry, createHillsGeometry, createLilyGeometry, createLupinGeometry } from "@/components/landing/meadow/geometry";
import {
  CLOUD_FRAG,
  CLOUD_VERT,
  GLOW_FRAG,
  GLOW_VERT,
  GROUND_FRAG,
  GROUND_VERT,
  PLANT_FRAG,
  PLANT_VERT,
  SKY_FRAG,
  SKY_VERT,
} from "@/components/landing/meadow/glsl";
import { buildLayout, type Scatter, type SceneLayout } from "@/components/landing/meadow/layout";
import {
  AMBIENT,
  FOG_DENSITY,
  GRASS_FAR,
  GRASS_NEAR,
  HORIZON,
  PATH,
  SKY_MID,
  SKY_TOP,
  SUN,
  SUN_DIR,
  VIEW,
  fogDensityFor,
  handoffVeil,
  hexToRgb,
  walkBlend,
  windScale,
} from "@/components/landing/meadow/palette";
import { SKY_SEGMENTS } from "@/components/landing/meadow/stats";
import type { Quality } from "@/components/landing/meadow/quality";

const FULL_COUNT = "fullCount";
const liveMeshes: InstancedMesh[] = [];

function thinEvenly() {
  for (const mesh of liveMeshes) {
    const full = Number(mesh.userData[FULL_COUNT] ?? mesh.count);
    mesh.count = Math.min(full, Math.max(4, Math.floor(full * 0.5)));
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
) {
  if (!materials) return;
  for (const material of materials) {
    material.uniforms.uTime.value = time;
    material.uniforms.uWind.value = wind;
    material.uniforms.uVeil.value = veil;
    material.uniforms.uFogDensity.value = fog;
    material.uniforms.uCamPos.value.set(x, y, z);
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

function plantMaterial(sss: number, emissive: [number, number, number], side: Side = DoubleSide) {
  return new ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uSss: { value: sss },
      uEmissive: { value: new Vector3(...emissive) },
    },
    vertexShader: PLANT_VERT,
    fragmentShader: PLANT_FRAG,
    vertexColors: true,
    side,
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
    },
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
  });
  const hill = plantMaterial(0.02, [0, 0, 0], FrontSide);
  const grass = plantMaterial(0.12, [0, 0, 0], FrontSide);
  const lily = plantMaterial(0.7, [0.18, 0.16, 0.1]);
  const daisy = plantMaterial(0.45, [0.08, 0.07, 0.04]);
  const lupin = plantMaterial(0.5, [0.05, 0.04, 0.05]);
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
    all: [sky, ground, hill, grass, lily, daisy, lupin, cloud, glow],
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
  };
}

function Instances({
  geometry,
  material,
  scatter,
  renderOrder = 0,
}: {
  geometry: BufferGeometry;
  material: ShaderMaterial;
  scatter: Scatter;
  renderOrder?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || scatter.count === 0) return;
    mesh.count = scatter.count;
    mesh.instanceMatrix.array.set(scatter.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData[FULL_COUNT] = scatter.count;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = true;
    if (!liveMeshes.includes(mesh)) liveMeshes.push(mesh);
    return () => {
      const index = liveMeshes.indexOf(mesh);
      if (index >= 0) liveMeshes.splice(index, 1);
    };
  }, [scatter]);
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
  const perf = useRef({ warm: 0, acc: 0, samples: 0, dropped: false });
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
      if (!reducedRef.current) {
        if (walked < 1 && settled.current) {
          settled.current = false;
          onDoneRef.current(false);
        }
        return;
      }
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
    const t = walkBlend(walked);
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
    const x = eased.current.x * 0.22;
    const y = VIEW.eye + t * 0.04;
    const z = VIEW.startZ + (VIEW.endZ - VIEW.startZ) * t;
    camera.position.set(x, y, z);
    camera.lookAt(eased.current.x * 0.45, VIEW.eye + VIEW.lookLift - eased.current.y * 0.1, z - VIEW.lookAhead);
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
    );

    const done = walked >= 1;
    if (done !== settled.current) {
      settled.current = done;
      onDoneRef.current(done);
    }

    const stats = perf.current;
    if (!stats.dropped) {
      stats.warm += 1;
      if (stats.warm > 4) {
        stats.acc += frameMs;
        stats.samples += 1;
        if (stats.samples >= 6) {
          if (stats.acc / stats.samples > 0.02) {
            stats.dropped = true;
            thinEvenly();
            gl.setPixelRatio(1);
          }
          stats.acc = 0;
          stats.samples = 0;
        }
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -18]} frustumCulled={false}>
        <planeGeometry args={[80, 90, 1, 1]} />
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
            <Instances geometry={patch.grass} material={materials.grass} scatter={scatter.grass} />
            <Instances geometry={patch.lilies} material={materials.lily} scatter={scatter.lilies} />
            <Instances geometry={patch.daisies} material={materials.daisy} scatter={scatter.daisies} />
            <Instances geometry={patch.lupins} material={materials.lupin} scatter={scatter.lupins} />
          </group>
        );
      })}
      <Instances geometry={geometries.clouds} material={materials.cloud} scatter={layout.clouds} renderOrder={1} />
      <Instances geometry={geometries.glows} material={materials.glow} scatter={layout.glows} renderOrder={2} />
    </>
  );
}
