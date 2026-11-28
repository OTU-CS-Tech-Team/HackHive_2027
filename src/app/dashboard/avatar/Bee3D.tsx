"use client";

// The wardrobe's bee in 3D: the same bee as Bee.tsx, built from toon-shaded
// solids with an ink outline. Drag it (or use the buttons) to turn it round.
// The passport shows its head (BeeHead, at the bottom).
// Coordinates go through v(), which takes Bee.tsx's SVG points, so the two
// bees line up piece for piece. Loaded with ssr: false; needs WebGL.

import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from "react";
import { Canvas, invalidate, useFrame } from "@react-three/fiber";
import { RotateCcw, RotateCw } from "lucide-react";
import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  ExtrudeGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  PlaneGeometry,
  QuadraticBezierCurve3,
  Quaternion,
  RedFormat,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Group,
} from "three";
import type { Avatar, ColorId, Slot } from "@/lib/avatar";
import { HONEY, LINE, PAINT, SOLE, heart, hex, rr } from "./Bee";
import styles from "./avatar.module.css";

type V3 = [number, number, number];
const TAU = Math.PI * 2;
const DARK = "#2a2a31";

// Bee.tsx's SVG point (y down, 100px a unit) to the scene's.
const v = (x: number, y: number, z = 0) => new Vector3((x - 100) / 100, (140 - y) / 100, z);
const at = (x: number, y: number, z = 0) => v(x, y, z).toArray() as V3;

// Three hard steps of light, like the 2D bee's flat light and shade.
const STEPS = new DataTexture(new Uint8Array([90, 175, 255]), 3, 1, RedFormat);
STEPS.minFilter = STEPS.magFilter = NearestFilter;
STEPS.needsUpdate = true;

// A warm rim on the shadow side, as if the plinth's glow were behind: it
// turns the edges, so the flat fronts read as round.
const rimLight = (shader: { fragmentShader: string }) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <opaque_fragment>",
    `outgoingLight += vec3(1.0, 0.78, 0.42) * 0.32 * smoothstep(0.5, 0.56, 1.0 - dot(normal, normalize(vViewPosition))) * smoothstep(0.25, -0.35, normal.x);
#include <opaque_fragment>`,
  );
};

const toons = new Map<string, MeshToonMaterial>();
const toon = (color: string) => {
  if (!toons.has(color)) toons.set(color, Object.assign(new MeshToonMaterial({ color, gradientMap: STEPS }), { onBeforeCompile: rimLight }));
  return toons.get(color)!;
};

// The lamp, from up and to the right, and the room's light.
const Lights = () => (
  <>
    <ambientLight intensity={0.8} />
    <directionalLight position={[5, 3.5, 2.5]} intensity={2.6} />
  </>
);

// The ink line: back faces pushed out along their normals, drawn flat black.
const INK = new MeshBasicMaterial({ color: LINE, side: BackSide });
INK.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normal * 0.012;");
};

// --- Shapes. Built once, already in place, so the outline keeps one width. ---

const blob = (rx: number, ry: number, rz: number) => new SphereGeometry(1, 32, 20).scale(rx, ry, rz);
// A Y-up shape stood on the line a→b.
function along(geo: BufferGeometry, a: Vector3, b: Vector3) {
  geo.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return geo.translate(mid.x, mid.y, mid.z);
}
const limb = (a: Vector3, b: Vector3, r: number) => along(new CapsuleGeometry(r, a.distanceTo(b), 6, 16), a, b);
const stick = (a: Vector3, b: Vector3, w: number, d = w) => along(new BoxGeometry(w, a.distanceTo(b), d), a, b);
// An open ring round the body, flattened front to back like the torso.
const ring = (r: number, h: number, y: number) => new CylinderGeometry(r, r, h, 32, 1, true).scale(1, 1, 0.72).translate(0, y, 0);
const loop = (r: number, tube: number) => new TorusGeometry(r, tube, 10, 40).rotateX(Math.PI / 2);
const dome = (to: number, rx: number, ry: number, rz: number) => new SphereGeometry(1, 32, 16, 0, TAU, 0, to).scale(rx, ry, rz);

function roundRect(w: number, h: number, r: number, depth: number) {
  const s = new Shape();
  const [x, y] = [-w / 2, -h / 2];
  s.moveTo(x + r, y).lineTo(x + w - r, y).quadraticCurveTo(x + w, y, x + w, y + r).lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h).lineTo(x + r, y + h).quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r).quadraticCurveTo(x, y, x + r, y);
  return new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -depth / 2);
}

