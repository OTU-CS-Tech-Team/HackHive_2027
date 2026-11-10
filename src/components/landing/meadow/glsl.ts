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

/** Path centre and width, shared by the ground and the grass discard. */
const PATH = /* glsl */ `
float meadowHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float pathCenter(float z) {
  return sin(z * 0.33) * 0.14 + sin(z * 0.91 + 1.7) * 0.06;
}

float pathHalfWidth(float aspect) {
  float narrow = 1.0 - smoothstep(0.62, 1.15, aspect);
  return mix(1.05, 0.42, narrow);
}
`;

export const PLANT_VERT = /* glsl */ `
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
uniform float uAspect;
uniform float uSss;

void settlePortrait(inout vec3 world, vec3 origin) {
  float narrow = 1.0 - smoothstep(0.62, 1.15, max(uAspect, 0.3));
  float ax = abs(origin.x);
  if (narrow < 0.02 || ax < 0.5 || origin.y >= 0.2) return;
  float phone = 1.0 - smoothstep(0.5, 0.72, uAspect);
  float placedInner = mix(1.12, 0.62, phone);
  float wide = (0.98 + max(0.0, 5.05 - origin.z) * 0.67) * 1.02;
  float compactEdge = 0.9 + max(0.0, 4.1 - origin.z) * 0.31;
  float placedOuter = mix(wide, compactEdge, phone);
  float aspectT = clamp((uAspect - 0.46) / 0.29, 0.0, 1.35);
  float visible = mix(1.3 - origin.z * 0.191, 2.12 - origin.z * 0.31, min(aspectT, 1.0));
  visible += max(0.0, aspectT - 1.0) * 0.4;
  float shoulder = mix(1.05, 0.42, narrow) + 0.12;
  float along = clamp((ax - placedInner) / max(0.25, placedOuter - placedInner), 0.0, 1.0);
  float nx = mix(shoulder, visible * 0.96, along);
  world.x += origin.x * (nx / ax - 1.0);
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
export const LUPIN_VERT = /* glsl */ `
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
uniform float uAspect;

