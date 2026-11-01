"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, sceneMotion } from "./motion";
import styles from "./path-scene.module.css";
import { layers, midFlowersSvg, walls } from "./scene";

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
          <ellipse cy="-8" rx="5" ry="11" fill="#FFFFFF" opacity="0.95" />
          <ellipse cy="-8" rx="5" ry="11" fill="#FFFFFF" transform="rotate(60)" />
          <ellipse cy="-8" rx="5" ry="11" fill="#F4F7EC" transform="rotate(120)" />
          <circle r="3.4" fill="#F0C14A" />
        </g>
      );
    case "poppy":
      return (
        <g>
          <ellipse cy="-6" rx="8" ry="10" fill="#E45462" />
          <ellipse cy="-6" rx="8" ry="10" fill="#FF8B86" transform="rotate(70)" />
          <circle r="3" fill="#5C2430" />
        </g>
      );
    case "buttercup":
      return <circle r="7" fill="#F6C53A" />;
    case "lupin":
      return <ellipse rx="4.5" ry="8" fill="#8E78D8" />;
    case "leaf":
      return <ellipse rx="5" ry="12" fill="#3E9E55" transform="rotate(28)" />;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function phaseLabel(progress: number) {
  if (progress < 0.46) return "Trailhead";
  if (progress < 0.72) return "Petal wall";
  return "Chapter 2";
}

export function PathScene() {
  const trackRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const playing = useRef(false);
  const [progress, setProgress] = useState(0);
  const [tall, setTall] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [showWalls, setShowWalls] = useState(false);
  const commitProgress = useCallback((value: number) => {
    setProgress(value);
    if (value >= 0.35) setShowWalls(true);
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
    document.body.style.backgroundColor = "#8ec6ef";
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
      commitProgress(readProgress());
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [commitProgress, readProgress, tall]);

  const scrollToProgress = useCallback(
    (value: number) => {
      const next = clamp(value, 0, 1);
      const track = trackRef.current;
      if (!track || !tall) {
        commitProgress(next);
        return;
      }
      const total = track.offsetHeight - window.innerHeight;
      const start = window.scrollY + track.getBoundingClientRect().top;
      window.scrollTo({ top: start + total * next, behavior: "instant" });
      commitProgress(next);
    },
    [commitProgress, tall],
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

  const { walk, wallOpen, hero, chapter } = sceneMotion(progress);

  return (
    <main ref={trackRef} className={styles.track} data-tall={tall ? "true" : "false"}>
      <div className={styles.sticky}>
        <div className={styles.stage} data-scene="trailhead">
          {layers.map((layer) => {
            const scale = 1 + layer.speed * walk;
            const frame = layer.id === "hills" ? styles.sway : styles.still;
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

          <div className={styles.bloom} />

          <div className={styles.chapter} style={{ opacity: chapter }} aria-hidden={chapter < 0.04}>
            <svg className={styles.chapterArt} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="c2-dirt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F3E0C0" />
                  <stop offset="100%" stopColor="#9A7048" />
                </linearGradient>
                <linearGradient id="c2-stripe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFF4DE" />
                  <stop offset="100%" stopColor="#C9A06A" />
                </linearGradient>
                <filter id="c2-soft" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>
              <path d="M700 470 C 640 620, 560 760, 390 980 L 1050 980 C 900 760, 790 620, 740 470 Z" fill="url(#c2-dirt)" filter="url(#c2-soft)" />
              <path d="M712 490 C 690 660, 660 800, 600 980 L 840 980 C 790 800, 750 660, 728 490 Z" fill="url(#c2-stripe)" opacity="0.55" />
              <g fill="#F4D36A" opacity="0.85">
                <ellipse cx="250" cy="760" rx="18" ry="10" />
                <ellipse cx="1180" cy="720" rx="16" ry="9" />
                <ellipse cx="340" cy="860" rx="22" ry="12" />
                <ellipse cx="1120" cy="860" rx="20" ry="11" />
              </g>
            </svg>
            <div className={styles.chapterCopy}>
              <p className={styles.chapterKicker}>Chapter 2</p>
              <p className={styles.chapterTitle}>Placeholder</p>
              <p className={styles.chapterNote}>The next chapter starts here.</p>
            </div>
          </div>

          {showWalls ? (
            <>
              <div className={styles.wall} style={{ transform: `translate3d(${(-wallOpen * 105).toFixed(2)}%, 0, 0)`, zIndex: 20 }}>
                <Image className={styles.plateImg} src={walls.left.src} alt="" fill unoptimized sizes="100vw" draggable={false} />
              </div>
              <div className={styles.wall} style={{ transform: `translate3d(${(wallOpen * 105).toFixed(2)}%, 0, 0)`, zIndex: 20 }}>
                <Image className={styles.plateImg} src={walls.right.src} alt="" fill unoptimized sizes="100vw" draggable={false} />
              </div>
            </>
          ) : null}

          <div className={styles.vignette} />

          <Link href="/" className={styles.brand}>
            HackHive
          </Link>

          <header className={styles.hero} style={{ opacity: hero, visibility: hero === 0 ? "hidden" : "visible" }}>
            <p className={styles.kicker}>Chapter 1 · Trailhead</p>
            <h1 className={styles.title}>
              <span className={styles.frost} aria-hidden="true">
                HackHive
              </span>
              <span className={styles.face}>HackHive</span>
            </h1>
            <p className={styles.date}>Jan 29–31, 2027</p>
            <div className={styles.actions} style={{ pointerEvents: hero > 0.65 ? "auto" : "none" }}>
              <Link href="/apply" className={`${styles.ghost} ${styles.join}`}>
                Join
              </Link>
              <Link href="/#faq" className={`${styles.ghost} ${styles.learn}`}>
                Learn more
              </Link>
            </div>
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