// The visor: a sphere squared off toward a rounded rectangle, then laid on
// the head's curve as a low cushion, with its face texture projected straight
// on from the front. Its centre sits 0.08 below the head's.
function visorShape() {
  const geo = new SphereGeometry(1, 48, 32);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const [x, y] = [pos.getX(i), pos.getY(i)].map((n) => Math.sign(n) * Math.abs(n) ** 0.6);
    const [X, Y] = [x * 0.41, y * 0.3];
    const head = 0.5 * Math.sqrt(Math.max(0, 1 - (X / 0.56) ** 2 - ((Y - 0.08) / 0.45) ** 2));
    pos.setXYZ(i, X, Y, head + 0.045 * pos.getZ(i));
    uv.setXY(i, x / 2 + 0.5, y / 2 + 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

const HEAD = blob(0.56, 0.45, 0.5);
const STRIPE = new SphereGeometry(1, 48, 4, 0, TAU, 0.42, 0.2).scale(0.566, 0.456, 0.506).rotateX(-0.32);
const VISOR = visorShape();
const NECK = new CylinderGeometry(0.09, 0.1, 0.22, 16);
const TORSO = new LatheGeometry(
  [[0, -0.62], [0.37, -0.62], [0.39, -0.5], [0.39, -0.1], [0.375, 0.04], [0.32, 0.13], [0.2, 0.19], [0, 0.21]].map(([r, y]) => new Vector2(r, y)),
  40,
  Math.PI,
).scale(1, 1, 0.72);
const ARM = limb(v(66, 136), v(51, 183), 0.065);
const HAND = blob(0.085, 0.085, 0.085);
const LEG = limb(v(85, 194), v(81, 252), 0.075);
const ANTENNA = new TubeGeometry(new QuadraticBezierCurve3(v(88, 44, 0.1), v(82, 28, 0.12), v(70, 17, 0.06)), 16, 0.022, 8);
const ANTENNA_ROOT = at(88, 44, 0.1);
const ANTENNA_BACK = v(88, 44, 0.1).negate().toArray() as V3;
const TIP = new CylinderGeometry(0.09, 0.09, 0.07, 6).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
const LOGO_HEX = new CircleGeometry(1, 6, Math.PI / 6);

const SLEEVE = limb(v(67, 135), v(52.6, 174.5), 0.1);
const CUFF = limb(v(52.6, 174.5), v(51, 181), 0.104);
const SHORT_SLEEVE = limb(v(67, 135), v(61, 151), 0.11);
const HIPS = new CylinderGeometry(0.36, 0.355, 0.3, 32).scale(1, 1, 0.72).translate(0, -0.6, 0);
const PANT_LEG = along(new CylinderGeometry(0.15, 0.14, 0.5, 20), v(80, 202), v(81, 252));
const SHORTS_LEG = along(new CylinderGeometry(0.16, 0.16, 0.2, 20), v(81, 202), v(81, 222));
const legStripe = (to: number) => stick(v(65.3, 196), v(65.6, to), 0.025, 0.06);
const CARGO_STRIPE = legStripe(249);
const SHORTS_STRIPE = legStripe(220);
const CARGO_POCKET = new BoxGeometry(0.05, 0.2, 0.15);
const POCKET_FLAP = new BoxGeometry(0.058, 0.055, 0.158);

const DRAWSTRING = limb(v(93, 139, 0.29), v(91, 151, 0.29), 0.012);
const AGLET = blob(0.022, 0.022, 0.022);
const HEM = ring(0.388, 0.07, -0.58);
// The kangaroo pocket: a slab on the front, so its top catches the light and
// its open ends show dark, like the hand slots.
const POCKET = new LatheGeometry([[0.39, -0.495], [0.42, -0.495], [0.42, -0.305], [0.39, -0.305]].map(([r, y]) => new Vector2(r, y)), 16, -0.75, 1.5).scale(1, 1, 0.72);
const HOOD = loop(0.25, 0.09);
const CUFF_STRIPE = limb(v(52.3, 176.6), v(51.9, 178.2), 0.107);
const HEM_STRIPES = [ring(0.392, 0.012, -0.565), ring(0.392, 0.012, -0.595)];
const PLACKET = stick(v(100, 141, 0.282), v(100, 196, 0.282), 0.012, 0.004);
const BUTTON = blob(0.019, 0.019, 0.012);
const H_POST = new BoxGeometry(0.034, 0.14, 0.02);
const H_BAR = new BoxGeometry(0.1, 0.03, 0.02);
const COLLAR = loop(0.16, 0.035).rotateX(-0.32);
const SLEEVE_BAND = limb(v(61.8, 149.2), v(61, 151), 0.112);
const NECKBAND = loop(0.15, 0.016).rotateX(-0.3);
const TEE_HEM = ring(0.39, 0.02, -0.6);

// Sneakers, in the shoe's own frame: on top of the sole, under the leg, toe
// along +z. A high-top the trouser leg tucks into (it's open for the leg), a
// low toe box with a rubber cap, and a chunky sole with a honey stripe.
const SHOE_ANKLE = new CylinderGeometry(0.155, 0.16, 0.2, 28, 1, true).translate(0, 0.1, 0);
const SHOE_TOE = blob(0.14, 0.095, 0.2).translate(0, 0.01, 0.14);
const TOE_CAP = new SphereGeometry(1, 28, 10, 0, TAU, 0, 0.85).rotateX(Math.PI / 2).scale(0.145, 0.099, 0.206).translate(0, 0.01, 0.14);
const SHOE_COLLAR = loop(0.158, 0.03).translate(0, 0.2, 0);
const TONGUE = blob(0.065, 0.055, 0.022).rotateX(0.35).translate(0, 0.215, 0.16);
const SHOE_SOLE = new CapsuleGeometry(0.16, 0.22, 6, 24).rotateX(Math.PI / 2).scale(1, 0.28, 1).translate(0, -0.045, 0.09);
const SOLE_STRIPE = new CapsuleGeometry(0.166, 0.22, 6, 24).rotateX(Math.PI / 2).scale(1, 0.06, 1).translate(0, -0.035, 0.09);
const LACE = new BoxGeometry(0.1, 0.018, 0.02);
const FOOT = blob(0.12, 0.065, 0.17);

const CAP = dome(1.2, 0.585, 0.48, 0.53);
const BRIM = new CylinderGeometry(0.44, 0.44, 0.03, 24, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.25);
const CAP_BUTTON = blob(0.035, 0.035, 0.035);
const BEANIE = dome(1.45, 0.585, 0.56, 0.535);
const BEANIE_CUFF = loop(0.55, 0.085).scale(1, 1, 0.92);
const POMPOM = blob(0.085, 0.085, 0.085);
const BAND = new TorusGeometry(0.58, 0.035, 8, 48, Math.PI).scale(1, 0.9, 1);
const EARCUP = blob(0.085, 0.18, 0.14);
const EARCUP_RING = new TorusGeometry(0.1, 0.012, 6, 24).rotateY(Math.PI / 2).scale(1, 1.3, 1);
const LENS = roundRect(0.32, 0.21, 0.07, 0.025);
const TEMPLE = limb(v(63, 76, 0.45), v(45, 71, 0.04), 0.012);
const BRIDGE = limb(v(93, 77, 0.575), v(107, 77, 0.575), 0.013);

const PLINTH = new CylinderGeometry(0.62, 0.66, 0.1, 6);
const STEP = new CylinderGeometry(0.8, 0.84, 0.07, 6);
const SHADOW_DISC = new CircleGeometry(0.42, 32).rotateX(-Math.PI / 2).scale(1, 1, 0.7);
// Lit edges: hexagonal rings, turned onto the plinth's corners.
const rim = (r: number) => new TorusGeometry(r, 0.012, 4, 6).rotateX(Math.PI / 2).rotateY(Math.PI / 6);
const RIMS: [BufferGeometry, number][] = [
  [rim(0.48), 0.003],
  [rim(0.625), 0],
  [rim(0.805), -0.1],
];
const FLOOR = new PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2);

// --- Painted textures: the face LEDs, the HackHive mark, the wings. ---

const canvas = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const texture = (c: HTMLCanvasElement) => Object.assign(new CanvasTexture(c), { colorSpace: SRGBColorSpace, anisotropy: 4 });

type Face = Avatar["face"]["item"];
const smile = (x: number) => `M${x} 87Q${x + 9} 73 ${x + 18} 87`;
const pill = (x: number) => rr(x, 72, 11, 17, 5.5);
const FACES: Record<Face, { fill?: string[]; stroke?: string[] }> = {
  happy: { stroke: [smile(72), smile(110)] },
  eyes: { fill: [pill(75), pill(114)] },
  wink: { fill: [pill(75)], stroke: [smile(110)] },
  hearts: { fill: [heart(81, 80, 7.5), heart(119, 80, 7.5)] },
  squint: { stroke: ["M75 74L88 81L75 88M125 74L112 81L125 88"] },
};

// Open eyes blink and hearts beat, on the 2D bee's timings.
const blink = (t: number) => {
  const p = (t % 4.5) / 4.5;
  return p < 0.94 ? 1 : 0.1 + 0.9 * (Math.abs(p - 0.97) / 0.03);
};
const BEAT = [[0, 1], [0.12, 1.22], [0.24, 1], [0.36, 1.12], [0.5, 1]];
const beat = (t: number) => {
  const p = (t % 1.4) / 1.4;
  for (let i = 1; i < BEAT.length; i++) {
    const [[a, va], [b, vb]] = [BEAT[i - 1], BEAT[i]];
    if (p < b) return va + ((vb - va) * (p - a)) / (b - a);
  }
  return 1;
};

// The visor box in SVG units (Bee.tsx's rr(59, 52, 82, 60)), 4px a unit.
const [VX, VY, VW, VH, K] = [59, 52, 82, 60, 4];
type FacePaint = { ctx: CanvasRenderingContext2D; tex: CanvasTexture; material: MeshToonMaterial };
function facePaint(): FacePaint {
  const c = canvas(VW * K, VH * K);
  const tex = texture(c);
  return { ctx: c.getContext("2d")!, tex, material: new MeshToonMaterial({ color: "#1d1d24", gradientMap: STEPS, emissive: "#fff", emissiveMap: tex }) };
}
function drawFace({ ctx, tex }: FacePaint, face: Face, color: string, t: number) {
  tex.needsUpdate = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, VW * K, VH * K);
  // The visor's painted shine.
  ctx.setTransform(K, 0, 0, K, -VX * K, -VY * K);
  ctx.strokeStyle = "rgb(255 255 255 / 0.28)";
  ctx.lineWidth = 3;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.stroke(new Path2D("M68 68Q72 59.5 85 58.5"));

  ctx.fillStyle = ctx.strokeStyle = ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 5;
  const { fill = [], stroke = [] } = FACES[face];
  [...fill, ...stroke].forEach((d, i) => {
    const s = face === "hearts" ? beat(t) : 1;
    const sy = face === "eyes" ? blink(t) : 1;
    const cx = face === "hearts" ? [81, 119][i] : 100;
    const cy = 80.5;
    ctx.setTransform(K * s, 0, 0, K * s * sy, K * (cx * (1 - s) - VX), K * (cy * (1 - s * sy) - VY));
    if (i < fill.length) ctx.fill(new Path2D(d));
    else ctx.stroke(new Path2D(d));
  });
  ctx.shadowBlur = 0;
}

