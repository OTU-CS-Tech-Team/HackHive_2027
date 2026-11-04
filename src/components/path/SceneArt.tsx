import { assertNever } from "@/components/path/math";
import type { ChapterId, LayerSlot } from "@/components/path/types";
import styles from "@/components/path/path.module.css";

type Mood = {
  skyTop: string;
  skyBottom: string;
  sun: string;
  glow: string;
  sunX: number;
  sunY: number;
  sunR: number;
  grass: string;
  grassDeep: string;
  path: string;
  bend: number;
  seed: number;
};

function mood(id: ChapterId): Mood {
  switch (id) {
    case "trailhead":
      return { skyTop: "#fffdf8", skyBottom: "#f4efe0", sun: "#fff6e6", glow: "#fff3dc", sunX: 720, sunY: 168, sunR: 78, grass: "#e7f2cf", grassDeep: "#d7e8bc", path: "#f3ddc4", bend: 0, seed: 1 };
    case "clearing":
      return { skyTop: "#fff7e6", skyBottom: "#f6e4bc", sun: "#ffeec4", glow: "#ffe9b8", sunX: 820, sunY: 150, sunR: 46, grass: "#e4f0c8", grassDeep: "#d4e6b6", path: "#f0d4b0", bend: 70, seed: 2 };
    case "fork":
      return { skyTop: "#fff1d0", skyBottom: "#f4d7a0", sun: "#ffe0a4", glow: "#ffdba8", sunX: 900, sunY: 168, sunR: 50, grass: "#e2eec4", grassDeep: "#d2e4b2", path: "#edd0a8", bend: 0, seed: 3 };
    case "oak":
      return { skyTop: "#ffe8c4", skyBottom: "#f3c890", sun: "#ffd09a", glow: "#ffd4a4", sunX: 1080, sunY: 190, sunR: 56, grass: "#e0ecc0", grassDeep: "#d0e2ae", path: "#e8c89a", bend: -80, seed: 4 };
    case "stream":
      return { skyTop: "#fad8b4", skyBottom: "#eeae84", sun: "#ffb888", glow: "#ffc49a", sunX: 1160, sunY: 220, sunR: 64, grass: "#dce8b8", grassDeep: "#ccdeb0", path: "#e4c090", bend: 24, seed: 5 };
    case "fence":
      return { skyTop: "#f6c8aa", skyBottom: "#e89878", sun: "#ffaa80", glow: "#ffb892", sunX: 1200, sunY: 250, sunR: 74, grass: "#d8e4b4", grassDeep: "#c8daac", path: "#deb488", bend: 110, seed: 6 };
    case "hive":
      return { skyTop: "#f0a898", skyBottom: "#d47060", sun: "#ffc48a", glow: "#ffb898", sunX: 1120, sunY: 300, sunR: 86, grass: "#d4e0b0", grassDeep: "#c6d6a8", path: "#d8aa78", bend: -36, seed: 7 };
    default:
      return assertNever(id);
  }
}

function unit(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function Canopy({ x, y, s, pale = false }: { x: number; y: number; s: number; pale?: boolean }) {
  const leaf = pale ? "#9dca86" : "#5c9a46";
  const shade = pale ? "#b7d9a4" : "#3e7c34";
  const highlight = pale ? "#d5ebc4" : "#86c46a";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="34" rx="36" ry="10" fill="rgba(70,40,10,0.12)" />
      <rect x="-6" y="10" width="12" height="40" rx="4" fill={pale ? "#b08968" : "#7a4e2c"} />
      <circle cx="0" cy="0" r="26" fill={leaf} />
      <circle cx="-16" cy="8" r="16" fill={shade} />
      <circle cx="15" cy="6" r="17" fill={highlight} />
    </g>
  );
}

function Bloom({ x, y, s = 1, color = "#fffdf8" }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 4 C 1 -6, -1 -10, 0 -16" stroke="#3d7a34" strokeWidth="1.7" fill="none" />
      <circle cx="0" cy="-18" r="4" fill={color} />
      <circle cx="-3.6" cy="-15.5" r="2.8" fill={color} />
      <circle cx="3.6" cy="-15.5" r="2.8" fill={color} />
      <circle cx="0" cy="-21" r="2.5" fill={color} />
      <circle cx="0" cy="-18" r="1.6" fill="#e0a02a" />
    </g>
  );
}

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((Math.PI / 180) * (60 * i - 30));
    return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  }).join(" ");
}

