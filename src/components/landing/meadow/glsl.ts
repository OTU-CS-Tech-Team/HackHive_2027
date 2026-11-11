import { VIEW } from "@/components/landing/meadow/palette";
import { TREE } from "@/components/landing/meadow/tree";

const VIEW_START_Z = VIEW.startZ;
const VIEW_FOV = VIEW.fov;

const COMMON = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHorizon;
uniform vec3 uForest;
uniform vec3 uHandoff;
uniform vec3 uSkyTop;
uniform vec3 uSkyMid;
uniform vec3 uAmbient;
uniform vec3 uCamPos;
uniform float uTime;
uniform float uWind;
uniform float uVeil;
uniform float uFogDensity;

float saturate(float x) { return clamp(x, 0.0, 1.0); }

vec3 atmospheric(vec3 color, float dist) {
  float fog = saturate(1.0 - exp(-dist * uFogDensity));
  fog *= smoothstep(6.0, 28.0, dist);
  float lift = smoothstep(16.0, 48.0, dist);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 soft = mix(color, vec3(luma), lift * 0.78);
  vec3 fogColor = mix(uHorizon, uHandoff, uVeil);
  soft = mix(soft, fogColor, fog);
  soft = mix(soft, uHandoff, uVeil);
  return soft;
}

float washHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float washNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = washHash(i);
  float b = washHash(i + vec2(1.0, 0.0));
  float c = washHash(i + vec2(0.0, 1.0));
  float d = washHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/* Soft colour in the far meadow. Broad and low contrast, with no hard islands. */
vec3 driftTint(vec3 grass, vec2 xz, float mask) {
  float center = sin(xz.y * 0.33) * 0.14 + sin(xz.y * 0.91 + 1.7) * 0.06;
  float lateral = abs(xz.x - center);
  float side = mix(0.55, 1.0, smoothstep(0.4, 2.6, lateral));
  float far = smoothstep(1.4, -1.2, xz.y);
  far *= 1.0 - smoothstep(-4.0, -11.0, xz.y);
  float n = washNoise(xz * 0.55);
  float n2 = washNoise(xz * 1.15 + 4.2);
  vec3 rose = vec3(0.82, 0.58, 0.56);
  vec3 gold = vec3(0.88, 0.74, 0.44);
  vec3 lilac = vec3(0.68, 0.6, 0.82);
  vec3 tint = mix(rose, gold, n);
  tint = mix(tint, lilac, smoothstep(0.2, 0.8, n2));
  float amount = side * far * (0.22 + 0.16 * n2) * mask * (1.0 - uVeil);
  return mix(grass, tint, amount);
}
`;

/** Where the trunk stands once the aspect shift is applied. Shared by the path, bark, and blossoms. */
const TREE_PLACE = /* glsl */ `
float treeAnchor(float aspect) {
  float wide = smoothstep(0.95, 1.45, max(aspect, 0.3));
  float phone = 1.0 - smoothstep(0.5, 0.72, aspect);
  float midBand = (1.0 - wide) * (1.0 - phone);
  return ${TREE.x.toFixed(3)}
    + midBand * ${TREE.shiftMid.toFixed(3)}
    + wide * ${TREE.shiftWide.toFixed(3)}
    + phone * ${(TREE.shiftPhone + TREE.phoneSlide).toFixed(3)};
}

float treeDepth(float aspect) {
  float phone = 1.0 - smoothstep(0.5, 0.72, aspect);
  return ${TREE.z.toFixed(2)} + phone * ${TREE.phoneReach.toFixed(2)};
}
`;

/**
 * Bark and blossoms share this, so the limbs always meet the crown.
 * 1280 keeps the authored tree. 768 narrows it beside the title. A phone
 * scales it evenly about the trunk base, so the crown keeps its shape.
 * Returns the x scale, which the blossom cards use for their size.
 */
const TREE_FIT = TREE_PLACE + /* glsl */ `
float placeTree(inout vec3 world, float aspect) {
  float anchor = treeAnchor(aspect);
  world.x += anchor - ${TREE.x.toFixed(3)};
  float narrow = 1.0 - smoothstep(0.72, 1.15, max(aspect, 0.3));
  float phone = 1.0 - smoothstep(0.5, 0.72, aspect);
  float sx = mix(mix(1.0, 0.54, narrow), ${TREE.phoneScale.toFixed(3)}, phone);
  float sy = mix(mix(1.0, 0.76, narrow), ${TREE.phoneScale.toFixed(3)}, phone);
  float sz = mix(1.0, ${TREE.phoneScale.toFixed(3)}, phone);
  world.x = anchor + (world.x - anchor) * sx;
  world.y = ${TREE.baseY.toFixed(3)} + (world.y - ${TREE.baseY.toFixed(3)}) * sy;
  world.z = ${TREE.z.toFixed(3)} + (world.z - ${TREE.z.toFixed(3)}) * sz + phone * ${TREE.phoneReach.toFixed(2)};
  return sx;
}
`;

/** Path centre and width, shared by the ground and the grass discard. */
const PATH = TREE_PLACE + /* glsl */ `
float meadowHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float pathLine(float z) {
  return sin(z * 0.33) * 0.14 + sin(z * 0.91 + 1.7) * 0.06;
}

float pathBase(float aspect) {
  float narrow = 1.0 - smoothstep(0.62, 1.15, max(aspect, 0.3));
  return mix(1.05, 0.42, narrow);
}

uniform float uAspect;