// The HackHive mark (Bee.tsx's logo()), filling a hexagon.
function logoTexture() {
  const c = canvas(128, 128);
  const ctx = c.getContext("2d")!;
  const [x, y, r] = [64, 64, 50];
  ctx.fillStyle = HONEY;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#16161b";
  ctx.fill(new Path2D(hex(x, y, r, true)));
  ctx.fillStyle = "#cfe9ff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.34, y - r * 0.14, r * 0.3, r * 0.17, (side * 25 * Math.PI) / 180, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = HONEY;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.1, r * 0.2, r * 0.36, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#16161b";
  ctx.lineWidth = r * 0.09;
  ctx.stroke(new Path2D(`M${x - r * 0.2} ${y + r * 0.06}H${x + r * 0.2}M${x - r * 0.17} ${y + r * 0.26}H${x + r * 0.17}`));
  return texture(c);
}

const UPPER_WING = "M84 146C62 116 24 100 11 114C1 128 20 160 84 156Z";
const LOWER_WING = "M84 160C64 160 34 168 30 186C27 200 56 202 86 168Z";
// Both wings on one sheet covering SVG x 0–90, y 95–205.
function wingTexture() {
  const c = canvas(360, 440);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(4, 0, 0, 4, 0, -95 * 4);
  for (const d of [UPPER_WING, LOWER_WING]) {
    const path = new Path2D(d);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = "rgb(255 240 190 / 0.55)";
    ctx.fill(path);
    ctx.strokeStyle = "rgb(201 138 28 / 0.55)";
    ctx.lineWidth = 0.8;
    for (let gx = 0; gx < 96; gx += 12) for (let gy = 95; gy < 210; gy += 6.93) ctx.stroke(new Path2D(hex(gx + ((gy - 95) / 6.93) % 2 * 6, gy, 4)));
    ctx.restore();
    ctx.strokeStyle = HONEY;
    ctx.lineWidth = 2.6;
    ctx.stroke(path);
  }
  const tex = texture(c);
  tex.flipY = false;
  tex.repeat.set(1 / 90, 1 / 110);
  tex.offset.set(0, -95 / 110);
  return tex;
}