function Ground({ m, id }: { m: Mood; id: ChapterId }) {
  const grad = `ground-${id}`;
  return (
    <>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={m.grass} />
          <stop offset="100%" stopColor={m.grassDeep} />
        </linearGradient>
      </defs>
      <rect y="418" width="1440" height="482" fill={`url(#${grad})`} />
    </>
  );
}

function PathBand({ m, fork = false }: { m: Mood; fork?: boolean }) {
  const hx = 720 + m.bend * 0.35;
  const left = 500 + m.bend;
  const right = 940 + m.bend;
  return (
    <g>
      <path
        d={`M ${hx - 26} 438 L ${hx + 26} 438 L ${right} 900 L ${left} 900 Z`}
        fill={m.path}
      />
      <path
        d={`M ${hx - 8} 438 L ${hx + 4} 438 L ${(left + right) / 2 + 30} 900 L ${(left + right) / 2 - 10} 900 Z`}
        fill="rgba(255,248,230,0.18)"
      />
      {fork && (
        <>
          <path d={`M ${hx - 10} 560 L ${hx + 10} 560 L 1040 390 L 980 390 Z`} fill={m.path} />
          <path d={`M ${hx - 10} 560 L ${hx + 10} 560 L 430 400 L 490 400 Z`} fill={m.path} />
        </>
      )}
    </g>
  );
}

const BLOOM_COLORS = ["#fffdf8", "#f7c9d4", "#ffe4a3", "#f8d5c8"] as const;

function corridorHalf(y: number) {
  const t = Math.min(1, Math.max(0, (y - 430) / 470));
  return 54 + t * 196;
}

function FlowerBed({ m }: { m: Mood }) {
  const marks = [];
  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = 720 + side * (220 + unit(m.seed * 20 + i) * 420);
    const y = 520 + unit(m.seed * 20 + i + 5) * 340;
    marks.push(
      <Bloom key={i} x={x} y={y} s={0.7 + unit(m.seed + i) * 0.55} color={BLOOM_COLORS[i % BLOOM_COLORS.length]} />,
    );
  }
  return <g>{marks}</g>;
}

function Meadow({
  seed,
  count,
  y0,
  y1,
  minScale,
  maxScale,
}: {
  seed: number;
  count: number;
  y0: number;
  y1: number;
  minScale: number;
  maxScale: number;
}) {
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const y = y0 + unit(seed * 17 + i * 3.1) * (y1 - y0);
    const side = i % 2 === 0 ? -1 : 1;
    const half = corridorHalf(y) + 6;
    const reach = Math.min(240, Math.max(48, 700 - half));
    const along = unit(seed * 9 + i * 1.7) ** 1.65;
    const x = 720 + side * (half + along * reach);
    const scale = minScale + unit(seed + i * 2.3) * (maxScale - minScale);
    marks.push(
      <Bloom key={i} x={x} y={y} s={scale} color={BLOOM_COLORS[i % BLOOM_COLORS.length]} />,
    );
  }
  return <g>{marks}</g>;
}

function Sky({ id, prefix }: { id: ChapterId; prefix: string }) {
  const m = mood(id);
  const grad = `${prefix}-sky`;
  const glow = `${prefix}-glow`;
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={m.skyTop} />
          <stop offset="52%" stopColor={m.skyTop} />
          <stop offset="100%" stopColor={m.skyBottom} />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={m.glow} stopOpacity="0.55" />
          <stop offset="72%" stopColor={m.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${grad})`} />
      <circle cx={m.sunX} cy={m.sunY} r={m.sunR * 3.1} fill={`url(#${glow})`} />
      <circle cx={m.sunX} cy={m.sunY} r={m.sunR} fill={m.sun} />
      {id === "trailhead" && (
        <ellipse cx="720" cy="210" rx="280" ry="70" fill="#fffdf8" opacity="0.35" />
      )}
    </svg>
  );
}