float pathEase(float z) {
  float approach = 1.0 - smoothstep(treeDepth(uAspect), 4.6, z);
  return approach * approach * (3.0 - 2.0 * approach);
}

float pathCenter(float z, float aspect) {
  return mix(pathLine(z), treeAnchor(aspect), pathEase(z));
}

float pathHalfWidth(float aspect, float z) {
  return pathBase(aspect) * mix(1.0, 0.62, pathEase(z));
}

float pathEndFade(float z) {
  float treeZ = treeDepth(uAspect);
  return smoothstep(treeZ - 0.75, treeZ + 0.2, z);
}
`;

/**
 * Vertex-only, and the last word on the path: any flower whose head would
 * reach the painted dirt slides out to the nearer shoulder that is still in
 * frame. It runs after every other shift, so it holds at every width and at
 * every point of the walk. stem is the instance height, a stand-in for how
 * far the bloom spreads from its foot.
 */
const PARK_FLOWER = /* glsl */ `
void parkOffPath(inout vec3 world, vec3 foot, float stem) {
  if (foot.y > 0.2) return;
  if (pathEndFade(foot.z) < 0.12) return;
  float center = pathCenter(foot.z, uAspect);
  float halfW = pathHalfWidth(uAspect, foot.z);
  // The painted dirt reads to about 0.85 of the half-width plus its soft
  // edge. A bloom is about 0.45 of its height across, so its foot keeps
  // that much more room.
  float reach = stem * 0.45;
  float limit = max(halfW * 0.92 + 0.16, halfW * 0.85 + 0.12 + reach);
  if (abs(foot.x - center) >= limit) return;
  float scatter = fract(sin(foot.z * 17.1 + foot.x * 9.3) * 43758.5453);
  float aspectT = clamp((uAspect - 0.46) / 0.29, 0.0, 1.35);
  float visible = mix(1.3 - foot.z * 0.191, 2.12 - foot.z * 0.31, min(aspectT, 1.0));
  visible += max(0.0, aspectT - 1.0) * 0.4;
  // The portrait edge is too narrow for a wide frame, and it was stacking
  // every in-path flower into one left-hand strip. The wide frame can see
  // past the tree, so use the same half-width the layout uses.
  float wide = smoothstep(0.95, 1.45, max(uAspect, 0.3));
  float wideEdge = max(0.9, 1.79 + (3.84 - foot.z) * 0.67);
  float edge = mix(max(visible, 0.4) * 0.94, wideEdge * 0.96, wide);
  float left = center - limit - 0.16 - scatter * 0.42;
  float right = center + limit + 0.16 + scatter * 0.42;
  float lane = foot.x < center ? left : right;
  if (lane > edge) lane = min(left, edge - scatter * 0.08);
  if (lane < -edge) lane = max(right, -edge + scatter * 0.08);
  world.x += lane - foot.x;
}
`;

export const PLANT_VERT = PATH + PARK_FLOWER + /* glsl */ `
attribute float aPhase;
attribute float aBend;
attribute vec3 aTint;
attribute vec2 aSpan;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec2 vSpan;

uniform float uTime;
uniform float uWind;
uniform float uSss;

void settlePortrait(inout vec3 world, vec3 origin) {
  float narrow = 1.0 - smoothstep(0.62, 1.15, max(uAspect, 0.3));
  if (narrow < 0.02 || origin.y >= 0.2) return;
  float ax = abs(origin.x);
  if (ax < 0.05) return;
  float aspectT = clamp((uAspect - 0.46) / 0.29, 0.0, 1.35);
  float visible = mix(1.3 - origin.z * 0.191, 2.12 - origin.z * 0.31, min(aspectT, 1.0));
  visible += max(0.0, aspectT - 1.0) * 0.4;
  if (ax <= visible) return;
  float edge = visible * 0.97;
  float over = clamp((ax - visible) / max(visible, 0.2), 0.0, 1.0);
  float pulled = mix(edge, visible * 0.72, over * 0.85);
  world.x += origin.x * (pulled / ax - 1.0);
}

