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
  rays: boolean;
  grass: string;
  grassDeep: string;
  path: string;
  bend: number;
  seed: number;
};

function mood(id: ChapterId): Mood {
  switch (id) {
    case "trailhead":
      return { skyTop: "#fff8dc", skyBottom: "#f4e2a4", sun: "#fff4c4", glow: "#fff1b8", sunX: 720, sunY: 132, sunR: 42, rays: true, grass: "#d5e4b4", grassDeep: "#c3d79a", path: "#e6c79a", bend: 18, seed: 1 };
    case "clearing":
      return { skyTop: "#fff3c8", skyBottom: "#f6d592", sun: "#ffe7a8", glow: "#ffe3a0", sunX: 820, sunY: 150, sunR: 46, rays: false, grass: "#d7e4ae", grassDeep: "#c6da9c", path: "#e4c08a", bend: 70, seed: 2 };
    case "fork":
      return { skyTop: "#ffeab4", skyBottom: "#f3c56e", sun: "#ffd27a", glow: "#ffd08a", sunX: 900, sunY: 168, sunR: 50, rays: false, grass: "#d4e0a8", grassDeep: "#c4d698", path: "#e2b97e", bend: 0, seed: 3 };
    case "oak":
      return { skyTop: "#ffd9a0", skyBottom: "#f0b25c", sun: "#ffbe6a", glow: "#ffc27a", sunX: 1080, sunY: 190, sunR: 56, rays: false, grass: "#d2dca0", grassDeep: "#c2d294", path: "#deb06e", bend: -80, seed: 4 };
    case "stream":
      return { skyTop: "#f8c890", skyBottom: "#e89255", sun: "#ff9d4e", glow: "#ffb06a", sunX: 1160, sunY: 220, sunR: 64, rays: false, grass: "#d0d89a", grassDeep: "#c0ce90", path: "#d9a864", bend: 24, seed: 5 };
    case "fence":
      return { skyTop: "#f2b07e", skyBottom: "#e07048", sun: "#ff8344", glow: "#ff9960", sunX: 1200, sunY: 250, sunR: 74, rays: false, grass: "#cfd492", grassDeep: "#bcc888", path: "#d29a58", bend: 110, seed: 6 };
    case "hive":
      return { skyTop: "#e88468", skyBottom: "#c44e3a", sun: "#ffb15e", glow: "#ff9966", sunX: 1120, sunY: 300, sunR: 86, rays: false, grass: "#c9cc8c", grassDeep: "#b8c484", path: "#cc8e4e", bend: -36, seed: 7 };
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

function Ground({ m }: { m: Mood }) {
  return (
    <>
      <rect y="430" width="1440" height="470" fill={m.grass} />
      <path d={`M0 500 C 360 ${470 + m.bend * 0.1} 1080 ${520 - m.bend * 0.08} 1440 490 V900 H0 Z`} fill={m.grassDeep} />
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

function FlowerBed({ m }: { m: Mood }) {
  const colors = ["#fffdf8", "#f7c4d2", "#ffe28a"];
  const marks = [];
  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = 720 + side * (220 + unit(m.seed * 20 + i) * 420);
    const y = 520 + unit(m.seed * 20 + i + 5) * 340;
    marks.push(
      <Bloom key={i} x={x} y={y} s={0.7 + unit(m.seed + i) * 0.55} color={colors[i % colors.length]} />,
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
          <stop offset="100%" stopColor={m.skyBottom} />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={m.glow} stopOpacity="0.95" />
          <stop offset="70%" stopColor={m.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${grad})`} />
      <circle cx={m.sunX} cy={m.sunY} r={m.sunR * 3.1} fill={`url(#${glow})`} />
      <circle cx={m.sunX} cy={m.sunY} r={m.sunR} fill={m.sun} />
      {m.rays &&
        Array.from({ length: 10 }, (_, i) => {
          const angle = (Math.PI / 180) * (i * 36 - 90);
          const inner = m.sunR + 14;
          const outer = m.sunR + 78;
          return (
            <line
              key={i}
              x1={m.sunX + Math.cos(angle) * inner}
              y1={m.sunY + Math.sin(angle) * inner}
              x2={m.sunX + Math.cos(angle) * outer}
              y2={m.sunY + Math.sin(angle) * outer}
              stroke="#fff6d2"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.75"
            />
          );
        })}
      {id === "trailhead" && (
        <>
          <ellipse cx="280" cy="180" rx="90" ry="28" fill="#fffdf6" opacity="0.45" />
          <ellipse cx="340" cy="190" rx="60" ry="20" fill="#fffdf6" opacity="0.35" />
        </>
      )}
    </svg>
  );
}

function Far({ id }: { id: ChapterId }) {
  const m = mood(id);
  const shift = m.bend * 0.4;
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      <ellipse cx={720 + shift} cy="455" rx="860" ry="78" fill={m.skyBottom} opacity="0.55" />
      <Canopy x={150 + shift} y={400} s={0.85} pale />
      <Canopy x={250 + shift} y={418} s={1.05} pale />
      <Canopy x={1180 + shift} y={408} s={0.95} pale />
      <Canopy x={1310 + shift} y={392} s={0.8} pale />
    </svg>
  );
}

function Mid({ id }: { id: ChapterId }) {
  const m = mood(id);
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      <Ground m={m} />
      <PathBand m={m} fork={id === "fork"} />
      {id === "clearing" && <ellipse cx="720" cy="590" rx="250" ry="92" fill="#e7f2c9" />}
      <FlowerBed m={m} />
      <Canopy x={70} y={520} s={1.25} />
      <Canopy x={1360} y={500} s={1.35} />
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
      <ellipse cx="640" cy="690" rx="220" ry="36" fill="rgba(80,30,10,0.2)" />
      <ellipse cx="640" cy="560" rx="176" ry="164" fill="#f0a24c" />
      <ellipse cx="640" cy="500" rx="158" ry="34" fill="#e28a34" />
      <ellipse cx="640" cy="575" rx="164" ry="26" fill="#c96d28" opacity="0.55" />
      <ellipse cx="640" cy="640" rx="146" ry="22" fill="#e39a40" />
      <ellipse cx="640" cy="600" rx="44" ry="34" fill="#24180f" />
      <rect x="596" y="628" width="88" height="12" rx="3" fill="#f6d48a" />
    </g>
  );
}

function Near({ id }: { id: ChapterId }) {
  const m = mood(id);
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      {id === "trailhead" && (
        <>
          <Canopy x={180} y={560} s={1.7} />
          <Canopy x={1260} y={540} s={1.8} />
        </>
      )}
      {id === "clearing" && (
        <>
          <Canopy x={220} y={500} s={1.4} />
          <Canopy x={1220} y={510} s={1.45} />
        </>
      )}
      {id === "fork" && (
        <>
          <Canopy x={160} y={470} s={1.5} />
          <Canopy x={1280} y={480} s={1.55} />
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
      {(id === "trailhead" || id === "clearing" || id === "fork") && (
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
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={styles.scene} aria-hidden="true">
      <g>
        <ellipse cx="40" cy="40" rx="120" ry="46" fill="#3e7c34" transform="rotate(-28 40 40)" />
        <ellipse cx="120" cy="20" rx="90" ry="36" fill="#5c9a46" transform="rotate(-12 120 20)" />
        <ellipse cx="1400" cy="30" rx="130" ry="48" fill="#2f682c" transform="rotate(24 1400 30)" />
        <ellipse cx="1280" cy="70" rx="80" ry="30" fill="#74b35a" transform="rotate(16 1280 70)" />
      </g>
      <Bloom x={430} y={820} s={2.4} color="#fffdf8" />
      <Bloom x={360} y={860} s={1.8} color="#f7c4d2" />
      <Bloom x={500} y={870} s={1.5} color="#ffe28a" />
      <Bloom x={1040} y={830} s={2.5} color="#fffdf8" />
      <Bloom x={1140} y={870} s={1.7} color="#f7c4d2" />
      <Bloom x={960} y={880} s={1.4} color="#ffe28a" />
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
