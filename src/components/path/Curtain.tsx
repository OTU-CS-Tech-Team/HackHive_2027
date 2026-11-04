import styles from "@/components/path/path.module.css";

const PETAL_WALLS = {
  left: "/path/transition/petal-wall-left.webp",
  right: "/path/transition/petal-wall-right.webp",
} as const;

export function Curtain({ showArt }: { showArt: boolean }) {
  return (
    <div className={styles.curtain} data-curtain aria-hidden="true">
      {(["left", "right"] as const).map((side) => (
        <div key={side} className={styles.curtainHalf} data-curtain-side={side}>
          {showArt ? (
            // The wall files stay out of the document until the walk passes the trailhead.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.art} src={PETAL_WALLS[side]} alt="" decoding="async" draggable={false} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
