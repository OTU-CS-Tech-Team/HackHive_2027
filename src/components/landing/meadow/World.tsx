"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  DoubleSide,
  InstancedMesh,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
} from "three";
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
import {
  createCloudGeometry,
  createDaisyGeometry,
  createGrassGeometry,
  createHillsGeometry,
  createLilyGeometry,
  createLupinGeometry,
  createTreeGeometry,
} from "@/components/landing/meadow/geometry";
import { buildLayout, TREE_AT, type Scatter, type SceneLayout } from "@/components/landing/meadow/layout";
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
  fogDensityFor,
  handoffVeil,
  hexToRgb,
  walkBlend,
  windScale,
} from "@/components/landing/meadow/palette";
import type { Quality } from "@/components/landing/meadow/quality";

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

const START_Z = 4.6;
const END_Z = -1.4;
const EYE_Y = 1.62;
const LOOK_AHEAD = 7.4;

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

function plantMaterial(sss: number, emissive: [number, number, number]) {
  return new ShaderMaterial({
    uniforms: {
      ...baseUniforms(),
      uSss: { value: sss },
      uEmissive: { value: new Vector3(...emissive) },
    },
    vertexShader: PLANT_VERT,
    fragmentShader: PLANT_FRAG,
    vertexColors: true,
    side: DoubleSide,
  });
}

type Materials = {
  all: ShaderMaterial[];
  sky: ShaderMaterial;
  ground: ShaderMaterial;
  hill: ShaderMaterial;
  tree: ShaderMaterial;
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
  const hill = plantMaterial(0.04, [0, 0, 0]);
  const tree = plantMaterial(0.12, [0, 0, 0]);
  const grass = plantMaterial(0.16, [0, 0, 0]);
  const lily = plantMaterial(0.62, [0.16, 0.14, 0.1]);
  const daisy = plantMaterial(0.4, [0.08, 0.07, 0.04]);
  const lupin = plantMaterial(0.48, [0.06, 0.04, 0.05]);
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
    tree,
    grass,
    lily,
    daisy,
    lupin,
    cloud,
    glow,
    all: [sky, ground, hill, tree, grass, lily, daisy, lupin, cloud, glow],
  };
}

function buildGeometries(layout: SceneLayout) {
  return {
    grass: createGrassGeometry(layout.grass),
    lilies: createLilyGeometry(layout.lilies),
    daisies: createDaisyGeometry(layout.daisies),
    lupins: createLupinGeometry(layout.lupins),
    clouds: createCloudGeometry(layout.clouds),
    hills: createHillsGeometry(),
    tree: createTreeGeometry(),
    glow: new PlaneGeometry(1, 1),
  };
}

function Instances({
  geometry,
  material,
  scatter,
  meshRef,
  renderOrder = 0,
}: {
  geometry: BufferGeometry;
  material: ShaderMaterial;
  scatter: Scatter;
  meshRef: RefObject<InstancedMesh | null>;
  renderOrder?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    meshRef.current = mesh;
    if (!mesh || scatter.count === 0) return;
    mesh.count = scatter.count;
    mesh.instanceMatrix.array.set(scatter.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [meshRef, scatter]);
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

function FrameDriver({
  materialsRef,
  meshes,
  sky,
  progress,
  pointer,
  reduced,
  onReady,
}: {
  materialsRef: RefObject<ShaderMaterial[]>;
  meshes: Array<RefObject<InstancedMesh | null>>;
  sky: RefObject<Mesh | null>;
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
  onReady?: () => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const eased = useRef({ x: 0, y: 0, snapped: false });
  const clock = useRef(0);
  const frames = useRef(0);
  const ready = useRef(false);
  const perf = useRef({ warm: 0, acc: 0, samples: 0, dropped: false });
  const reducedRef = useRef(reduced);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    reducedRef.current = reduced;
    onReadyRef.current = onReady;
  }, [onReady, reduced]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
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
    const x = eased.current.x * 0.3;
    const y = EYE_Y + t * 0.05;
    const z = START_Z + (END_Z - START_Z) * t;
    camera.position.set(x, y, z);
    camera.lookAt(eased.current.x * 0.82, 1.02 - eased.current.y * 0.14, z - LOOK_AHEAD);
    if (sky.current) sky.current.position.set(x, y, z);
    if (!still) clock.current += step;
    writeUniforms(materialsRef.current, clock.current, windScale(walked, still), handoffVeil(walked), fogDensityFor(walked), x, y, z);

    const stats = perf.current;
    if (!stats.dropped && !still) {
      stats.warm += 1;
      if (stats.warm > 36) {
        stats.acc += step;
        stats.samples += 1;
        if (stats.samples >= 40 && stats.acc / stats.samples > 0.021) {
          stats.dropped = true;
          for (const meshRef of meshes) {
            const mesh = meshRef.current;
            if (!mesh) continue;
            mesh.count = Math.max(12, Math.floor(mesh.count * 0.45));
          }
          gl.setPixelRatio(1);
        } else if (stats.samples >= 40) {
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
}: {
  quality: Quality;
  progress: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
  reduced: boolean;
  onReady?: () => void;
}) {
  const layout = useMemo(() => buildLayout(quality), [quality]);
  const geometries = useMemo(() => buildGeometries(layout), [layout]);
  const materials = useMemo(() => buildMaterials(), []);
  const materialsRef = useRef(materials.all);
  useEffect(() => {
    materialsRef.current = materials.all;
  }, [materials]);
  const sky = useRef<Mesh>(null);
  const grass = useRef<InstancedMesh>(null);
  const lilies = useRef<InstancedMesh>(null);
  const daisies = useRef<InstancedMesh>(null);
  const lupins = useRef<InstancedMesh>(null);
  const glows = useRef<InstancedMesh>(null);
  const clouds = useRef<InstancedMesh>(null);

  return (
    <>
      <FrameDriver
        materialsRef={materialsRef}
        meshes={[grass, lilies, daisies, lupins, glows, clouds]}
        sky={sky}
        progress={progress}
        pointer={pointer}
        reduced={reduced}
        onReady={onReady}
      />
      <mesh ref={sky} frustumCulled={false} renderOrder={-2}>
        <sphereGeometry args={[48, 20, 14]} />
        <primitive object={materials.sky} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]} frustumCulled={false}>
        <planeGeometry args={[90, 110, 1, 1]} />
        <primitive object={materials.ground} attach="material" />
      </mesh>
      <mesh geometry={geometries.hills} frustumCulled={false}>
        <primitive object={materials.hill} attach="material" />
      </mesh>
      <mesh geometry={geometries.tree} position={TREE_AT} frustumCulled={false}>
        <primitive object={materials.tree} attach="material" />
      </mesh>
      <Instances geometry={geometries.grass} material={materials.grass} scatter={layout.grass} meshRef={grass} />
      <Instances geometry={geometries.lilies} material={materials.lily} scatter={layout.lilies} meshRef={lilies} />
      <Instances geometry={geometries.daisies} material={materials.daisy} scatter={layout.daisies} meshRef={daisies} />
      <Instances geometry={geometries.lupins} material={materials.lupin} scatter={layout.lupins} meshRef={lupins} />
      <Instances
        geometry={geometries.clouds}
        material={materials.cloud}
        scatter={layout.clouds}
        meshRef={clouds}
        renderOrder={1}
      />
      <Instances
        geometry={geometries.glow}
        material={materials.glow}
        scatter={layout.glows}
        meshRef={glows}
        renderOrder={2}
      />
    </>
  );
}
