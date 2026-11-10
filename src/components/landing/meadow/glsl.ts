const COMMON = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHorizon;
uniform vec3 uForest;
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
  vec3 fogColor = mix(uHorizon, uForest, uVeil);
  soft = mix(soft, fogColor, fog);
  soft = mix(soft, uForest, uVeil);
  return soft;
}
`;

export const PLANT_VERT = /* glsl */ `
attribute float aPhase;
attribute float aBend;
attribute vec3 aTint;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;

uniform float uTime;
uniform float uWind;

void main() {
  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = mat3(instanceMatrix) * normal;
  #else
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normal;
  #endif
  float height = clamp(position.y, 0.0, 1.0);
  float sway = sin(uTime * 1.32 + aPhase + world.x * 0.16) * uWind * aBend;
  sway *= pow(height, 1.45);
  world.x += sway * 0.2;
  world.z += sway * 0.09;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  #ifdef USE_COLOR
    vColor = color * aTint;
  #else
    vColor = aTint;
  #endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const PLANT_FRAG = COMMON + /* glsl */ `
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;

uniform float uSss;
uniform float uRim;
uniform vec3 uEmissive;

void main() {
  vec3 n = normalize(vNormal);
  if (uRim > 0.5 && !gl_FrontFacing) n = -n;
  vec3 sun = normalize(uSunDir);
  float ndl = dot(n, sun);
  float wrap = saturate(ndl * 0.55 + 0.42);
  float back = pow(saturate(-ndl), 1.25);
  vec3 lit = vColor * (uAmbient * 0.72 + uSunColor * wrap * 0.7);
  lit += vColor * uSunColor * back * uSss;
  float facing = saturate(dot(n, normalize(uCamPos - vWorld)));
  float rim = pow(1.0 - facing, 2.4) * uRim;
  lit += uEmissive * (rim * 0.55 + uRim * 0.42);
  gl_FragColor = vec4(atmospheric(lit, distance(vWorld, uCamPos)), 1.0);
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

export const GROUND_FRAG = COMMON + /* glsl */ `
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
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float n = grassHash(cell + salt);
  float n2 = grassHash(cell + salt + 3.7);
  vec2 center = vec2(0.12 + n * 0.76, 0.12 + n2 * 0.76);
  vec2 d = (f - center) * vec2(1.0, 1.85);
  return smoothstep(0.62, 0.05, length(d));
}

float grassTuft(vec2 xz) {
  float a = grassBlade(xz, 52.0, 1.1);
  float b = grassBlade(xz + 0.05, 78.0, 4.8);
  float c = grassBlade(xz + 0.11, 110.0, 9.1);
  return clamp(a * 0.5 + b * 0.38 + c * 0.3, 0.0, 1.0);
}

vec3 meadowColor(vec3 world, float dist) {
  vec3 ray = normalize(world - uCamPos);
  float down = saturate((-ray.y - 0.008) / 0.17);
  down = down * down * (3.0 - 2.0 * down);
  vec3 grass = mix(uHorizon, uGrassNear, down);
  float field = grassTuft(world.xz);
  float shade = grassHash(floor(world.xz * vec2(52.0, 14.0) + 2.0));
  vec3 root = vec3(0.1, 0.2, 0.05);
  vec3 tip = vec3(0.78, 0.92, 0.46);
  vec3 blade = mix(root, tip, shade);
  float cover = smoothstep(0.04, 0.45, down) * (1.0 - smoothstep(20.0, 54.0, dist));
  grass = mix(grass, blade, clamp(field * cover * 0.95, 0.0, 0.84));
  return grass;
}

void main() {
  float dist = distance(vWorld, uCamPos);
  vec3 grass = meadowColor(vWorld, dist);
  float ax = abs(vWorld.x);
  float narrow = 1.0 - smoothstep(0.62, 1.15, uAspect);
  float inner = mix(0.62, 0.16, narrow);
  float outer = mix(0.98, 0.42, narrow);
  float pathMask = 1.0 - smoothstep(inner, outer, ax);
  vec3 pathCol = mix(uPath, uPathEdge, smoothstep(inner * 0.25, outer, ax));
  pathCol = mix(pathCol, uForest, uVeil);
  grass = mix(grass, uForest, uVeil);
  vec3 albedo = mix(grass, pathCol, pathMask);
  float wrap = saturate(dot(normalize(vNormal), normalize(uSunDir)) * 0.35 + 0.72);
  vec3 lit = albedo * (uAmbient * 0.74 + uSunColor * wrap * 0.4);
  gl_FragColor = vec4(atmospheric(lit, dist), 1.0);
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
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float n = grassHash(cell + salt);
  float n2 = grassHash(cell + salt + 3.7);
  vec2 center = vec2(0.12 + n * 0.76, 0.12 + n2 * 0.76);
  vec2 d = (f - center) * vec2(1.0, 1.85);
  return smoothstep(0.62, 0.05, length(d));
}

float grassTuft(vec2 xz) {
  float a = grassBlade(xz, 52.0, 1.1);
  float b = grassBlade(xz + 0.05, 78.0, 4.8);
  float c = grassBlade(xz + 0.11, 110.0, 9.1);
  return clamp(a * 0.5 + b * 0.38 + c * 0.3, 0.0, 1.0);
}

vec3 meadowColor(vec3 world, float dist) {
  vec3 ray = normalize(world - uCamPos);
  float down = saturate((-ray.y - 0.008) / 0.17);
  down = down * down * (3.0 - 2.0 * down);
  vec3 grass = mix(uHorizon, uGrassNear, down);
  float field = grassTuft(world.xz);
  float shade = grassHash(floor(world.xz * vec2(52.0, 14.0) + 2.0));
  vec3 root = vec3(0.1, 0.2, 0.05);
  vec3 tip = vec3(0.78, 0.92, 0.46);
  vec3 blade = mix(root, tip, shade);
  float cover = smoothstep(0.04, 0.45, down) * (1.0 - smoothstep(20.0, 54.0, dist));
  grass = mix(grass, blade, clamp(field * cover * 0.95, 0.0, 0.84));
  return grass;
}

void main() {
  float dist = distance(vWorld, uCamPos);
  vec3 grass = meadowColor(vWorld, dist);
  float body = smoothstep(0.3, 0.8, vWorld.y) * (1.0 - smoothstep(1.15, 1.9, vWorld.y));
  vec3 col = mix(grass, vec3(0.4, 0.62, 0.28), body * 0.55);
  float crest = smoothstep(1.2, 2.15, vWorld.y);
  col = mix(col, uHorizon, crest * 0.7);
  col = mix(col, uForest, uVeil);
  float wrap = saturate(uSunDir.y * 0.35 + 0.72);
  vec3 lit = col * (uAmbient * 0.74 + uSunColor * wrap * 0.4);
  gl_FragColor = vec4(atmospheric(lit, dist), 1.0);
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
  col = mix(col, uForest, uVeil);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CLOUD_VERT = /* glsl */ `
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
  world.x += sin(uTime * 0.12 + aPhase) * uWind * 0.22;
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const CLOUD_FRAG = COMMON + /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec2 p = vUv - 0.5;
  float a = smoothstep(0.5, 0.14, length(p * vec2(1.02, 1.45)));
  float b = smoothstep(0.36, 0.1, length((p - vec2(0.14, 0.02)) * vec2(1.45, 1.7)));
  float c = smoothstep(0.32, 0.08, length((p + vec2(0.16, 0.03)) * vec2(1.55, 1.85)));
  float alpha = max(a, max(b * 0.92, c * 0.78));
  float dist = distance(vWorld, uCamPos);
  float fog = saturate(1.0 - exp(-dist * uFogDensity));
  alpha *= (1.0 - fog) * (1.0 - uVeil);
  if (alpha < 0.03) discard;
  vec3 col = mix(vec3(1.0, 0.995, 0.985), mix(uHorizon, uForest, uVeil), fog * 0.65 + uVeil);
  gl_FragColor = vec4(col, alpha * 0.72);
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
  float alpha = pow(saturate(1.0 - radius), 3.4);
  if (alpha < 0.14) discard;
  float dist = distance(vWorld, uCamPos);
  float fade = exp(-dist * uFogDensity) * (1.0 - uVeil);
  vec3 glow = vec3(1.0, 1.0, 0.98) * alpha * fade * 0.7;
  gl_FragColor = vec4(glow, alpha);
}
`;
