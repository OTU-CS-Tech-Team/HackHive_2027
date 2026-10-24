"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildWindLayers } from "./windLayers";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec2 vUv;

uniform sampler2D uMap;
uniform sampler2D uBase;
uniform sampler2D uMask;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec2 uObjectPos;
uniform float uTime;
uniform float uLayout;
uniform float uDebug;

vec2 coverScale(vec2 resolution, vec2 imageSize) {
  float containerAspect = resolution.x / max(resolution.y, 1.0);
  float imageAspect = imageSize.x / max(imageSize.y, 1.0);
  if (containerAspect > imageAspect) {
    return vec2(1.0, imageAspect / max(containerAspect, 0.0001));
  }
  return vec2(containerAspect / max(imageAspect, 0.0001), 1.0);
}

vec2 rot(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

float inside(vec2 uv) {
  return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
}

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  if (uImageSize.x < 2.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 screen = vec2(vUv.x, 1.0 - vUv.y);
  vec2 scale = coverScale(resolution, uImageSize);
  vec2 p = clamp(uObjectPos + (screen - uObjectPos) * scale, vec2(0.0), vec2(1.0));
  vec2 pix = p * uImageSize;
  vec2 sc = uImageSize / (uLayout < 0.5 ? vec2(1280.0, 720.0) : vec2(720.0, 1280.0));

  // One slow breeze. The sine eases at each end of the sway, and the
  // opening fade keeps the first moment from popping.
  float t = uTime;
  float settle = smoothstep(0.35, 2.1, t);
  float wind = sin(t * 0.62) * settle;

  // Leaves: a small slide. No rotation, so the limbs underneath do not warp.
  float leafAmp = (uLayout < 0.5 ? 5.0 : 6.0) * sc.x;
  vec2 lsrc = pix - vec2(wind * leafAmp, wind * 1.1 * sc.x);
  vec2 lUv = lsrc / uImageSize;
  float lIn = inside(lUv);
  vec3 leafCol = texture2D(uMap, vec2(lUv.x, 1.0 - lUv.y)).rgb;
  float leafA = texture2D(uMask, vec2(lUv.x, 1.0 - lUv.y)).r * lIn;

  // Grass drifts with the same breeze, a little further.
  float gAmp = (uLayout < 0.5 ? 7.0 : 8.0) * sc.x;
  vec2 gsrc = pix - vec2(wind * gAmp, wind * 0.5 * sc.x);
  vec2 gUv = gsrc / uImageSize;
  float gIn = inside(gUv);
  vec3 grassCol = texture2D(uMap, vec2(gUv.x, 1.0 - gUv.y)).rgb;
  float grassA = texture2D(uMask, vec2(gUv.x, 1.0 - gUv.y)).g * gIn;

  // Hive and ropes: one tiny rigid swing from the knot.
  vec2 knot = (uLayout < 0.5 ? vec2(924.0, 48.0) : vec2(552.0, 648.0)) * sc;
  float hang = wind * 0.026;
  vec2 hsrc = knot + rot(pix - knot, -hang);
  vec2 hUv = hsrc / uImageSize;
  float hIn = inside(hUv);
  vec3 hiveCol = texture2D(uMap, vec2(hUv.x, 1.0 - hUv.y)).rgb;
  float hiveA = texture2D(uMask, vec2(hUv.x, 1.0 - hUv.y)).b * hIn;

  if (uDebug > 0.5) {
    gl_FragColor = vec4(leafA, grassA, hiveA, 1.0);
    return;
  }

  vec2 baseUv = vec2(p.x, 1.0 - p.y);
  vec3 col = texture2D(uBase, baseUv).rgb;
  col = mix(col, leafCol, leafA);
  col = mix(col, grassCol, grassA);
  col = mix(col, hiveCol, hiveA);
  gl_FragColor = vec4(col, 1.0);
}
`;

type WindWindow = Window & {
  __WIND_DEBUG__?: boolean;
  __WIND_HOLD__?: number | null;
};

type Plate = {
  map: THREE.Texture;
  base: THREE.Texture;
  mask: THREE.Texture;
  mobile: boolean;
};

function framing(): [number, number] {
  const width = window.innerWidth;
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  if (width <= 767) return [0.5, 0];
  if (width <= 1024 && portrait) return [0.5, 0.2];
  return [0.5, 0.5];
}

function makeUniforms(map: THREE.Texture, base: THREE.Texture, mask: THREE.Texture, mobile: boolean) {
  const image = map.image as { width: number; height: number; naturalWidth?: number; naturalHeight?: number };
  return {
    uMap: { value: map },
    uBase: { value: base },
    uMask: { value: mask },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uImageSize: {
      value: new THREE.Vector2(image.naturalWidth || image.width, image.naturalHeight || image.height),
    },
    uObjectPos: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0 },
    uLayout: { value: mobile ? 1 : 0 },
    uDebug: { value: 0 },
  };
}

function WindPlate({
  map,
  base,
  mask,
  mobile,
  onReady,
}: {
  map: THREE.Texture;
  base: THREE.Texture;
  mask: THREE.Texture;
  mobile: boolean;
  onReady: () => void;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => makeUniforms(map, base, mask, mobile), [map, base, mask, mobile]);
  const timeRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const readyRef = useRef(false);

  useFrame((state) => {
    const material = matRef.current;
    if (!material) return;

    const held = (window as WindWindow).__WIND_HOLD__;
    const now = state.clock.elapsedTime;
    if (typeof held === "number") {
      timeRef.current = held;
      lastRef.current = now;
    } else {
      if (lastRef.current === null) lastRef.current = now;
      let delta = now - lastRef.current;
      lastRef.current = now;
      if (!(delta > 0)) delta = 0;
      if (delta > 0.1) delta = 0.016;
      timeRef.current += delta;
    }

    const [ox, oy] = framing();
    material.uniforms.uTime.value = timeRef.current;
    material.uniforms.uResolution.value.set(state.size.width, state.size.height);
    material.uniforms.uObjectPos.value.set(ox, oy);
    material.uniforms.uDebug.value = (window as WindWindow).__WIND_DEBUG__ ? 1 : 0;

    if (!readyRef.current) {
      readyRef.current = true;
      queueMicrotask(onReady);
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={0}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function makeDataTexture(pixels: Uint8Array, width: number, height: number) {
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function textureFromImage(img: HTMLImageElement) {
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(2, Math.round(img.naturalWidth * scale));
  const height = Math.max(2, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = new Uint8Array(ctx.getImageData(0, 0, width, height).data);
  const mobile = img.currentSrc.includes("backdrop-mobile") || img.src.includes("backdrop-mobile");
  const layers = buildWindLayers(pixels, width, height, mobile);
  return {
    map: makeDataTexture(pixels, width, height),
    base: makeDataTexture(layers.base, width, height),
    mask: makeDataTexture(layers.mask, width, height),
    mobile,
  };
}

export function WindCanvas({
  imgRef,
  paused,
  dpr,
  onReady,
  onError,
}: {
  imgRef: RefObject<HTMLImageElement | null>;
  paused: boolean;
  dpr: [number, number];
  onReady: () => void;
  onError: () => void;
}) {
  const [plate, setPlate] = useState<Plate | null>(null);
  const mapRef = useRef<THREE.Texture | null>(null);
  const baseRef = useRef<THREE.Texture | null>(null);
  const maskRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const bind = () => {
      if (!img.naturalWidth) return;
      try {
        const next = textureFromImage(img);
        if (!next) return;
        mapRef.current?.dispose();
        baseRef.current?.dispose();
        maskRef.current?.dispose();
        mapRef.current = next.map;
        baseRef.current = next.base;
        maskRef.current = next.mask;
        setPlate(next);
      } catch {
        onError();
      }
    };

    if (img.complete) queueMicrotask(bind);
    img.addEventListener("load", bind);
    return () => {
      img.removeEventListener("load", bind);
      mapRef.current?.dispose();
      baseRef.current?.dispose();
      maskRef.current?.dispose();
      mapRef.current = null;
      baseRef.current = null;
      maskRef.current = null;
    };
  }, [imgRef, onError]);

  return (
    <Canvas
      dpr={dpr}
      frameloop={paused ? "demand" : "always"}
      gl={{
        antialias: false,
        alpha: true,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true,
      }}
      camera={{ position: [0, 0, 1], fov: 50, near: 0.1, far: 10 }}
      onCreated={(state) => {
        state.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        state.gl.toneMapping = THREE.NoToneMapping;
        state.gl.setClearColor(0x000000, 0);
        state.gl.domElement.setAttribute("aria-hidden", "true");
      }}
      onError={onError}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {plate ? (
        <WindPlate map={plate.map} base={plate.base} mask={plate.mask} mobile={plate.mobile} onReady={onReady} />
      ) : null}
    </Canvas>
  );
}