// ShapeGeometry's UVs are its SVG points, which wingTexture() maps onto.
function wingShape(d: number[][], root: [number, number]) {
  const [[mx, my], ...curves] = d;
  const s = new Shape().moveTo(mx, my);
  for (const [a, b, c, e, f, g] of curves) s.bezierCurveTo(a, b, c, e, f, g);
  return new ShapeGeometry(s, 20).translate(-root[0], -root[1], 0).scale(0.01, -0.01, 1);
}
const UPPER = wingShape([[84, 146], [62, 116, 24, 100, 11, 114], [1, 128, 20, 160, 84, 156]], [84, 151]);
const LOWER = wingShape([[84, 160], [64, 160, 34, 168, 30, 186], [27, 200, 56, 202, 86, 168]], [85, 164]);

// The pool of light the plinth stands in.
function glowTexture() {
  const c = canvas(128, 128);
  const ctx = c.getContext("2d")!;
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgb(244 185 66 / 0.6)");
  glow.addColorStop(0.45, "rgb(244 185 66 / 0.16)");
  glow.addColorStop(1, "rgb(244 185 66 / 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  return texture(c);
}

const client = typeof document !== "undefined";
const LOGO = new MeshToonMaterial({ gradientMap: STEPS, map: client ? logoTexture() : null });
const WING = new MeshBasicMaterial({ map: client ? wingTexture() : null, transparent: true, side: DoubleSide, depthWrite: false });
const SHADOW = new MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.45, depthWrite: false });
const RIM = new MeshBasicMaterial({ color: "#ffd36b" });
const GLOW = new MeshBasicMaterial({ map: client ? glowTexture() : null, transparent: true, depthWrite: false });