void main() {
  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = mat3(instanceMatrix) * normal;
  #else
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normal;
  #endif
  #ifdef USE_INSTANCING
    vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  if (uSss > 0.2) {
    vec3 shifted = world.xyz;
    settlePortrait(shifted, origin);
    vec3 foot = origin;
    settlePortrait(foot, origin);
    float phone = 1.0 - smoothstep(0.5, 0.72, max(uAspect, 0.3));
    #ifdef USE_INSTANCING
      float stem = length(instanceMatrix[1].xyz);
    #else
      float stem = 1.0;
    #endif
    if (phone > 0.85 && foot.y < 0.2 && foot.z > 0.9 && foot.z < 3.45) {
      float trunkX = ${(TREE.x + TREE.shiftPhone + TREE.phoneSlide).toFixed(2)};
      float cover = 1.0 - smoothstep(0.42, 0.58, abs(foot.x - trunkX));
      // In front of the far tree, half the column stays on the right of the
      // path and half fills the lawn on its left, so neither side is bare.
      float split = step(0.5, fract(sin(origin.x * 31.7 + origin.z * 7.3) * 43758.5453));
      cover *= 1.0 - split * step(${(TREE.z + TREE.phoneReach + 0.3).toFixed(2)}, foot.z);
      // Short flowers already to the right of the trunk stay in the grass
      // below it. Tall spikes in that column still slide left.
      if (stem < 0.24 && foot.x > trunkX - 0.05) cover = 0.0;
      float approach = 1.0 - smoothstep(${(TREE.z + TREE.phoneReach).toFixed(2)}, 4.6, origin.z);
      float ease = approach * approach * (3.0 - 2.0 * approach);
      float line = sin(origin.z * 0.33) * 0.14 + sin(origin.z * 0.91 + 1.7) * 0.06;
      float center = mix(line, trunkX, ease);
      float halfW = 0.42 * mix(1.0, 0.62, ease);
      float scatter = fract(sin(origin.z * 12.3 + origin.x * 4.7) * 43758.5453);
      float lane = center - halfW - 0.28 - scatter * 0.5;
      float delta = (lane - foot.x) * cover;
      shifted.x += delta;
      foot.x += delta;
    }
    parkOffPath(shifted, foot, stem);
    // Narrow frames only. The nearest big lilies were covering the left
    // foreground. Step them back so the daisies and lupins read. 1280 has
    // narrowBed at 0, so this does not move a flower there.
    float narrowBed = 1.0 - smoothstep(0.62, 1.15, max(uAspect, 0.3));
    if (narrowBed > 0.35 && stem > 0.24 && foot.y < 0.2 && foot.z > 1.7 && foot.x < pathCenter(foot.z, uAspect) - 0.05) {
      shifted.z -= 0.62 * narrowBed;
    }
    world.xyz = shifted;
  } else if (abs(origin.x) > 0.8 && origin.y < 0.2) {
    float narrow = 1.0 - smoothstep(0.62, 1.15, max(uAspect, 0.3));
    float outer = mix(0.98, 0.42, narrow);
    float squeeze = min(1.0, (outer + 0.1) / 0.84);
    world.x += origin.x * (squeeze - 1.0);
  }
  float height = clamp(position.y, 0.0, 1.0);
  float sway = sin(uTime * 1.32 + aPhase + world.x * 0.16) * uWind * aBend;
  sway *= pow(height, 1.45);
  world.x += sway * 0.2;
  world.z += sway * 0.09;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vSpan = aSpan;
  #ifdef USE_COLOR
    vColor = color * aTint;
  #else
    vColor = aTint;
  #endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Lupin colours are display-space sRGB (hex / 255). The renderer is linear with
 * no tone mapping, so this shader must not darken them again. aTint is the
 * base, aTip is the tip, and color.r is the height along the spike. A stem
 * vertex keeps its own green (color.b stays below 1).
 */
export const LUPIN_VERT = PATH + PARK_FLOWER + /* glsl */ `
attribute float aPhase;
attribute float aBend;
attribute vec3 aTint;
attribute vec3 aTip;

varying vec3 vColor;
varying vec3 vTint;
varying vec3 vTip;
varying vec3 vNormal;
varying vec3 vWorld;

uniform float uTime;
uniform float uWind;

void settlePortrait(inout vec3 world, vec3 origin) {
  float narrow = 1.0 - smoothstep(0.62, 1.15, max(uAspect, 0.3));
  if (narrow < 0.02 || origin.y >= 0.2) return;
  float ax = abs(origin.x);
  if (ax < 0.05) return;
  float aspectT = clamp((uAspect - 0.46) / 0.29, 0.0, 1.35);
  float visible = mix(1.3 - origin.z * 0.191, 2.12 - origin.z * 0.31, min(aspectT, 1.0));
  visible += max(0.0, aspectT - 1.0) * 0.4;
  if (ax <= visible) return;
  float edge = visible * 0.97;
  float over = clamp((ax - visible) / max(visible, 0.2), 0.0, 1.0);
  float pulled = mix(edge, visible * 0.72, over * 0.85);
  world.x += origin.x * (pulled / ax - 1.0);
}

void main() {
  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = mat3(instanceMatrix) * normal;
  #else
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normal;
  #endif
  #ifdef USE_INSTANCING
    vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  vec3 shifted = world.xyz;
  settlePortrait(shifted, origin);
  vec3 foot = origin;
  settlePortrait(foot, origin);
  // Phone only. The narrow settle stacks the right-hand lupins on the
  // trunk. Slide that column off to the left of the path. 768 and 1280
  // have phone at 0, so this is a no-op there.
  float phone = 1.0 - smoothstep(0.5, 0.72, max(uAspect, 0.3));
  #ifdef USE_INSTANCING
    float stem = length(instanceMatrix[1].xyz);
  #else
    float stem = 1.0;
  #endif
  if (phone > 0.85 && foot.y < 0.2 && foot.z > 0.9 && foot.z < 3.45) {
    float trunkX = ${(TREE.x + TREE.shiftPhone + TREE.phoneSlide).toFixed(2)};
    float cover = 1.0 - smoothstep(0.42, 0.58, abs(foot.x - trunkX));
    // The short spikes in the bed right of the far tree stay there. They
    // pass under the phone crown, so they never hide the trunk.
    if (stem < 0.32 && foot.x > trunkX + 0.08) cover = 0.0;
    float approach = 1.0 - smoothstep(${(TREE.z + TREE.phoneReach).toFixed(2)}, 4.6, origin.z);
    float ease = approach * approach * (3.0 - 2.0 * approach);
    float line = sin(origin.z * 0.33) * 0.14 + sin(origin.z * 0.91 + 1.7) * 0.06;
    float center = mix(line, trunkX, ease);
    float halfW = 0.42 * mix(1.0, 0.62, ease);
    float scatter = fract(sin(origin.z * 12.3 + origin.x * 4.7) * 43758.5453);
    float lane = center - halfW - 0.28 - scatter * 0.5;
    float delta = (lane - foot.x) * cover;
    shifted.x += delta;
    foot.x += delta;
  }
  parkOffPath(shifted, foot, stem);
  // Narrow frames only. Bring some left lupins forward so the foreground
  // matches the mixed 1280 bed. 1280 has narrowBed at 0.
  float narrowBed = 1.0 - smoothstep(0.62, 1.15, max(uAspect, 0.3));
  float pick = fract(sin(foot.z * 12.7 + foot.x * 4.1) * 43758.5453);
  if (narrowBed > 0.35 && pick > 0.22 && foot.y < 0.2 && foot.x < pathCenter(foot.z, uAspect) - 0.1 && foot.z > 1.2 && foot.z < 3.5) {
    shifted.z += 0.42 * narrowBed;
  }
  world.xyz = shifted;
  float height = clamp(position.y, 0.0, 1.0);
  float sway = sin(uTime * 1.32 + aPhase + world.x * 0.16) * uWind * aBend;
  sway *= pow(height, 1.45);
  world.x += sway * 0.2;
  world.z += sway * 0.09;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vTint = aTint;
  vTip = aTip;
  #ifdef USE_COLOR
    vColor = color;
  #else
    vColor = vec3(0.0);
  #endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const LUPIN_FRAG = COMMON + PATH + /* glsl */ `
varying vec3 vColor;
varying vec3 vTint;
varying vec3 vTip;
varying vec3 vNormal;
varying vec3 vWorld;

uniform float uRim;

void main() {
  if (pathEndFade(vWorld.z) > 0.12 && abs(vWorld.x - pathCenter(vWorld.z, uAspect)) < pathHalfWidth(uAspect, vWorld.z) * 0.34) discard;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 albedo = vColor.b > 1.5 ? mix(vTint, vTip, saturate(vColor.r)) : vColor.rgb;
  float ndl = dot(n, normalize(uSunDir));
  float sunFace = saturate(ndl * 0.5 + 0.5);
  vec3 lit = albedo * (0.96 + 0.1 * sunFace);
  float facing = saturate(dot(n, normalize(uCamPos - vWorld)));
  float rim = pow(1.0 - facing, 1.8);
  lit += albedo * rim * uRim;
  gl_FragColor = vec4(atmospheric(lit, distance(vWorld, uCamPos)), 1.0);
}
`;

export const PLANT_FRAG = COMMON + PATH + /* glsl */ `
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec2 vSpan;

uniform float uSss;
uniform float uRim;
uniform vec3 uEmissive;

void main() {
  float fade = pathEndFade(vWorld.z);
  float offPath = abs(vWorld.x - pathCenter(vWorld.z, uAspect));
  float halfPath = pathHalfWidth(uAspect, vWorld.z);
  if (uSss < 0.2) {
    if (fade > 0.12 && offPath < halfPath * 0.78) discard;
  } else if (fade > 0.2 && offPath < halfPath * 0.34) {
    discard;
  }
  vec3 n = normalize(vNormal);
  if (uRim > 0.5 && uSss < 0.5 && !gl_FrontFacing) n = -n;
  float foliage = step(vSpan.y, -0.02);
  float across = abs(vSpan.x);
  float along = clamp(vSpan.y, 0.0, 1.0);
  float acrossPx = max(fwidth(across), 0.015);
  float alongPx = max(fwidth(along), 0.012);
  float skirt = mix(0.62, 0.22, step(uSss, 0.2));
  float side = 1.0 - smoothstep(max(skirt, 1.0 - acrossPx * 3.0), 1.0, across);
  float tip = 1.0 - smoothstep(max(0.62, 1.0 - alongPx * 2.4), 1.0, along);
  float leaf = 1.0 - smoothstep(0.92, 1.0, across);
  vec3 sun = normalize(uSunDir);
  float ndl = dot(n, sun);
  float isPetal = step(0.7, uSss) * (1.0 - foliage);
  float alpha = foliage > 0.5 ? leaf : side * tip;
  vec3 lit;
  if (isPetal > 0.5) {
    float toTip = saturate(along * 0.85 + across * 0.2);
    vec3 albedo = mix(vec3(1.0, 0.9804, 0.9412), vec3(1.0), toTip);
    float throat = (1.0 - smoothstep(0.02, 0.46, along)) * (1.0 - smoothstep(0.12, 0.72, across));
    albedo = mix(albedo, vec3(0.84, 0.91, 0.48), throat);
    float shade = 0.74 + 0.32 * saturate(ndl * 0.7 + 0.3);
    shade *= 1.0 - (1.0 - smoothstep(0.0, 0.5, along)) * (1.0 - across) * 0.2;
    float back = pow(saturate(-ndl), 1.15);
    float thin = pow(1.0 - abs(ndl), 1.3);
    float facing = saturate(dot(n, normalize(uCamPos - vWorld)));
    float rim = pow(1.0 - facing, 1.5);
    float edge = 1.0 - smoothstep(0.7, 1.0, across);
    float tipFade = 1.0 - smoothstep(0.8, 1.0, along);
    lit = albedo * shade * (1.0 + back * 0.14 + thin * 0.08);
    lit += vec3(1.0) * rim * 0.22 * (1.0 - throat);
    alpha = edge * tipFade;
  } else {
    float wrap = saturate(ndl * 0.55 + 0.46);
    lit = vColor * (uAmbient * 0.8 + uSunColor * wrap * 0.6);
    lit = atmospheric(lit, distance(vWorld, uCamPos));
  }
  if (uSss < 0.2) {
    alpha = (1.0 - smoothstep(0.88, 1.0, across)) * (1.0 - smoothstep(0.94, 1.0, along));
  }
  if (alpha < 0.02) discard;
  // Grass and daisies are opaque cutouts. A partial alpha here went
  // straight into the canvas and let the page show through blade edges
  // as pale specks, so cut at half and write a solid pixel.
  if (uSss < 0.7) {
    if (alpha < 0.5) discard;
    alpha = 1.0;
  }
  if (uSss > 0.7) lit *= alpha;
  gl_FragColor = vec4(lit, alpha);
}
`;

export const GROUND_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const GROUND_FRAG = COMMON + PATH + /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;

uniform vec3 uGrassNear;
uniform vec3 uGrassFar;
uniform vec3 uPath;
uniform vec3 uPathEdge;

float grassHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float grassBlade(vec2 xz, float scale, float salt) {
  vec2 g = xz * scale;
  float pixels = max(fwidth(g.x), fwidth(g.y));
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float n = grassHash(cell + salt);
  float n2 = grassHash(cell + salt + 3.7);
  vec2 center = vec2(0.12 + n * 0.76, 0.12 + n2 * 0.76);
  vec2 d = (f - center) * vec2(1.0, 1.85);
  float detail = 1.0 - smoothstep(0.4, 1.15, pixels);
  return smoothstep(0.78, 0.22, length(d)) * detail;
}

float grassTuft(vec2 xz) {
  float a = grassBlade(xz, 46.0, 1.1);
  float b = grassBlade(xz + 0.07, 71.0, 4.8);
  return clamp(a * 0.58 + b * 0.42, 0.0, 1.0);
}

vec3 meadowColor(vec3 world, float dist) {
  vec3 ray = normalize(world - uCamPos);
  float down = saturate((-ray.y - 0.004) / 0.46);
  down = down * down * (3.0 - 2.0 * down);
  vec3 grass = mix(uHorizon, uGrassNear, down);
  float field = grassTuft(world.xz);
  vec3 mote = vec3(0.28, 0.46, 0.18);
  float cover = down * (1.0 - smoothstep(16.0, 62.0, dist));
  grass = mix(grass, mote, field * cover * 0.22);
  return driftTint(grass, world.xz, 1.0);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = meadowHash(i);
  float b = meadowHash(i + vec2(1.0, 0.0));
  float c = meadowHash(i + vec2(0.0, 1.0));
  float d = meadowHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float pebbleDot(vec2 xz) {
  vec2 p = xz * vec2(8.5, 11.0);
  vec2 i = floor(p);
  float keep = step(0.9, meadowHash(i + 4.2));
  vec2 center = vec2(0.22 + meadowHash(i + 1.7) * 0.56, 0.22 + meadowHash(i + 2.9) * 0.56);
  return keep * (1.0 - smoothstep(0.03, 0.12, length(fract(p) - center)));
}

void main() {
  if (vWorld.z < -5.5) {
    gl_FragColor = vec4(uGrassFar, 1.0);
    return;
  }
  float dist = distance(vWorld, uCamPos);
  vec3 grass = meadowColor(vWorld, dist);
  float lateral = vWorld.x - pathCenter(vWorld.z, uAspect);
  float wobble = (valueNoise(vWorld.xz * 0.42) - 0.5) * 0.36;
  float pathHalf = pathHalfWidth(uAspect, vWorld.z) + wobble * pathEndFade(vWorld.z);
  float edge = mix(0.2, 0.62, 1.0 - smoothstep(-6.5, 0.3, vWorld.z));
  edge += (valueNoise(vWorld.xz * 0.73 + 3.1) - 0.5) * 0.2;
  float pathMask = (1.0 - smoothstep(pathHalf * 0.42, pathHalf + edge, abs(lateral))) * pathEndFade(vWorld.z);
  vec3 pathCol = mix(uPath, uPathEdge, 0.22);
  float tone = valueNoise(vWorld.xz * 0.16);
  pathCol *= mix(0.93, 1.07, tone);
  float worldPx = max(fwidth(vWorld.x), fwidth(vWorld.z));
  float gritDetail = 1.0 - smoothstep(0.04, 0.1, worldPx);
  float grit = valueNoise(vWorld.xz * vec2(37.0, 48.0));
  float fine = valueNoise(vWorld.xz * vec2(71.0, 93.0) + 8.0);
  pathCol *= 1.0 + ((grit - 0.5) * 0.18 + (fine - 0.5) * 0.07) * gritDetail * (1.0 - uVeil);
  float footShade = 1.0 - smoothstep(0.0, pathHalf * 0.95, abs(lateral));
  pathCol *= 1.0 - footShade * 0.03 * (1.0 - uVeil);
  pathCol = mix(pathCol, pathCol * vec3(0.58, 0.48, 0.36), pebbleDot(vWorld.xz) * 0.85 * gritDetail * (1.0 - uVeil));
  pathCol = mix(pathCol, min(pathCol * vec3(1.08, 1.02, 0.94), vec3(0.86, 0.7, 0.48)), pebbleDot(vWorld.xz + 13.0) * 0.45 * gritDetail);
  pathCol = mix(pathCol, uHandoff, uVeil);
  grass = mix(grass, uHandoff, uVeil);
  vec3 albedo = mix(grass, pathCol, pathMask);
  float wrap = saturate(dot(normalize(vNormal), normalize(uSunDir)) * 0.35 + 0.72);
  vec3 lit = albedo * (uAmbient * 0.74 + uSunColor * wrap * 0.4);
  vec3 fogged = atmospheric(lit, dist);
  gl_FragColor = vec4(mix(fogged, lit, pathMask), 1.0);
}
`;

export const HILL_VERT = /* glsl */ `
attribute vec2 aSpan;
varying vec3 vWorld;
varying vec3 vColor;
varying float vLift;
uniform float uAspect;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float portrait = 1.0 - smoothstep(0.7, 1.02, max(uAspect, 0.3));
  float phone = 1.0 - smoothstep(0.5, 0.72, uAspect);
  // A tablet keeps layered peaks on both sides, close to the wide frame.
  // A phone stays near full height.
  float scale = mix(1.0, 0.9, portrait);
  scale = mix(scale, 0.84, phone);
  float range = 1.0 - smoothstep(-15.0, -5.0, world.z);
  world.y *= mix(1.0, scale, range);
  // The near green hill's right shoulder stays low so it doesn't cover the ranges
  // or run into the top-right corner.
  float corner = (1.0 - phone) * portrait * smoothstep(0.8, 7.0, world.x) * smoothstep(-12.0, -3.5, world.z);
  world.y *= mix(1.0, 0.28, corner);
  vWorld = world.xyz;
  vColor = color;
  vLift = aSpan.x;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const HILL_FRAG = COMMON + /* glsl */ `
varying vec3 vWorld;
varying vec3 vColor;
varying float vLift;

void main() {
  float dist = distance(vWorld, uCamPos);
  float lift = saturate(vLift);
  float n = washNoise(vWorld.xz * 0.16);
  float ragged = saturate(lift + (n - 0.5) * 0.18);
  vec3 ridge = vColor * mix(vec3(1.0), vec3(0.94, 0.92, 0.98), lift);
  vec3 foot = mix(vColor, uSkyMid, 0.22);
  foot = mix(foot, foot * vec3(0.96, 0.98, 1.05), 0.4);
  vec3 col = mix(foot, ridge, smoothstep(0.08, 0.82, ragged));
  col *= mix(0.98, 1.02, n);
  col = mix(col, uSkyMid, smoothstep(0.9, 1.0, ragged) * 0.35);
  float flank = saturate(vWorld.x * 0.03 + 0.1) * smoothstep(0.25, 0.8, lift);
  col = mix(col, min(col * vec3(1.05, 1.02, 0.99) + vec3(0.025, 0.012, 0.0), vec3(1.0)), flank * 0.4);
  float nearHill = smoothstep(-18.0, -6.5, vWorld.z) * (1.0 - smoothstep(-5.2, -2.6, vWorld.z));
  float cream = smoothstep(0.9, 2.5, vWorld.y) * nearHill;
  col = mix(col, mix(col, uHorizon, 0.28), cream * 0.3);
  float title = (1.0 - smoothstep(0.2, 6.5, abs(vWorld.x))) * smoothstep(0.4, 1.55, vWorld.y) * (1.0 - smoothstep(1.7, 2.6, vWorld.y));
  col = mix(col, mix(uHorizon, uSkyTop, 0.3), title * nearHill * 0.48);
  col = mix(col, uHandoff, uVeil);
  float wrap = saturate(uSunDir.y * 0.35 + 0.72);
  vec3 lit = col * (uAmbient * 0.74 + uSunColor * wrap * 0.4);
  vec3 shaded = mix(lit, atmospheric(lit, dist), 0.1);
  float footWash = (1.0 - smoothstep(0.2, 1.15, vWorld.y)) * nearHill;
  if (footWash > 0.02) shaded = driftTint(shaded, vWorld.xz, footWash);
  gl_FragColor = vec4(shaded, 1.0);
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}
`;

export const SKY_FRAG = COMMON + /* glsl */ `
varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 mid = mix(uHorizon, uSkyMid, smoothstep(0.0, 0.2, h));
  vec3 col = mix(mid, uSkyTop, smoothstep(0.08, 0.5, h));
  col = mix(col, uSkyTop, smoothstep(0.42, 0.72, h));
  float sunDot = saturate(dot(dir, normalize(uSunDir)));
  col += uSunColor * pow(sunDot, 96.0) * 0.42;
  col += uSunColor * pow(sunDot, 7.0) * 0.14;
  col = mix(col, uHandoff, uVeil);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uWind;
uniform float uAspect;
attribute float aPhase;

void main() {
  vUv = uv;
  #ifdef USE_INSTANCING
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  #else
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 size = vec2(1.0);
  #endif
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float narrow = 1.0 - smoothstep(0.72, 1.05, max(uAspect, 0.3));
  float phone = 1.0 - smoothstep(0.5, 0.72, uAspect);
  vec2 fitted = size * mix(1.0, 0.84, narrow);
  // Drift right forever and wrap. The loop is as wide as the frame at this
  // depth plus the cloud, measured from the trailhead and in the unsquashed
  // space below, so a cloud leaves the right edge in full before it comes
  // back in from the left. At uTime 0 every cloud is where the poster has it.
  // Reduced motion holds uTime, so the sky stays still.
  float squash = mix(1.0, 0.38, narrow) * mix(1.0, 0.62, phone);
  float depth = max(${VIEW_START_Z.toFixed(2)} - center.z, 1.0);
  float frameHalf = depth * ${Math.tan(((VIEW_FOV / 2) * Math.PI) / 180).toFixed(4)} * max(uAspect, 0.3) / squash;
  float loop = 2.0 * (frameHalf * 1.08 + 0.5 * fitted.x + 0.6);
  float speed = mix(0.06, 0.11, smoothstep(-13.0, -6.5, center.z));
  float x0 = center.x + sin(uTime * 0.035 + aPhase) * uWind * 0.7;
  center.x = mod(x0 + uTime * speed + 0.5 * loop, loop) - 0.5 * loop;
  vec3 puff = right * position.x * fitted.x + up * position.y * fitted.y;
  vec3 world = center + puff;
  world.x *= squash;
  world.y -= narrow * 0.85 + phone * 0.15;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const CLOUD_FRAG = COMMON + /* glsl */ `
varying vec2 vUv;
uniform float uAspect;

float puff(vec2 p, vec2 c, vec2 r) {
  return smoothstep(1.0, 0.36, length((p - c) / r));
}

void main() {
  vec2 p = vUv - 0.5;
  float shape = puff(p, vec2(0.0, 0.05), vec2(0.4, 0.2));
  shape = max(shape, puff(p, vec2(-0.22, 0.01), vec2(0.24, 0.15)));
  shape = max(shape, puff(p, vec2(0.2, 0.03), vec2(0.26, 0.16)));
  shape = max(shape, puff(p, vec2(-0.04, 0.16), vec2(0.2, 0.13)));
  shape = max(shape, puff(p, vec2(0.12, 0.17), vec2(0.18, 0.12)));
  shape = max(shape, puff(p, vec2(0.02, -0.07), vec2(0.28, 0.13)));
  float body = smoothstep(0.4, 0.68, shape);
  float edge = smoothstep(0.14, 0.4, shape);
  float alpha = max(body, edge * 0.62) * (1.0 - uVeil);
  if (alpha < 0.02) discard;
  float lift = saturate(p.y * 2.5 + 0.58);
  float narrow = 1.0 - smoothstep(0.72, 1.05, max(uAspect, 0.3));
  vec3 underside = mix(vec3(0.56, 0.64, 0.76), vec3(0.74, 0.8, 0.88), narrow * 0.45);
  vec3 col = mix(underside, vec3(1.0), smoothstep(0.02, 0.7, lift));
  gl_FragColor = vec4(col, min(1.0, alpha * 1.2));
}
`;

export const SPARK_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSize;
attribute vec3 aTint;

varying vec3 vTint;
varying float vFog;

uniform float uTime;
uniform float uWind;
uniform vec3 uCamPos;
uniform float uFogDensity;
uniform float uVeil;

void main() {
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  world.y += sin(uTime * 1.4 + aPhase) * uWind * 0.03;
  vec4 viewPos = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * viewPos;
  gl_PointSize = clamp(aSize * 110.0 / max(0.2, -viewPos.z), 1.1, 3.6);
  vTint = aTint;
  float dist = distance(world, uCamPos);
  vFog = exp(-dist * uFogDensity * 0.55) * (1.0 - uVeil);
}
`;

export const SPARK_FRAG = /* glsl */ `
varying vec3 vTint;
varying float vFog;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float radius = length(p);
  float alpha = pow(clamp(1.0 - radius, 0.0, 1.0), 2.1);
  if (alpha < 0.08) discard;
  vec3 col = vTint * (0.28 + 0.22 * (1.0 - radius));
  gl_FragColor = vec4(col * vFog, alpha * 0.38);
}
`;

export const BARK_VERT = TREE_FIT + /* glsl */ `
attribute vec3 color;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
uniform float uTime;
uniform float uWind;
uniform float uAspect;

void main() {
  vec3 p = position;
  float h = clamp(position.y, 0.0, 1.2);
  p.x += sin(uTime * 0.7) * uWind * h * h * 0.012;
  vec4 world = modelMatrix * vec4(p, 1.0);
  placeTree(world.xyz, uAspect);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vColor = color;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const BARK_FRAG = COMMON + /* glsl */ `
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float ndl = saturate(dot(n, normalize(uSunDir)) * 0.45 + 0.62);
  vec3 lit = vColor * (0.78 + 0.4 * ndl);
  float facing = saturate(dot(n, normalize(uCamPos - vWorld)));
  lit += vec3(1.0, 0.74, 0.58) * pow(1.0 - facing, 2.0) * 0.16;
  gl_FragColor = vec4(atmospheric(lit, distance(vWorld, uCamPos)), 1.0);
}
`;

export const BLOSSOM_VERT = TREE_FIT + /* glsl */ `
attribute float aPhase;
attribute vec3 aTint;
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vWorld;
varying float vKind;
uniform float uTime;
uniform float uWind;
uniform float uAspect;

void main() {
  vUv = uv;
  vTint = aTint;
  vKind = aPhase;
  #ifdef USE_INSTANCING
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  #else
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 size = vec2(1.0);
  #endif
  float phone = 1.0 - smoothstep(0.5, 0.72, uAspect);
  // Same placement as the bark, so the limbs still meet the crown.
  float squeeze = placeTree(center, uAspect);
  size *= squeeze;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = center;
  bool shadow = aPhase > 20.5 && aPhase < 22.0;
  if (aPhase > 22.0) {
    float fall = fract(uTime * 0.055 * max(uWind, 0.0) + aPhase * 0.17);
    world.y -= fall * 1.15 * mix(1.0, squeeze, phone);
    world.x += sin(uTime * 0.7 + aPhase) * 0.28 * squeeze * max(uWind, 0.0);
    world.z += cos(uTime * 0.5 + aPhase * 1.3) * 0.2 * squeeze * max(uWind, 0.0);
    size *= mix(1.0, 0.4, fall);
    world += right * position.x * size.x + up * position.y * size.y;
  } else if (shadow) {
    world = vec3(center.x + position.x * size.x, center.y + 0.025, center.z + position.y * size.y);
  } else {
    world.x += sin(uTime * 0.55 + aPhase) * uWind * 0.016;
    world.y += sin(uTime * 0.4 + aPhase * 1.7) * uWind * 0.01;
    world += right * position.x * size.x + up * position.y * size.y;
  }
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const BLOSSOM_FRAG = COMMON + /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vWorld;
varying float vKind;
uniform float uAspect;

float disc(vec2 p, vec2 c, float radius) {
  float d = length(p - c) / radius;
  return smoothstep(1.02, 0.74, d);
}

float cluster(vec2 p, float ang) {
  float alpha = disc(p, vec2(0.0, -0.01), 0.12);
  for (int i = 0; i < 5; i += 1) {
    float t = ang + float(i) * 1.256637;
    vec2 c = vec2(cos(t), sin(t)) * 0.11;
    alpha = max(alpha, disc(p, c, 0.18));
  }
  return alpha;
}

void main() {
  vec2 p = vUv - 0.5;
  float shadow = step(20.5, vKind) * (1.0 - step(22.0, vKind));
  float glow = step(8.0, vKind) * (1.0 - step(20.0, vKind));
  float alpha = 0.0;
  float ang = 0.0;
  if (shadow > 0.5) {
    alpha = smoothstep(0.5, 0.02, length(p * vec2(0.9, 1.25)));
    alpha *= 0.28 * (1.0 - uVeil);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vec3(0.22, 0.32, 0.16), alpha);
    return;
  }
  if (glow > 0.5) {
    alpha = disc(p, vec2(0.0, 0.02), 0.34);
    alpha *= 0.1;
  } else {
    ang = fract(sin(dot(vTint.rg, vec2(19.7, 73.1))) * 43758.5) * 6.28318;
    alpha = cluster(p, ang);
  }
  alpha = saturate(alpha) * (1.0 - uVeil);
  if (alpha < 0.02) discard;
  // One colour for the whole card, so the alpha cut matches the body.
  // A lighter edge on a darker card was reading as a white rim. White
  // blossoms stay white; pink stays a light pink.
  float pale = step(0.9, min(vTint.r, min(vTint.g, vTint.b)));
  vec3 deep = vec3(0.78, 0.38, 0.52);
  vec3 pink = mix(vTint, deep, 0.06);
  // The pale hill swallows a light pink on a phone. Deepen those cards
  // there only. White blossoms stay white, and wider frames stay put.
  float phone = 1.0 - smoothstep(0.5, 0.72, max(uAspect, 0.3));
  pink = mix(pink, vec3(0.62, 0.2, 0.36), phone * 0.46);
  vec3 col = mix(pink, vTint, pale);
  col = mix(col, atmospheric(col, distance(vWorld, uCamPos)), 0.04);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const LEAF_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform float uWind;
attribute float aPhase;

void main() {
  vUv = uv;
  #ifdef USE_INSTANCING
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  #else
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 size = vec2(1.0);
  #endif
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = center + (right * position.x * size.x + up * position.y * size.y);
  world.x += sin(uTime * 0.45 + aPhase) * uWind * 0.04;
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const LEAF_FRAG = COMMON + /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform vec3 uLeaf;

void main() {
  vec2 p = vUv - 0.5;
  float a = smoothstep(0.5, 0.18, length(p * vec2(0.85, 1.15)));
  float b = smoothstep(0.42, 0.12, length((p - vec2(0.08, 0.06)) * vec2(1.3, 1.5)));
  float c = smoothstep(0.38, 0.1, length((p + vec2(0.12, -0.02)) * vec2(1.4, 1.35)));
  float alpha = max(a, max(b * 0.85, c * 0.75));
  if (alpha < 0.05) discard;
  float shade = mix(0.72, 1.0, smoothstep(-0.2, 0.35, p.y));
  vec3 col = uLeaf * shade;
  col += uSunColor * pow(saturate(0.25 - p.y), 1.6) * 0.12;
  gl_FragColor = vec4(atmospheric(col, distance(vWorld, uCamPos)), alpha * 0.92);
}
`;

export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform float uWind;

void main() {
  vUv = uv;
  #ifdef USE_INSTANCING
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float scale = length(vec3(instanceMatrix[0][0], instanceMatrix[1][0], instanceMatrix[2][0]));
  #else
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float scale = 1.0;
  #endif
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = center + (right * position.x + up * position.y) * scale;
  world += up * sin(uTime * 1.1 + center.x) * uWind * 0.02;
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const GLOW_FRAG = COMMON + /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  float radius = length(vUv * 2.0 - 1.0);
  float alpha = pow(saturate(1.0 - radius), 2.6);
  if (alpha < 0.05) discard;
  float dist = distance(vWorld, uCamPos);
  float fade = exp(-dist * uFogDensity) * (1.0 - uVeil);
  vec3 glow = vec3(1.0, 0.98, 0.94) * alpha * fade * 0.34;
  gl_FragColor = vec4(glow, alpha * 0.55);
}
`;