function Far({ id }: { id: ChapterId }) {
  const m = mood(id);
  const shift = m.bend * 0.4;
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      <ellipse cx={720 + shift} cy="468" rx="900" ry="70" fill={m.grass} opacity="0.28" />
      <Canopy x={150 + shift} y={400} s={0.85} pale />
      <Canopy x={250 + shift} y={418} s={1.05} pale />
      <Canopy x={1120 + shift} y={408} s={0.95} pale />
      <Canopy x={1240 + shift} y={392} s={0.8} pale />
    </svg>
  );
}

function Mid({ id }: { id: ChapterId }) {
  const m = mood(id);
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      <Ground m={m} id={id} />
      <PathBand m={m} fork={id === "fork"} />
      {id === "clearing" && <ellipse cx="720" cy="590" rx="250" ry="92" fill="#e7f2c9" />}
      {id === "trailhead" ? (
        <Meadow seed={m.seed} count={72} y0={490} y1={880} minScale={0.62} maxScale={1.15} />
      ) : (
        <FlowerBed m={m} />
      )}
      {id !== "trailhead" && (
        <>
          <Canopy x={90} y={520} s={1.25} />
          <Canopy x={1280} y={500} s={1.35} />
        </>
      )}
    </svg>
  );
}

function Oak() {
  return (
    <g>
      <rect x="248" y="390" width="34" height="340" rx="10" fill="#6b4224" />
      <path d="M274 470 C 400 440, 500 500, 590 455" stroke="#6b4224" strokeWidth="14" fill="none" strokeLinecap="round" />
      <circle cx="230" cy="360" r="96" fill="#3e7c34" />
      <circle cx="330" cy="390" r="78" fill="#5c9a46" />
      <circle cx="168" cy="410" r="70" fill="#2f682c" />
      <circle cx="280" cy="320" r="54" fill="#7db85e" />
      <line x1="575" y1="458" x2="575" y2="512" stroke="#e6c48a" strokeWidth="2" />
      {[
        [575, 548],
        [548, 532],
        [602, 532],
        [548, 566],
        [602, 566],
        [575, 516],
        [575, 580],
      ].map(([x, y]) => (
        <polygon key={`${x}-${y}`} points={hexPoints(x, y, 18)} fill="#f0c14d" stroke="#e0a82e" strokeWidth="1.5" />
      ))}
    </g>
  );
}

function Stream() {
  return (
    <g>
      <path
        d="M-30 590 C 220 530, 480 670, 740 590 C 980 520, 1200 660, 1480 575 L 1480 690 C 1160 760, 860 640, 620 710 C 340 780, 100 680, -30 730 Z"
        fill="#7eb4d6"
      />
      <path
        d="M-20 630 C 280 580, 620 700, 900 625 C 1120 570, 1300 660, 1470 615"
        fill="none"
        stroke="#f4fbff"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.8"
      />
    </g>
  );
}

function Fence() {
  const posts = [140, 300, 460, 620, 820, 980, 1140, 1300];
  return (
    <g>
      {posts.map((x) => (
        <rect key={x} x={x} y="500" width="18" height="200" rx="3" fill="#7a4e2c" />
      ))}
      <path d="M100 575 H1360" stroke="#6b4224" strokeWidth="10" strokeLinecap="round" />
      <path d="M100 630 H1360" stroke="#8d5a34" strokeWidth="8" strokeLinecap="round" />
    </g>
  );
}

function HiveDome() {
  return (
    <g>
      <ellipse cx="470" cy="690" rx="190" ry="32" fill="rgba(80,30,10,0.2)" />
      <ellipse cx="470" cy="545" rx="158" ry="148" fill="#f0a24c" />
      <ellipse cx="470" cy="488" rx="142" ry="30" fill="#e28a34" />
      <ellipse cx="470" cy="560" rx="148" ry="24" fill="#c96d28" opacity="0.55" />
      <ellipse cx="470" cy="620" rx="132" ry="20" fill="#e39a40" />
      <ellipse cx="470" cy="585" rx="40" ry="30" fill="#24180f" />
      <rect x="428" y="612" width="84" height="12" rx="3" fill="#f6d48a" />
    </g>
  );
}

