import styles from "@/components/path/path.module.css";

type Petal = {
  id: string;
  side: "left" | "right";
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  color: string;
  radius: string;
};

function unit(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const COLORS = ["#f4b7c6", "#fff7ee", "#f3d56b", "#9dcb73", "#e7f2c9", "#d98aa6", "#7eae58", "#fffdf8"];
const RADII = ["70% 30% 70% 30%", "50%", "40% 60% 70% 30%", "80% 20% 80% 20%"];

const PETALS: Petal[] = Array.from({ length: 42 }, (_, i) => {
  const side = i < 21 ? "left" : "right";
  return {
    id: `petal-${i}`,
    side,
    x: unit(i + 1) * 100,
    y: unit(i + 30) * 100,
    w: 42 + unit(i + 50) * 84,
    h: 26 + unit(i + 70) * 48,
    rot: unit(i + 90) * 80 - 40,
    color: COLORS[i % COLORS.length] ?? "#fff7ee",
    radius: RADII[i % RADII.length] ?? "50%",
  };
});

export function Curtain() {
  return (
    <div className={styles.curtain} data-curtain aria-hidden="true">
      {(["left", "right"] as const).map((side) => (
        <div key={side} className={styles.curtainHalf} data-curtain-side={side}>
          {PETALS.filter((petal) => petal.side === side).map((petal) => (
            <span
              key={petal.id}
              className={styles.petal}
              style={{
                left: `${petal.x}%`,
                top: `${petal.y}%`,
                width: petal.w,
                height: petal.h,
                background: petal.color,
                borderRadius: petal.radius,
                transform: `rotate(${petal.rot}deg)`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