// --- Pieces ---

function Part({ geo, color, pos, rot, ink = true }: { geo: BufferGeometry; color: string; pos?: V3; rot?: V3; ink?: boolean }) {
  return (
    <group position={pos} rotation={rot}>
      <mesh geometry={geo} material={toon(color)} />
      {ink && <mesh geometry={geo} material={INK} />}
    </group>
  );
}

const Logo = ({ pos, r, rot }: { pos: V3; r: number; rot?: V3 }) => <mesh geometry={LOGO_HEX} material={LOGO} position={pos} rotation={rot} scale={r} />;

// Left side, then mirrored onto the right.
const Pair = ({ children }: { children: ReactNode }) => (
  <>
    {children}
    <group scale={[-1, 1, 1]}>{children}</group>
  </>
);

type Art = (c: string, t: string) => ReactNode;

const TOPS: Record<Avatar["top"]["item"], Art> = {
  hoodie: (c, t) => (
    <>
      <Part geo={TORSO} color={c} />
      <Pair>
        <Part geo={SLEEVE} color={c} />
        <Part geo={CUFF} color={t} />
        <Part geo={DRAWSTRING} color={t} ink={false} />
        <Part geo={AGLET} pos={at(91, 153, 0.29)} color={t} />
      </Pair>
      <Part geo={HEM} color={t} />
      <Part geo={POCKET} color={c} />
      <Part geo={HOOD} pos={[0, 0.2, -0.03]} color={c} />
      <Logo pos={at(100, 156, 0.288)} r={0.085} />
    </>
  ),
  varsity: (c, t) => (
    <>
      <Part geo={TORSO} color={c} />
      <Pair>
        <Part geo={SLEEVE} color={SOLE} />
        <Part geo={CUFF} color={c} />
        <Part geo={CUFF_STRIPE} color={t} ink={false} />
      </Pair>
      {HEM_STRIPES.map((geo) => (
        <Part key={geo.uuid} geo={geo} color={t} ink={false} />
      ))}
      <Part geo={PLACKET} color={LINE} ink={false} />
      {[142, 157, 172].map((y) => (
        <Part key={y} geo={BUTTON} pos={at(103, y, 0.282)} color={SOLE} />
      ))}
      <group position={at(82, 153, 0.252)} rotation={[0, -0.48, 0]}>
        <Part geo={H_POST} pos={[-0.05, 0, 0]} color={t} />
        <Part geo={H_POST} pos={[0.05, 0, 0]} color={t} />
        <Part geo={H_BAR} color={t} />
      </group>
      <Part geo={COLLAR} pos={[0, 0.18, 0.01]} color={c} />
    </>
  ),
  tshirt: (c, t) => (
    <>
      <Part geo={TORSO} color={c} />
      <Pair>
        <Part geo={SHORT_SLEEVE} color={c} />
        <Part geo={SLEEVE_BAND} color={t} ink={false} />
      </Pair>
      <Part geo={NECKBAND} pos={[0, 0.185, 0.02]} color={t} ink={false} />
      <Part geo={TEE_HEM} color={t} ink={false} />
      <Logo pos={at(100, 160, 0.288)} r={0.13} />
    </>
  ),
};

const BOTTOMS: Record<Avatar["bottom"]["item"], Art> = {
  cargo: (c, t) => (
    <>
      <Part geo={HIPS} color={c} />
      <Pair>
        <Part geo={PANT_LEG} color={c} />
        <Part geo={CARGO_STRIPE} color={t} ink={false} />
        <Part geo={CARGO_POCKET} pos={at(64.5, 216, 0.02)} color={c} />
        <Part geo={POCKET_FLAP} pos={at(64.3, 208.75, 0.02)} color={c} />
        <Part geo={BUTTON} pos={at(61, 209, 0.02)} rot={[0, Math.PI / 2, 0]} color={t} />
      </Pair>
    </>
  ),
  shorts: (c, t) => (
    <>
      <Part geo={HIPS} color={c} />
      <Pair>
        <Part geo={SHORTS_LEG} color={c} />
        <Part geo={SHORTS_STRIPE} color={t} ink={false} />
      </Pair>
    </>
  ),
};

