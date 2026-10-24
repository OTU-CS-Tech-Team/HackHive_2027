"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type HivePreset = {
  anchor: [number, number];
  body: [number, number, number, number];
  roofA: [number, number];
  roofB: [number, number];
  roofC: [number, number];
  rope: number;
};

// Image UV, origin top-left. Body is center xy plus half extents zw.
// The hive (body, roof, ropes) is sampled as a rigid sprite so its planks never warp.
const HIVE: { desktop: HivePreset; mobile: HivePreset } = {
  desktop: {
    anchor: [0.722, 0.148],
    body: [0.712, 0.328, 0.05, 0.078],
    roofA: [0.712, 0.198],
    roofB: [0.648, 0.275],
    roofC: [0.778, 0.275],
    rope: 0.0048,
  },
  mobile: {
    anchor: [0.748, 0.448],
    body: [0.752, 0.588, 0.052, 0.042],
    roofA: [0.75, 0.512],
    roofB: [0.692, 0.555],
    roofC: [0.812, 0.555],
    rope: 0.006,
  },
};

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
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec2 uObjectPos;
uniform float uTime;
uniform float uLayout;
uniform vec2 uAnchor;
uniform vec4 uBody;
uniform vec2 uRoofA;
uniform vec2 uRoofB;
uniform vec2 uRoofC;
uniform float uRope;
uniform float uDebug;

vec2 coverScale(vec2 resolution, vec2 imageSize) {
  float containerAspect = resolution.x / max(resolution.y, 1.0);
  float imageAspect = imageSize.x / max(imageSize.y, 1.0);
  if (containerAspect > imageAspect) {
    return vec2(1.0, imageAspect / max(containerAspect, 0.0001));
  }
  return vec2(containerAspect / max(imageAspect, 0.0001), 1.0);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0;
  vec2 e1 = p2 - p1;
  vec2 e2 = p0 - p2;
  vec2 v0 = p - p0;
  vec2 v1 = p - p1;
  vec2 v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / max(dot(e0, e0), 0.0001), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / max(dot(e1, e1), 0.0001), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / max(dot(e2, e2), 0.0001), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(
    min(
      vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
      vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))
    ),
    vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x))
  );
  return -sqrt(max(d.x, 0.0)) * sign(d.y);
}

float hiveDist(vec2 pUV) {
  vec2 p = pUV * uImageSize;
  vec2 anchor = uAnchor * uImageSize;
  float rope = uRope * uImageSize.x;
  float dBody = sdBox(p - uBody.xy * uImageSize, uBody.zw * uImageSize);
  float dRoof = sdTriangle(p, uRoofA * uImageSize, uRoofB * uImageSize, uRoofC * uImageSize);
  float dRope = min(
    sdSegment(p, anchor, uRoofB * uImageSize),
    sdSegment(p, anchor, uRoofC * uImageSize)
  ) - rope;
  return min(dBody, min(dRoof, dRope));
}

