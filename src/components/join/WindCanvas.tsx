"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

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

// Hive, roof, knot, and three straight ropes from the knot move as one
// rigid piece. The silhouette stays on the wood and the ropes, so the swing
// does not uncover a rectangle of bark. Coordinates are source-plate pixels.
float hiveDistPx(vec2 p) {
  vec2 sc = uImageSize / (uLayout < 0.5 ? vec2(1280.0, 720.0) : vec2(720.0, 1280.0));
  vec2 anchor;
  vec2 bodyC;
  vec2 bodyH;
  vec2 porchC;
  vec2 porchH;
  vec2 roofA;
  vec2 roofB;
  vec2 roofC;
  vec2 fin;
  float finR;
  vec2 ropeL;
  vec2 ropeM;
  vec2 ropeR;
  float knotR;
  float ropeW;
  if (uLayout < 0.5) {
    anchor = vec2(924.0, 48.0);
    bodyC = vec2(908.0, 246.0);
    bodyH = vec2(74.0, 50.0);
    porchC = vec2(916.0, 246.0);
    porchH = vec2(1.0, 1.0);
    roofA = vec2(900.0, 148.0);
    roofB = vec2(818.0, 204.0);
    roofC = vec2(998.0, 212.0);
    fin = vec2(862.0, 176.0);
    finR = 18.0;
    ropeL = vec2(800.0, 206.0);
    ropeM = vec2(862.0, 172.0);
    ropeR = vec2(1012.0, 208.0);
    knotR = 13.0;
    ropeW = 12.0;
  } else {
    anchor = vec2(552.0, 648.0);
    bodyC = vec2(548.0, 758.0);
    bodyH = vec2(52.0, 46.0);
    porchC = vec2(478.0, 752.0);
    porchH = vec2(34.0, 22.0);
    roofA = vec2(548.0, 678.0);
    roofB = vec2(440.0, 724.0);
    roofC = vec2(628.0, 732.0);
    fin = vec2(520.0, 705.0);
    finR = 16.0;
    ropeL = vec2(482.0, 746.0);
    ropeM = vec2(576.0, 714.0);
    ropeR = vec2(654.0, 750.0);
    knotR = 12.0;
    ropeW = 11.0;
  }
  anchor *= sc;
  bodyC *= sc;
  bodyH *= sc;
  porchC *= sc;
  porchH *= sc;
  roofA *= sc;
  roofB *= sc;
  roofC *= sc;
  fin *= sc;
  ropeL *= sc;
  ropeM *= sc;
  ropeR *= sc;
  finR *= sc.x;
  knotR *= sc.x;
  ropeW *= sc.x;
  // Each rope is one straight capsule from the knot, so the swing cannot kink it.
  float d = sdBox(p - bodyC, bodyH);
  d = min(d, sdBox(p - porchC, porchH));
  d = min(d, sdTriangle(p, roofA, roofB, roofC));
  d = min(d, length(p - fin) - finR);
  d = min(d, sdSegment(p, anchor, ropeL) - ropeW);
  d = min(d, sdSegment(p, anchor, ropeM) - ropeW);
  d = min(d, sdSegment(p, anchor, ropeR) - ropeW);
  d = min(d, length(p - anchor) - knotR);
  return d;
}

float hiveDist(vec2 pUV) {
  return hiveDistPx(pUV * uImageSize);
}