function Near({ id }: { id: ChapterId }) {
  const m = mood(id);
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      {id === "trailhead" && (
        <Meadow seed={m.seed + 40} count={56} y0={540} y1={930} minScale={1} maxScale={1.85} />
      )}
      {id === "clearing" && (
        <>
          <Canopy x={200} y={500} s={1.4} />
          <Canopy x={1160} y={510} s={1.4} />
        </>
      )}
      {id === "fork" && (
        <>
          <Canopy x={150} y={470} s={1.5} />
          <Canopy x={1200} y={480} s={1.5} />
        </>
      )}
      {id === "oak" && <Oak />}
      {id === "stream" && <Stream />}
      {id === "fence" && <Fence />}
      {id === "hive" && (
        <>
          <HiveDome />
          <Canopy x={180} y={560} s={1.5} />
          <Canopy x={1280} y={540} s={1.4} />
        </>
      )}
      {(id === "clearing" || id === "fork") && (
        <FlowerBed m={{ ...m, seed: m.seed + 40 }} />
      )}
    </svg>
  );
}

const FLIES = [
  [480, 280, 3.2, "0s"],
  [560, 220, 2.4, "-1.2s"],
  [700, 180, 2.8, "-2s"],
  [860, 240, 3.4, "-0.4s"],
  [980, 190, 2.2, "-2.6s"],
  [1100, 320, 3, "-1.6s"],
  [420, 360, 2.2, "-3s"],
  [760, 300, 2.6, "-0.8s"],
  [1240, 260, 2.4, "-2.2s"],
  [300, 240, 2, "-1s"],
] as const;

function Foreground({ id }: { id: ChapterId }) {
  const edge = [
    [90, 620, 2.1, "#fffdf8"],
    [40, 760, 2.6, "#f7c9d4"],
    [170, 840, 2.2, "#ffe4a3"],
    [250, 900, 1.7, "#fffdf8"],
    [1360, 610, 2.2, "#fffdf8"],
    [1410, 750, 2.7, "#f7c9d4"],
    [1260, 830, 2.15, "#ffe4a3"],
    [1180, 905, 1.65, "#f8d5c8"],
  ] as const;
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      {id !== "trailhead" && (
        <g>
          <ellipse cx="40" cy="40" rx="120" ry="46" fill="#3e7c34" transform="rotate(-28 40 40)" />
          <ellipse cx="120" cy="20" rx="90" ry="36" fill="#5c9a46" transform="rotate(-12 120 20)" />
          <ellipse cx="1400" cy="30" rx="130" ry="48" fill="#2f682c" transform="rotate(24 1400 30)" />
          <ellipse cx="1280" cy="70" rx="80" ry="30" fill="#74b35a" transform="rotate(16 1280 70)" />
        </g>
      )}
      {id === "trailhead" ? (
        edge.map(([x, y, s, color]) => <Bloom key={`${x}-${y}`} x={x} y={y} s={s} color={color} />)
      ) : (
        <>
          <Bloom x={390} y={760} s={2.2} color="#fffdf8" />
          <Bloom x={300} y={800} s={1.6} color="#f7c4d2" />
          <Bloom x={470} y={810} s={1.35} color="#ffe28a" />
          <Bloom x={1040} y={770} s={2.3} color="#fffdf8" />
          <Bloom x={1140} y={810} s={1.55} color="#f7c4d2" />
          <Bloom x={940} y={820} s={1.3} color="#ffe28a" />
        </>
      )}
      {id === "hive" && (
        <g className={styles.flies}>
          {FLIES.map(([x, y, r, delay]) => (
            <circle
              key={`${x}-${y}`}
              className={styles.firefly}
              cx={x}
              cy={y}
              r={r}
              fill="#fff6c8"
              style={{ animationDelay: delay }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

export function SceneArt({
  chapterId,
  slot,
  prefix,
}: {
  chapterId: ChapterId;
  slot: LayerSlot;
  prefix: string;
}) {
  switch (slot) {
    case "sky":
      return <Sky id={chapterId} prefix={prefix} />;
    case "far":
      return <Far id={chapterId} />;
    case "mid":
      return <Mid id={chapterId} />;
    case "near":
      return <Near id={chapterId} />;
    case "foreground":
      return <Foreground id={chapterId} />;
    default:
      return assertNever(slot);
  }
}
