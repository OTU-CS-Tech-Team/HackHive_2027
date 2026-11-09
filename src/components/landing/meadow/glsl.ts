const COMMON = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHorizon;
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
  float lift = smoothstep(14.0, 46.0, dist);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 soft = mix(color, vec3(luma), lift * 0.78);
  soft = mix(soft, uHorizon, fog);
  soft = mix(soft, uHorizon, uVeil);
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
uniform vec3 uEmissive;

void main() {
  vec3 n = normalize(vNormal);
  vec3 sun = normalize(uSunDir);
  float ndl = dot(n, sun);
  float wrap = saturate(ndl * 0.48 + 0.58);
  float back = pow(saturate(-ndl), 1.25);
  vec3 lit = vColor * (uAmbient * 0.8 + uSunColor * wrap * 0.52);
  lit += vColor * uSunColor * back * uSss;
  lit += uEmissive * vColor;
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

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float dist = distance(vWorld, uCamPos);
  float grain = noise(vWorld.xz * 0.42);
  vec3 grass = mix(uGrassNear, uGrassFar, smoothstep(3.0, 22.0, dist));
  grass *= 0.95 + 0.08 * grain;
  float pathMask = 1.0 - smoothstep(0.92, 1.85, abs(vWorld.x));
  vec3 dirt = uPath * (0.96 + 0.06 * grain);
  vec3 albedo = mix(grass, dirt, pathMask);
  vec2 shadeAt = vec2(-4.6, -2.6) + vec2(-uSunDir.x, -uSunDir.z) * 1.6;
  vec2 shadowUv = (vWorld.xz - shadeAt) * vec2(0.42, 0.7);
  float shadow = exp(-dot(shadowUv, shadowUv)) * (1.0 - smoothstep(8.0, 22.0, dist));
  albedo *= mix(1.0, 0.78, shadow);
  vec3 n = normalize(vNormal);
  float wrap = saturate(dot(n, normalize(uSunDir)) * 0.35 + 0.72);
  vec3 lit = albedo * (uAmbient * 0.74 + uSunColor * wrap * 0.42);
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
  col = mix(col, uHorizon, uVeil);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CLOUD_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
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
  float drift = sin(uTime * 0.15 + world.z * 0.05) * uWind * 0.35;
  world.x += drift;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const CLOUD_FRAG = COMMON + /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec3 viewDir = normalize(uCamPos - vWorld);
  float facing = abs(dot(normalize(vNormal), viewDir));
  float alpha = smoothstep(0.08, 0.62, facing);
  float dist = distance(vWorld, uCamPos);
  float fog = saturate(1.0 - exp(-dist * uFogDensity));
  alpha *= (1.0 - fog) * (1.0 - uVeil) * 0.78;
  float ndl = saturate(dot(normalize(vNormal), normalize(uSunDir)) * 0.5 + 0.55);
  vec3 col = mix(vec3(1.0, 0.995, 0.98), uHorizon, fog * 0.85 + uVeil);
  col *= 0.86 + 0.22 * ndl;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(atmospheric(col, dist * 0.35), alpha);
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
  float alpha = pow(saturate(1.0 - radius), 1.8);
  float dist = distance(vWorld, uCamPos);
  float fade = exp(-dist * uFogDensity) * (1.0 - uVeil);
  vec3 glow = vec3(0.28, 0.25, 0.18) * alpha * fade;
  gl_FragColor = vec4(glow, 1.0);
}
`;