void settlePortrait(inout vec3 world, vec3 origin) {
  float narrow = 1.0 - smoothstep(0.62, 1.15, max(uAspect, 0.3));
  float ax = abs(origin.x);
  if (narrow < 0.02 || ax < 0.5 || origin.y >= 0.2) return;
  float phone = 1.0 - smoothstep(0.5, 0.72, uAspect);
  float placedInner = mix(1.12, 0.62, phone);
  float wide = (0.98 + max(0.0, 5.05 - origin.z) * 0.67) * 1.02;
  float compactEdge = 0.9 + max(0.0, 4.1 - origin.z) * 0.31;
  float placedOuter = mix(wide, compactEdge, phone);
  float aspectT = clamp((uAspect - 0.46) / 0.29, 0.0, 1.35);
  float visible = mix(1.3 - origin.z * 0.191, 2.12 - origin.z * 0.31, min(aspectT, 1.0));
  visible += max(0.0, aspectT - 1.0) * 0.4;
  float shoulder = mix(1.05, 0.42, narrow) + 0.12;
  float along = clamp((ax - placedInner) / max(0.25, placedOuter - placedInner), 0.0, 1.0);
  float nx = mix(shoulder, visible * 0.96, along);
  world.x += origin.x * (nx / ax - 1.0);
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

export const LUPIN_FRAG = COMMON + /* glsl */ `
varying vec3 vColor;
varying vec3 vTint;
varying vec3 vTip;
varying vec3 vNormal;
varying vec3 vWorld;

uniform float uRim;

void main() {
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
uniform float uAspect;
uniform vec3 uEmissive;

void main() {
  if (uSss < 0.2) {
    float core = pathHalfWidth(uAspect) * 0.7;
    if (abs(vWorld.x - pathCenter(vWorld.z)) < core) discard;
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
  float leaf = 1.0 - smoothstep(0.8, 1.0, across);
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
  if (alpha < 0.02) discard;
  if (uSss < 0.2 || uSss > 0.7) lit *= alpha;
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
uniform float uAspect;

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
  float dist = distance(vWorld, uCamPos);
  vec3 grass = meadowColor(vWorld, dist);
  float lateral = vWorld.x - pathCenter(vWorld.z);
  float wobble = (valueNoise(vWorld.xz * 0.42) - 0.5) * 0.36;
  float pathHalf = pathHalfWidth(uAspect) + wobble;
  float edge = 0.18 + (valueNoise(vWorld.xz * 0.73 + 3.1) - 0.5) * 0.16;
  float pathMask = 1.0 - smoothstep(pathHalf, pathHalf + edge, abs(lateral));
  vec3 pathCol = mix(uPath, uPathEdge, 0.22);
  float tone = valueNoise(vWorld.xz * 0.16);
  pathCol *= mix(0.93, 1.07, tone);
  float worldPx = max(fwidth(vWorld.x), fwidth(vWorld.z));
  float gritDetail = 1.0 - smoothstep(0.04, 0.1, worldPx);
  float grit = valueNoise(vWorld.xz * vec2(37.0, 48.0));
  float fine = valueNoise(vWorld.xz * vec2(71.0, 93.0) + 8.0);
  pathCol *= 1.0 + ((grit - 0.5) * 0.18 + (fine - 0.5) * 0.07) * gritDetail * (1.0 - uVeil);
  float wander = sin(vWorld.z * 0.17) * 0.18 + sin(vWorld.z * 0.047 + 2.1) * 0.09;
  float leftRut = abs(lateral + 0.34 - wander);
  float rightRut = abs(lateral - 0.28 - wander * 0.7);
  float rut = (1.0 - smoothstep(0.0, 0.16, leftRut)) + (1.0 - smoothstep(0.0, 0.16, rightRut));
  pathCol *= 1.0 - rut * 0.08 * (1.0 - uVeil);
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

export const HILL_FRAG = COMMON + /* glsl */ `
varying vec3 vWorld;
uniform vec3 uGrassNear;
uniform vec3 uGrassFar;

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
  return grass;
}