vec2 rot(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  if (uImageSize.x < 2.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 screen = vec2(vUv.x, 1.0 - vUv.y);
  vec2 scale = coverScale(resolution, uImageSize);
  vec2 p = clamp(uObjectPos + (screen - uObjectPos) * scale, 0.0, 1.0);

  float t = uTime;
  float settle = smoothstep(0.35, 1.45, t);
  float gust = smoothstep(0.62, 1.0, 0.5 + 0.5 * sin(t * 0.23));
  float breeze = sin(t * 0.55);
  float wind = (breeze * 0.75 + sin(t * 0.17) * 0.25) * (0.75 + 0.55 * gust);

  vec3 base = texture2D(uMap, vec2(p.x, 1.0 - p.y)).rgb;
  float r = base.r;
  float g = base.g;
  float b = base.b;
  float luma = dot(base, vec3(0.299, 0.587, 0.114));
  float sky = smoothstep(0.72, 0.90, luma) * smoothstep(0.42, 0.70, b);

  float axis = 0.68;
  float trunk = 0.0;
  float canopyLo = 0.5;
  float canopyHi = 0.72;
  float grassLo = 0.72;
  if (uLayout < 0.5) {
    axis = mix(0.70, 0.63, smoothstep(0.18, 0.95, p.y));
    float halfW = mix(0.11, 0.42, smoothstep(0.22, 1.0, p.y));
    trunk = 1.0 - smoothstep(halfW * 0.5, halfW, abs(p.x - axis));
    trunk *= smoothstep(0.06, 0.22, p.y);
    canopyLo = 0.46;
    canopyHi = 0.70;
    grassLo = 0.70;
  } else {
    axis = mix(0.76, 0.60, smoothstep(0.34, 0.96, p.y));
    float halfW = mix(0.16, 0.48, smoothstep(0.40, 1.0, p.y));
    trunk = 1.0 - smoothstep(halfW * 0.4, halfW, abs(p.x - axis));
    trunk *= smoothstep(0.30, 0.48, p.y);
    canopyLo = 0.56;
    canopyHi = 0.76;
    grassLo = 0.62;
  }

  float dark = 1.0 - smoothstep(0.15, 0.42, luma);
  float brown = smoothstep(0.02, 0.14, r - b);
  float bark = trunk * clamp(dark * (0.65 + 0.35 * brown), 0.0, 1.0);
  float moss = trunk * smoothstep(0.015, 0.09, g - r) * (1.0 - smoothstep(0.48, 0.72, luma));
  float still = clamp(max(bark, moss), 0.0, 1.0);

  float canopy = 1.0 - smoothstep(canopyLo, canopyHi, p.y);
  float leaf = smoothstep(0.02, 0.11, g - b) * (1.0 - sky) * smoothstep(0.08, 0.24, g);
  float leafW = leaf * canopy * (1.0 - still);
  float branch = smoothstep(0.04, 0.16, r - b) * (1.0 - leaf) * (1.0 - sky) * canopy;
  branch *= 1.0 - smoothstep(0.2, 0.75, still);
  float branchW = branch * 0.4;

  float tip = mix(0.28, 1.0, smoothstep(0.0, 0.4, abs(p.x - axis)));
  tip *= mix(1.0, 0.42, smoothstep(0.0, 0.55, p.y));

  float grassZone = smoothstep(grassLo, min(grassLo + 0.14, 0.98), p.y);
  float grassW = grassZone * (1.0 - still) * smoothstep(0.16, 0.34, luma) * (1.0 - sky);

  float flutter = sin(p.x * 13.0 + p.y * 8.0 + t * 1.2);
  float blades = sin(p.x * 24.0 - t * 1.3) * 0.65 + sin(p.x * 10.0 + t * 0.65) * 0.35;

  float leafAmp = (wind * 5.2 + flutter * 1.5) * leafW * tip;
  float branchAmp = wind * 2.2 * branchW * tip;
  float grassAmp = (wind * 4.6 + blades * 1.5) * grassW * smoothstep(grassLo, 1.0, p.y);
  vec2 offsetPx = vec2(
    leafAmp + branchAmp + grassAmp,
    flutter * leafW * tip * 1.4 + blades * grassW * 0.35
  );

  float branchScreen = breeze * (2.5 + 2.0 * gust);
  vec2 dAnchor = (p - uAnchor) * uImageSize;
  float pinRadius = 0.055 * uImageSize.x;
  float pin = exp(-dot(dAnchor, dAnchor) / max(pinRadius * pinRadius, 1.0));
  offsetPx += vec2(branchScreen, breeze * 0.35) * pin * (1.0 - still);

  float limit = 9.0;
  float olen = length(offsetPx);
  if (olen > limit) offsetPx *= limit / olen;
  offsetPx *= settle;

  vec2 pxToUV = scale / resolution;
  vec2 bgP = clamp(p + offsetPx * pxToUV, 0.0, 1.0);

  float hiveAngle = sin(t * 0.55 - 0.9) * (0.028 + 0.02 * gust) * settle;
  vec2 shiftUV = vec2(branchScreen, breeze * 0.35) * settle * pxToUV;
  vec2 pivot = (uAnchor + shiftUV) * uImageSize;
  vec2 src = uAnchor * uImageSize + rot(p * uImageSize - pivot, -hiveAngle);
  vec2 srcUV = src / uImageSize;

  float dSrc = hiveDist(srcUV);
  float hiveAlpha = smoothstep(1.6, -1.2, dSrc);
  float inside = step(0.0, srcUV.x) * step(srcUV.x, 1.0) * step(0.0, srcUV.y) * step(srcUV.y, 1.0);
  hiveAlpha *= inside;

  vec2 bgSample = bgP;
  float dBg = hiveDist(bgSample);
  if (dBg < 2.2) {
    vec2 eps = 1.5 / uImageSize;
    float dx = hiveDist(bgSample + vec2(eps.x, 0.0)) - hiveDist(bgSample - vec2(eps.x, 0.0));
    float dy = hiveDist(bgSample + vec2(0.0, eps.y)) - hiveDist(bgSample - vec2(0.0, eps.y));
    vec2 grad = vec2(dx, dy);
    float glen = length(grad);
    grad = glen > 0.0001 ? grad / glen : vec2(1.0, 0.0);
    bgSample = clamp((bgSample * uImageSize + grad * (2.6 - dBg)) / uImageSize, 0.0, 1.0);
  }

  if (uDebug > 0.5) {
    vec3 dbg = vec3(still, clamp(leafW + branchW, 0.0, 1.0), grassW);
    dbg = mix(dbg, vec3(1.0, 0.85, 0.1), hiveAlpha);
    gl_FragColor = vec4(dbg, 1.0);
    return;
  }

  vec3 bgCol = texture2D(uMap, vec2(bgSample.x, 1.0 - bgSample.y)).rgb;
  vec3 hiveCol = texture2D(uMap, vec2(srcUV.x, 1.0 - srcUV.y)).rgb;
  gl_FragColor = vec4(mix(bgCol, hiveCol, hiveAlpha), 1.0);
}
`;

type WindWindow = Window & {
  __WIND_DEBUG__?: boolean;
  __WIND_HOLD__?: number | null;
};

type Plate = { texture: THREE.Texture; mobile: boolean };

function framing(): [number, number] {
  const width = window.innerWidth;
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  if (width <= 767) return [0.5, 0];
  if (width <= 1024 && portrait) return [0.5, 0.2];
  return [0.5, 0.5];
}

function makeUniforms(texture: THREE.Texture, mobile: boolean) {
  const hive = mobile ? HIVE.mobile : HIVE.desktop;
  const image = texture.image as HTMLImageElement;
  return {
    uMap: { value: texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uImageSize: {
      value: new THREE.Vector2(image.naturalWidth || image.width, image.naturalHeight || image.height),
    },
    uObjectPos: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0 },
    uLayout: { value: mobile ? 1 : 0 },
    uAnchor: { value: new THREE.Vector2(...hive.anchor) },
    uBody: { value: new THREE.Vector4(...hive.body) },
    uRoofA: { value: new THREE.Vector2(...hive.roofA) },
    uRoofB: { value: new THREE.Vector2(...hive.roofB) },
    uRoofC: { value: new THREE.Vector2(...hive.roofC) },
    uRope: { value: hive.rope },
    uDebug: { value: 0 },
  };
}

function WindPlate({
  texture,
  mobile,
  onReady,
}: {
  texture: THREE.Texture;
  mobile: boolean;
  onReady: () => void;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => makeUniforms(texture, mobile), [texture, mobile]);
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

function textureFromImage(img: HTMLImageElement) {
  const maxEdge = 1600;
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
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
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
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const bind = () => {
      if (!img.naturalWidth) return;
      const next = textureFromImage(img);
      if (!next) return;
      textureRef.current?.dispose();
      textureRef.current = next;
      setPlate({ texture: next, mobile: img.currentSrc.includes("backdrop-mobile") });
    };

    if (img.complete) queueMicrotask(bind);
    img.addEventListener("load", bind);
    return () => {
      img.removeEventListener("load", bind);
      textureRef.current?.dispose();
      textureRef.current = null;
    };
  }, [imgRef]);

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
      {plate ? <WindPlate texture={plate.texture} mobile={plate.mobile} onReady={onReady} /> : null}
      {/* Bees and pollen used to render in this canvas. Add the next overlay
          after WindPlate with depthTest disabled so it sits above the plate. */}
    </Canvas>
  );
}
