"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/path/path.module.css";

const MeadowScene = dynamic(() => import("@/components/landing/MeadowScene"), {
  ssr: false,
});

const FALLBACK =
  "linear-gradient(180deg, #e2f2f8 0%, #d7eef8 20%, #f4e4b4 48%, #c5de8a 70%, #78a84a 100%)";

export default function MeadowDemo() {
  const progress = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const locked = useRef(false);
  const [ready, setReady] = useState(false);
  const params = useSearchParams();
  const bare = params.get("bare") === "1";

  useEffect(() => {
    if (params.has("progress")) {
      progress.current = clamp(Number(params.get("progress")));
      locked.current = true;
    }
    const aim = params.get("pointer");
    if (aim) {
      const [x, y] = aim.split(",").map(Number);
      pointer.current = { x: clamp(x ?? 0, -1, 1), y: clamp(y ?? 0, -1, 1) };
    }

    const onScroll = () => {
      if (locked.current) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.current = max > 0 ? clamp(window.scrollY / max) : 0;
    };
    const onPointer = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      pointer.current.x += (clamp(x, -1, 1) - pointer.current.x) * 0.35;
      pointer.current.y += (clamp(y, -1, 1) - pointer.current.y) * 0.35;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [params]);

  return (
    <div className="relative h-[240vh]" data-path-scroll="">
      <div className="sticky top-0 h-dvh">
        <div className="relative h-full w-full">
          {!ready ? <div className="absolute inset-0" style={{ background: FALLBACK }} /> : null}
          <MeadowScene
            className="absolute inset-0"
            progress={progress}
            pointer={pointer}
            onReady={() => setReady(true)}
          />
          {bare ? null : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 pt-16">
              <h1 className={`${styles.heroTitle} ${styles.display}`}>
                <span className={styles.heroFrost} aria-hidden="true">
                  HackHive
                </span>
                <span className={styles.heroFace}>HackHive</span>
              </h1>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