const SHOES: Record<Avatar["shoes"]["item"], Art> = {
  sneakers: (c, t) => (
    <Pair>
      <group position={at(81, 259)}>
        <Part geo={SHOE_SOLE} color={SOLE} />
        <Part geo={SOLE_STRIPE} color={HONEY} ink={false} />
        <Part geo={SHOE_ANKLE} color={c} />
        <Part geo={SHOE_TOE} color={c} />
        <Part geo={TOE_CAP} color={SOLE} />
        <Part geo={SHOE_COLLAR} color={t} />
        <Part geo={TONGUE} color={c} />
        {[0.125, 0.152].map((y) => (
          <Part key={y} geo={LACE} pos={[0, y, 0.158]} color={t} ink={false} />
        ))}
        {/* On the outer side. */}
        <Logo pos={[-0.163, 0.1, -0.01]} rot={[0, -Math.PI / 2, 0]} r={0.045} />
      </group>
    </Pair>
  ),
  none: () => (
    <Pair>
      <Part geo={FOOT} pos={at(80, 257, 0.05)} color="#2c2c33" />
    </Pair>
  ),
};

const HATS: Record<Avatar["hat"]["item"], Art> = {
  none: () => null,
  cap: (c, t) => (
    <>
      <Part geo={CAP} pos={at(100, 74)} color={c} />
      <Part geo={BRIM} pos={[0, 0.83, 0.18]} rot={[0.12, 0, 0]} color={t} />
      <Part geo={CAP_BUTTON} pos={[0, 1.14, 0]} color={t} />
      <Logo pos={[0, 1.0, 0.38]} rot={[-0.75, 0, 0]} r={0.08} />
    </>
  ),
  beanie: (c, t) => (
    <>
      <Part geo={BEANIE} pos={at(100, 74)} color={c} />
      <Part geo={BEANIE_CUFF} pos={[0, 0.8, 0]} color={c} />
      <Part geo={POMPOM} pos={[0, 1.24, 0]} color={t} />
      <Logo pos={[0, 0.8, 0.59]} r={0.055} />
    </>
  ),
};

const HEADPHONES: Record<Avatar["ears"]["item"], Art> = {
  none: () => null,
  headphones: (c, t) => (
    <>
      <Part geo={BAND} pos={[0, 0.64, 0]} color={c} />
      <Pair>
        <Part geo={EARCUP} pos={[-0.6, 0.62, 0]} color={c} />
        <Part geo={EARCUP_RING} pos={[-0.665, 0.62, 0]} color={t} ink={false} />
        <Logo pos={[-0.688, 0.62, 0]} rot={[0, -Math.PI / 2, 0]} r={0.05} />
      </Pair>
    </>
  ),
};

const GLASSES: Record<Avatar["glasses"]["item"], Art> = {
  none: () => null,
  shades: (c) => (
    <>
      <Pair>
        <Part geo={LENS} pos={at(78, 79.5, 0.52)} rot={[0, -0.45, 0]} color={c} />
        <Part geo={TEMPLE} color={LINE} ink={false} />
      </Pair>
      <Part geo={BRIDGE} color={LINE} ink={false} />
    </>
  ),
};

// The LED face, redrawn each frame only while it blinks or beats.
function Visor({ face, color, still }: { face: Face; color: string; still: boolean }) {
  const [paint] = useState(facePaint);
  const moving = !still && (face === "eyes" || face === "hearts");
  useEffect(() => {
    drawFace(paint, face, color, 0);
    invalidate();
  }, [paint, face, color]);
  useEffect(() => () => (paint.tex.dispose(), paint.material.dispose()), [paint]);
  useFrame(({ clock }) => {
    if (moving) drawFace(paint, face, color, clock.elapsedTime);
  });
  return (
    <group position={at(100, 82)}>
      <mesh geometry={VISOR} material={paint.material} />
      <mesh geometry={VISOR} material={INK} />
    </group>
  );
}

// easeOutBack, as the 2D bee's pop.
const backOut = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

function Piece({ popping, children }: { popping: boolean; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const t = useRef(popping ? 0 : 1);
  useFrame((_, dt) => {
    if (t.current >= 1 || !ref.current) return;
    t.current = Math.min(1, t.current + dt / 0.26);
    ref.current.scale.setScalar(0.9 + 0.1 * backOut(t.current));
  });
  return (
    <group ref={ref} scale={popping ? 0.9 : 1}>
      {children}
    </group>
  );
}

// Rocks its children about one axis, as a sine wave.
function Swing({ pos, axis, rest, swing, rate, lag = 0, still, children }: { pos: V3; axis: "y" | "z"; rest: number; swing: number; rate: number; lag?: number; still: boolean; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!still) ref.current!.rotation[axis] = rest + swing * Math.sin(clock.elapsedTime * rate - lag);
  });
  return (
    <group ref={ref} position={pos} rotation={axis === "y" ? [0, rest, 0] : [0, 0, rest]}>
      {children}
    </group>
  );
}

