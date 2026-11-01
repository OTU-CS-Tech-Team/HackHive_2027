"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { clamp, placeRect, sceneMotion } from "./motion";
import styles from "./path-scene.module.css";
import { VIEWBOX, layers, midFlowersSvg, signButtons, walls } from "./scene";

type PetalKind = "daisy" | "poppy" | "buttercup" | "lupin" | "leaf";

const PETALS: { kind: PetalKind; left: string; top: string; delay: string; duration: string; size: number }[] = [
  { kind: "poppy", left: "12%", top: "8%", delay: "-3s", duration: "17s", size: 18 },
  { kind: "daisy", left: "22%", top: "16%", delay: "-8s", duration: "19s", size: 16 },
  { kind: "buttercup", left: "78%", top: "12%", delay: "-5s", duration: "16s", size: 15 },
  { kind: "lupin", left: "86%", top: "22%", delay: "-11s", duration: "18s", size: 14 },
  { kind: "leaf", left: "30%", top: "6%", delay: "-6.5s", duration: "20s", size: 16 },
  { kind: "poppy", left: "70%", top: "18%", delay: "-13s", duration: "17s", size: 17 },
  { kind: "daisy", left: "8%", top: "26%", delay: "-1.5s", duration: "21s", size: 13 },
];

function PetalShape({ kind }: { kind: PetalKind }) {
  switch (kind) {
    case "daisy":
      return (
        <g>
          <ellipse rx="7" ry="16" fill="#FFFEF8" stroke="#E4DECF" strokeWidth="1" />
          <circle cy="9" r="3.2" fill="#F0B429" />
        </g>
      );
    case "poppy":
      return <path d="M0 10 C 9 6 13 -8 0 -16 C -13 -8 -9 6 0 10 Z" fill="#E24B4A" stroke="#7A2428" strokeWidth="1" />;
    case "buttercup":
      return <circle r="8" fill="#F2C63D" stroke="#C89214" strokeWidth="1" />;
    case "lupin":
      return <ellipse rx="5" ry="8" fill="#7D5BA6" stroke="#3C2A58" strokeWidth="1" />;
    case "leaf":
      return <ellipse rx="6" ry="13" fill="#6EA44C" stroke="#24341C" strokeWidth="1" transform="rotate(28)" />;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function phaseLabel(progress: number) {
  if (progress < 0.46) return "Trailhead";
  if (progress < 0.72) return "Petal wall";
  return "Wall parts";
}

export function PathScene() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const playing = useRef(false);
  const [progress, setProgress] = useState(0);
  const [tall, setTall] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const measure = () => setStage({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const reduced = media.matches;
      setReduce(reduced);
      setTall(!reduced);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previousScroll = root.style.scrollBehavior;
    const previousBody = document.body.style.backgroundColor;
    root.style.scrollBehavior = "auto";
    document.body.style.backgroundColor = "#f3e4a6";
    return () => {
      root.style.scrollBehavior = previousScroll;
      document.body.style.backgroundColor = previousBody;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const readProgress = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    const total = track.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    const scrolled = Math.min(Math.max(-track.getBoundingClientRect().top, 0), total);
    return scrolled / total;
  }, []);

  useEffect(() => {
    if (!tall) return;
    const onScroll = () => {
      if (playing.current) return;
      setProgress(readProgress());
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [readProgress, tall]);

  const scrollToProgress = useCallback(
    (value: number) => {
      const next = clamp(value, 0, 1);
      const track = trackRef.current;
      if (!track || !tall) {
        setProgress(next);
        return;
      }
      const total = track.offsetHeight - window.innerHeight;
      const start = window.scrollY + track.getBoundingClientRect().top;
      window.scrollTo({ top: start + total * next, behavior: "instant" });
      setProgress(next);
    },
    [tall],
  );

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (reduce) {
      const stops = [0, 0.52, 0.7, 1];
      const next = stops.find((stop) => stop > progress + 0.02) ?? 0;
      scrollToProgress(next);
      return;
    }
    playing.current = true;
    const start = performance.now();
    const duration = 8400;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      scrollToProgress(t);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else playing.current = false;
    };
    scrollToProgress(0);
    raf.current = requestAnimationFrame(step);
  }, [progress, reduce, scrollToProgress]);

  const { walk, wallOpen } = sceneMotion(progress);
  const buttonStyle = (rect: { x: number; y: number; w: number; h: number }) => {
    const box = placeRect(rect, stage.w, stage.h, VIEWBOX.width, VIEWBOX.height);
    return {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      fontSize: Math.max(12, box.height * 0.34),
      borderRadius: Math.max(6, box.height * 0.22),
    };
  };

  return (
    <main ref={trackRef} className={styles.track} data-tall={tall ? "true" : "false"}>
      <div className={styles.sticky}>
        <h1 className={styles.srOnly}>HackHive 2027</h1>
        <p className={styles.srOnly}>January 29–31, 2027. Chapter 1, Trailhead.</p>
        <div ref={stageRef} className={styles.stage} data-scene="trailhead">
          {layers.map((layer) => {
            const scale = 1 + layer.speed * walk;
            const frame = layer.id === "far-trees" ? styles.sway : styles.still;
            return (
              <div
                key={layer.id}
                className={styles.layer}
                data-layer={layer.id}
                data-mobile={layer.mobile ? "true" : "false"}
                style={{ transform: `scale(${scale})`, zIndex: layer.depth + 1 }}
              >
                <div className={frame}>
                  {layer.id === "mid-flowers" ? (
                    <div className={styles.plate} dangerouslySetInnerHTML={{ __html: midFlowersSvg }} />
                  ) : (
                    <Image
                      className={styles.plateImg}
                      src={layer.src}
                      alt=""
                      fill
                      unoptimized
                      priority
                      sizes="100vw"
                      draggable={false}
                    />
                  )}
                </div>
                {layer.id === "sign" && stage.w > 0 ? (
                  <>
                    <Link href="/apply" className={`${styles.signButton} ${styles.join}`} style={buttonStyle(signButtons.join)}>
                      Join
                    </Link>
                    <button
                      type="button"
                      className={`${styles.signButton} ${styles.learn}`}
                      style={buttonStyle(signButtons.learn)}
                      onClick={play}
                    >
                      Learn more
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}

          {PETALS.map((petal) => (
            <svg
              key={`${petal.kind}-${petal.left}`}
              className={styles.petal}
              viewBox="-20 -20 40 40"
              width={petal.size}
              height={petal.size}
              style={{ left: petal.left, top: petal.top, animationDelay: petal.delay, animationDuration: petal.duration }}
              aria-hidden="true"
            >
              <PetalShape kind={petal.kind} />
            </svg>
          ))}

          <div className={styles.wall} style={{ transform: `translate3d(${(-wallOpen * 105).toFixed(2)}%, 0, 0)`, zIndex: 20 }}>
            <Image className={styles.plateImg} src={walls.left.src} alt="" fill unoptimized priority sizes="100vw" draggable={false} />
          </div>
          <div className={styles.wall} style={{ transform: `translate3d(${(wallOpen * 105).toFixed(2)}%, 0, 0)`, zIndex: 20 }}>
            <Image className={styles.plateImg} src={walls.right.src} alt="" fill unoptimized priority sizes="100vw" draggable={false} />
          </div>

          <header className={styles.top}>
            <Link href="/" className={styles.wordmark}>
              HackHive
            </Link>
            <p className={styles.kicker}>Chapter 1 · Trailhead</p>
          </header>

          <div className={styles.dock}>
            <button
              type="button"
              className={styles.walk}
              onClick={play}
              aria-label={reduce ? "Show the next still of the walk" : "Play the walk and petal wall"}
            >
              Walk
            </button>
            <label className={styles.scrub}>
              <span>{phaseLabel(progress)}</span>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(progress * 1000)}
                aria-label="Walk the path"
                aria-valuetext={phaseLabel(progress)}
                onChange={(event) => {
                  playing.current = false;
                  cancelAnimationFrame(raf.current);
                  scrollToProgress(Number(event.target.value) / 1000);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}