vec2 anchorPx() {
  vec2 sc = uImageSize / (uLayout < 0.5 ? vec2(1280.0, 720.0) : vec2(720.0, 1280.0));
  vec2 anchor = uLayout < 0.5 ? vec2(924.0, 48.0) : vec2(552.0, 648.0);
  return anchor * sc;
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
  // A few dozen pixels of plate stay outside the viewport, so a gust
  // samples real texels instead of the clamped border column.
  float gutter = 32.0;
  vec2 screenIn = mix(gutter / resolution, 1.0 - gutter / resolution, screen);
  vec2 p = clamp(uObjectPos + (screenIn - uObjectPos) * scale, vec2(0.0), vec2(1.0));

  float t = uTime;
  float settle = smoothstep(0.35, 1.45, t);
  // Layered sines only, so the motion never rewinds.
  float gust = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(t * 0.17));
  float breeze = sin(t * 0.42);
  float wind = (breeze * 0.78 + sin(t * 0.16 + 0.6) * 0.22) * (0.9 + 0.65 * gust);

  // Wide geometric falloff. The trunk stays put. Sky gaps in the canopy
  // move with the leaves, so a leaf edge is never peeled off the plate.
  float axis = 0.68;
  float halfW = 0.2;
  if (uLayout < 0.5) {
    axis = mix(0.70, 0.63, smoothstep(0.18, 0.95, p.y));
    halfW = mix(0.11, 0.42, smoothstep(0.22, 1.0, p.y));
  } else {
    axis = mix(0.76, 0.60, smoothstep(0.34, 0.96, p.y));
    halfW = mix(0.16, 0.48, smoothstep(0.40, 1.0, p.y));
  }
  float trunkCore = 1.0 - smoothstep(halfW * 0.32, halfW * 1.15, abs(p.x - axis));
  if (uLayout < 0.5) trunkCore *= smoothstep(0.02, 0.16, p.y);
  else trunkCore *= smoothstep(0.22, 0.42, p.y);
  float moveW = 1.0 - trunkCore;

  float canopyBand = 1.0 - smoothstep(0.36, 0.78, p.y);
  float grassBand = smoothstep(0.60, 0.90, p.y);
  canopyBand *= moveW;
  grassBand *= moveW;

  // Low spatial frequencies only, so neighboring pixels stay neighbors.
  float clump = 0.70 + 0.30 * sin(p.x * 3.1 + p.y * 1.3);
  float flutter = sin(p.x * 5.5 + p.y * 2.4 + t * 0.95);
  float wave = sin(p.x * 14.0 - t * 1.35);
  float wave2 = sin(p.x * 6.5 - t * 0.62 + p.y * 3.0);
  float blades = wave * 0.72 + wave2 * 0.28;
  float tip = mix(0.62, 1.0, smoothstep(0.0, 0.45, abs(p.x - axis)));

  vec2 canopyOff = vec2(
    (wind * 22.0 * clump + flutter * 4.0) * tip,
    sin(p.x * 4.2 + t * 0.7) * 2.6 * tip
  ) * canopyBand;
  vec2 grassOff = vec2(
    wind * 12.0 + blades * 18.0,
    sin(p.x * 8.0 - t * 1.15) * 3.6
  ) * grassBand;
  vec2 offsetPx = canopyOff + grassOff;

  // The hanger is rigid, so the plate warp falls off before it reaches the hive.
  float hiveGate = smoothstep(-2.0, 22.0, hiveDist(p));
  offsetPx *= hiveGate;
  // And it falls off at the viewport edges, on every width.
  vec2 edgePx = min(screen, 1.0 - screen) * resolution;
  float edgeFade = smoothstep(16.0, 72.0, min(edgePx.x, edgePx.y));
  offsetPx *= edgeFade;

  float limit = 36.0;
  float olen = length(offsetPx);
  if (olen > limit) offsetPx *= limit / olen;
  offsetPx *= settle;

  vec2 pxToUV = scale / resolution;
  vec2 plateUV = clamp(p + offsetPx * pxToUV, vec2(0.001), vec2(0.999));

  // Same swing as before: a few degrees, lagging the gust, pivoted at the knot.
  float hiveAngle = sin(t * 0.42 - 1.15) * (0.10 + 0.045 * gust) * settle;
  vec2 pivot = anchorPx();
  vec2 pix = p * uImageSize;
  vec2 src = pivot + rot(pix - pivot, -hiveAngle);
  vec2 srcUV = src / uImageSize;
  float dSrc = hiveDistPx(src);
  float inside = step(0.0, srcUV.x) * step(srcUV.x, 1.0) * step(0.0, srcUV.y) * step(srcUV.y, 1.0);
  float hiveAlpha = smoothstep(2.2, -1.0, dSrc) * inside;

  if (uDebug > 0.5) {
    vec3 dbg = vec3(trunkCore, canopyBand, grassBand);
    dbg = mix(dbg, vec3(1.0, 0.85, 0.1), hiveAlpha);
    gl_FragColor = vec4(dbg, 1.0);
    return;
  }

  vec3 plateCol = texture2D(uMap, vec2(plateUV.x, 1.0 - plateUV.y)).rgb;
  vec3 bgCol = plateCol;
  vec3 hiveCol = texture2D(uMap, vec2(srcUV.x, 1.0 - srcUV.y)).rgb;
  float dapple = sin(p.x * 7.2 + t * 0.28) * sin(p.y * 5.2 - t * 0.19);
  float dapple2 = sin(p.x * 15.0 - p.y * 6.0 - t * 0.63);
  float flick = dapple * 0.68 + dapple2 * 0.32;
  float shade = clamp(canopyBand * 1.15 + grassBand * 0.4, 0.0, 1.0) * (1.0 - hiveAlpha);
  bgCol *= 1.0 + flick * 0.07 * shade * settle;
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
  const image = texture.image as { width: number; height: number; naturalWidth?: number; naturalHeight?: number };
  return {
    uMap: { value: texture },
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