type Dressing = { avatar: Avatar; pop?: Slot; still: boolean };

// Keyed on the piece, so a swap remounts it and the new one pops in.
function dress<S extends Slot>({ avatar, pop, still }: Dressing, slot: S, arts: Record<Avatar[S]["item"], Art>) {
  const { item, color } = avatar[slot];
  const [fill, trim] = PAINT[color as ColorId];
  return (
    <Piece key={`${slot}-${item}-${color}`} popping={!still && pop === slot}>
      {arts[item](fill, trim)}
    </Piece>
  );
}

// The head and all it wears: the passport shows just this.
function Head(props: Dressing) {
  const { avatar, pop, still } = props;
  return (
    <>
      <Pair>
        {/* Pivots where it leaves the head. */}
        <Swing pos={ANTENNA_ROOT} axis="z" rest={0} swing={0.06} rate={2.4} still={still}>
          <group position={ANTENNA_BACK}>
            <Part geo={ANTENNA} color="#45454f" />
            <Part geo={TIP} pos={at(69, 15, 0.06)} color={HONEY} />
          </group>
        </Swing>
      </Pair>
      <Part geo={HEAD} pos={at(100, 74)} color={HONEY} />
      <Part geo={STRIPE} pos={at(100, 74)} color={DARK} ink={false} />
      <Piece key={`face-${avatar.face.item}-${avatar.face.color}`} popping={!still && pop === "face"}>
        <Visor face={avatar.face.item} color={PAINT[avatar.face.color][0]} still={still} />
      </Piece>
      {dress(props, "glasses", GLASSES)}
      {dress(props, "hat", HATS)}
      {dress(props, "ears", HEADPHONES)}
    </>
  );
}

function BeeModel(props: Dressing) {
  const { still } = props;
  const body = useRef<Group>(null);
  const shadow = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    const rise = Math.sin((t * Math.PI) / 2);
    body.current!.position.y = 0.03 + 0.03 * rise;
    shadow.current!.scale.setScalar(0.9 - 0.08 * rise);
  });

  return (
    <>
      <group position={[0, -1.36, 0]}>
        <mesh geometry={FLOOR} material={GLOW} position={[0, -0.18, 0]} />
        <Part geo={STEP} pos={[0, -0.135, 0]} color="#1c1c21" ink={false} />
        <Part geo={PLINTH} pos={[0, -0.05, 0]} color="#26262b" ink={false} />
        {RIMS.map(([geo, y]) => (
          <mesh key={geo.uuid} geometry={geo} material={RIM} position={[0, y, 0]} />
        ))}
        <group ref={shadow}>
          <mesh geometry={SHADOW_DISC} material={SHADOW} position={[0, 0.002, 0.03]} />
        </group>
      </group>

      <group ref={body} position={[0, 0.03, 0]}>
        <Pair>
          {/* Wing beats, the lower pair trailing the upper. */}
          <Swing pos={[-0.12, -0.08, -0.24]} axis="y" rest={-0.5} swing={0.22} rate={24} still={still}>
            <mesh geometry={UPPER} material={WING} />
          </Swing>
          <Swing pos={[-0.12, -0.22, -0.23]} axis="y" rest={-0.35} swing={0.22} rate={24} lag={0.9} still={still}>
            <mesh geometry={LOWER} material={WING} />
          </Swing>
          <Part geo={LEG} color={HONEY} />
          <Part geo={ARM} color={HONEY} />
          <Part geo={HAND} pos={at(50, 189, 0.02)} color={HONEY} />
        </Pair>

        <Part geo={NECK} pos={[0, 0.22, 0]} color="#c98a1c" />
        {dress(props, "bottom", BOTTOMS)}
        {dress(props, "shoes", SHOES)}
        {dress(props, "top", TOPS)}
        <Head {...props} />
      </group>
    </>
  );
}

type Spin = { yaw: number; pitch: number };
// Starts turned away, so it swings round to face you as it loads.
const START: V3 = [0, -0.9, 0];

// Eases the bee toward where it was dragged; on demand it keeps asking for
// frames until it gets there.
function Turntable({ spin, children }: { spin: RefObject<Spin>; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(({ invalidate }, dt) => {
    const g = ref.current!;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8);
    g.rotation.y += (spin.current.yaw - g.rotation.y) * k;
    g.rotation.x += (spin.current.pitch - g.rotation.x) * k;
    if (Math.abs(spin.current.yaw - g.rotation.y) + Math.abs(spin.current.pitch - g.rotation.x) > 0.001) invalidate();
  });
  return (
    <group ref={ref} rotation={START}>
      {children}
    </group>
  );
}