void main() {
  float dist = distance(vWorld, uCamPos);
  vec3 grass = meadowColor(vWorld, dist);
  float body = smoothstep(0.3, 0.8, vWorld.y) * (1.0 - smoothstep(1.15, 1.9, vWorld.y));
  vec3 col = mix(grass, vec3(0.4, 0.62, 0.28), body * 0.55);
  float crest = smoothstep(1.2, 2.15, vWorld.y);
  col = mix(col, uHorizon, crest * 0.7);
  col = mix(col, uHandoff, uVeil);
  float wrap = saturate(uSunDir.y * 0.35 + 0.72);
  vec3 lit = col * (uAmbient * 0.74 + uSunColor * wrap * 0.4);
  vec3 shaded = atmospheric(lit, dist);
  float foot = (1.0 - smoothstep(0.35, 1.25, vWorld.y)) * (1.0 - crest);
  gl_FragColor = vec4(driftTint(shaded, vWorld.xz, foot), 1.0);
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
  float phone = step(uAspect, 0.6);
  vec2 fitted = size * mix(1.0, 0.56, narrow);
  fitted.x = mix(fitted.x, fitted.y * 1.35, narrow);
  fitted *= mix(1.0, 0.58, phone);
  vec3 puff = right * position.x * fitted.x + up * position.y * fitted.y;
  float xScale = mix(1.0, 0.48, narrow);
  vec3 world = center + puff;
  world.x += sin(uTime * 0.035 + aPhase) * uWind * 0.7;
  world.y -= narrow * 0.18;
  world.x = center.x * xScale + (world.x - center.x) * mix(xScale, 1.0, phone);
  world.x += phone * (sign(center.x) * 0.92 - center.x * xScale);
  world.y += phone * 0.24;
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
  float alpha = max(body, edge * 0.4) * (1.0 - uVeil);
  if (alpha < 0.02) discard;
  float lift = saturate(p.y * 1.8 + 0.35);
  float narrow = 1.0 - smoothstep(0.72, 1.05, max(uAspect, 0.3));
  vec3 bottom = mix(vec3(0.8, 0.86, 0.92), vec3(0.97, 0.98, 0.99), narrow);
  vec3 col = mix(bottom, vec3(1.0), lift);
  gl_FragColor = vec4(col, alpha);
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
  gl_PointSize = clamp(aSize * 260.0 / max(0.2, -viewPos.z), 1.6, 8.0);
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
  float alpha = pow(clamp(1.0 - radius, 0.0, 1.0), 1.45);
  if (alpha < 0.05) discard;
  vec3 col = vTint * (0.55 + 0.9 * (1.0 - radius));
  gl_FragColor = vec4(col * vFog, alpha * 0.9);
}
`;

export const TREE_VERT = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TREE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uSpread;
uniform float uVeil;

float mass(vec2 p, vec2 center, float rx, float ry) {
  vec2 d = (p - center) / vec2(rx, ry);
  return smoothstep(1.0, 0.42, length(d));
}

float segment(vec2 p, vec2 a, vec2 b, float width) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return smoothstep(width, width * 0.3, length(pa - ba * h));
}

void main() {
  vec2 uv = vUv;
  float spread = uSpread;
  float canopy = 0.0;
  canopy = max(canopy, mass(uv, vec2(0.16, 0.7), 0.18, 0.13));
  canopy = max(canopy, mass(uv, vec2(0.32, 0.82), 0.16, 0.12));
  canopy = max(canopy, mass(uv, vec2(0.48, 0.74), 0.15, 0.11));
  canopy = max(canopy, mass(uv, vec2(0.24, 0.58), 0.14, 0.11));
  canopy = max(canopy, mass(uv, vec2(0.42, 0.58), 0.13, 0.1));
  canopy = max(canopy, mass(uv, vec2(0.1, 0.56), 0.11, 0.09));
  canopy = max(canopy, mass(uv, vec2(0.58, 0.66), 0.12, 0.09));
  canopy = max(canopy, mass(uv, vec2(0.36, 0.92), 0.12, 0.08));
  canopy = max(canopy, mass(uv, vec2(0.2, 0.9), 0.1, 0.07));
  canopy = max(canopy, mass(uv, vec2(mix(0.28, 0.66, spread), 0.8), 0.11, 0.08));
  float trunk = segment(uv, vec2(0.05, 0.0), vec2(0.16, 0.32), 0.05);
  trunk = max(trunk, segment(uv, vec2(0.16, 0.32), vec2(0.28, 0.62), 0.034));
  float bough = segment(uv, vec2(0.22, 0.5), vec2(0.5, 0.74), 0.016);
  bough = max(bough, segment(uv, vec2(0.18, 0.44), vec2(0.06, 0.68), 0.012));
  bough = max(bough, segment(uv, vec2(0.26, 0.58), vec2(0.52, 0.88), 0.011));
  float wood = max(trunk, bough);
  float shape = max(canopy, wood);
  float logo = smoothstep(0.8, 0.96, uv.y) * smoothstep(0.34, 0.05, uv.x) * spread;
  float alpha = shape * (1.0 - uVeil) * (1.0 - logo);
  if (alpha < 0.05) discard;
  float crown = smoothstep(0.42, 0.95, uv.y);
  vec3 leaf = mix(vec3(0.04, 0.11, 0.05), vec3(0.45, 0.64, 0.24), crown);
  leaf = mix(leaf, vec3(0.78, 0.9, 0.46), crown * crown);
  vec3 bark = vec3(0.1, 0.13, 0.06);
  vec3 col = mix(bark, leaf, clamp(canopy, 0.0, 1.0));
  gl_FragColor = vec4(col, alpha * 0.94);
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
  float alpha = pow(saturate(1.0 - radius), 1.65);
  if (alpha < 0.02) discard;
  float dist = distance(vWorld, uCamPos);
  float fade = exp(-dist * uFogDensity) * (1.0 - uVeil);
  vec3 glow = vec3(1.0, 0.99, 0.96) * alpha * fade * 1.15;
  gl_FragColor = vec4(glow, alpha);
}
`;