export default function Bee3D({ avatar, pop, className = "" }: { avatar: Avatar; pop?: Slot; className?: string }) {
  const [still] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const spin = useRef<Spin>({ yaw: 0, pitch: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const turn = (by: number) => {
    spin.current.yaw += by;
    invalidate();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    spin.current.yaw += (e.clientX - drag.current.x) * 0.012;
    spin.current.pitch = Math.max(-0.3, Math.min(0.45, spin.current.pitch + (e.clientY - drag.current.y) * 0.006));
    drag.current = { x: e.clientX, y: e.clientY };
    invalidate();
  };
  const drop = () => {
    drag.current = null;
  };

  return (
    <div className={`${styles.viewer} ${className}`}>
      <div
        className={styles.canvas}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={onMove}
        onPointerUp={drop}
        onPointerCancel={drop}
      >
        <Canvas
          flat
          dpr={[1, 2]}
          frameloop={still ? "demand" : "always"}
          camera={{ fov: 26, position: [0, 0.35, 7.4] }}
          gl={{ antialias: true }}
          aria-hidden
        >
          <Lights />
          <Turntable spin={spin}>
            <BeeModel avatar={avatar} pop={pop} still={still} />
          </Turntable>
        </Canvas>
      </div>
      <div className={styles.turns}>
        <button type="button" className={styles.turn} onClick={() => turn(-Math.PI / 4)}>
          Turn left
          <RotateCcw size={14} aria-hidden="true" />
        </button>
        <button type="button" className={styles.turn} onClick={() => turn(Math.PI / 4)}>
          Turn right
          <RotateCw size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// --- The passport's headshot ---

// Furthest it turns, in radians: side to side, up and down. It turns that far
// at the edge of where it notices the cursor: up to NEAR px outside its box,
// which on the passport reaches just into the Hacker Profile box.
const [MAX_YAW, MAX_PITCH, NEAR] = [0.75, 0.45, 22];
// A spring (half a second, bounce 0.25): a quick move swings the head round,
// a touch past, and it settles.
const [STIFF, DAMP] = [158, 19];

// Turns, then nods, about the middle of the head.
function Gaze({ aim, children }: { aim: RefObject<Spin>; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const now = useRef({ yaw: 0, pitch: 0, vy: 0, vp: 0 });
  useFrame((_, dt) => {
    const [s, t] = [now.current, Math.min(dt, 0.05)];
    s.vy += (STIFF * (aim.current.yaw - s.yaw) - DAMP * s.vy) * t;
    s.vp += (STIFF * (aim.current.pitch - s.pitch) - DAMP * s.vp) * t;
    s.yaw += s.vy * t;
    s.pitch += s.vp * t;
    ref.current!.rotation.set(s.pitch, s.yaw, 0, "YXZ");
  });
  return (
    <group ref={ref} position={[0, -0.12, 0]}>
      <group position={[0, -0.66, 0]}>{children}</group>
    </group>
  );
}

// Just the head, turning to look at the cursor while it's near, and back to
// the front once it goes. Passport.tsx only loads it where it can move.
export function BeeHead({ avatar, className = "" }: { avatar: Avatar; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const aim = useRef<Spin>({ yaw: 0, pitch: 0 });
  useEffect(() => {
    const off = new AbortController();
    const rest = () => {
      aim.current = { yaw: 0, pitch: 0 };
    };
    window.addEventListener(
      "pointermove",
      (e) => {
        const box = host.current!.getBoundingClientRect();
        // -1 to 1 across the box and its margin.
        const x = (e.clientX - box.x - box.width / 2) / (box.width / 2 + NEAR);
        const y = (e.clientY - box.y - box.height / 2) / (box.height / 2 + NEAR);
        if (e.pointerType === "touch" || Math.abs(x) > 1 || Math.abs(y) > 1) rest();
        else aim.current = { yaw: x * MAX_YAW, pitch: y * MAX_PITCH };
      },
      off,
    );
    document.documentElement.addEventListener("pointerleave", rest, off);
    return () => off.abort();
  }, []);

  return (
    <div ref={host} className={className}>
      {/* Far enough back that ear cups clear the box's sides, even turned. Passport.tsx frames the flat head to match. */}
      <Canvas flat dpr={[2, 3]} camera={{ fov: 30, position: [0, 0, 3.55] }} style={{ pointerEvents: "none" }} aria-hidden>
        <Lights />
        <Gaze aim={aim}>
          <Head avatar={avatar} still={false} />
        </Gaze>
      </Canvas>
    </div>
  );
}
