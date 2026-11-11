"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import {
  INTRO,
  forceIntroReady,
  introPhase,
  introSnapshot,
  reportIntroProgress,
  setIntroPhase,
  skipDescent,
  startDescent,
  subscribeIntro,
} from "@/components/landing/intro/introBus";
import styles from "@/components/landing/intro/intro.module.css";

/**
 * A pointy-top honeycomb over a 1600 square, drawn with
 * preserveAspectRatio="xMidYMid slice" so it covers any frame from a phone
 * to an ultrawide. Tiles are a touch larger than their spacing, so no seam
 * shows the page through. Each tile's delay grows with its distance from
 * the centre, which is the centre of every frame under "slice".
 */
const SIZE = 1600;
const RADIUS = 62;
const TILE = RADIUS + 1.5;
const STEP_X = Math.sqrt(3) * RADIUS;
const STEP_Y = RADIUS * 1.5;
const REACH = 950;
const FILLS = ["#1d2742", "#1f2a47", "#1b243e", "#1d2742"];

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const HEX_POINTS = Array.from({ length: 6 }, (_, i) => {
  const angle = Math.PI / 6 + (i * Math.PI) / 3;
  return `${(Math.cos(angle) * TILE).toFixed(2)},${(Math.sin(angle) * TILE).toFixed(2)}`;
}).join(" ");

const TILES = (() => {
  const tiles: { x: number; y: number; delay: number; fill: string }[] = [];
  const rows = Math.ceil(SIZE / STEP_Y) + 1;
  const cols = Math.ceil(SIZE / STEP_X) + 1;
  for (let row = -1; row <= rows; row += 1) {
    for (let col = -1; col <= cols; col += 1) {
      const x = col * STEP_X + (row % 2 === 0 ? 0 : STEP_X / 2);
      const y = row * STEP_Y;
      const distance = Math.hypot(x - SIZE / 2, y - SIZE / 2);
      const jitter = (hash(row * 31 + col) - 0.5) * 24;
      const delay = Math.max(0, Math.min(1, distance / REACH) * INTRO.rippleMs + jitter);
      tiles.push({ x, y, delay: Math.round(delay), fill: FILLS[Math.floor(hash(row * 7 + col * 13) * FILLS.length)] ?? "#1d2742" });
    }
  }
  return tiles;
})();

/** The CSS reads its timings from INTRO, so the two cannot drift apart. */
const TIMING = {
  "--intro-lead": `${INTRO.wipeLeadMs}ms`,
  "--intro-tile": `${INTRO.tileMs}ms`,
  "--intro-logo": `${INTRO.logoFadeMs}ms`,
} as CSSProperties;

export function IntroOverlay() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (introPhase() !== "loading") return;
    document.documentElement.style.setProperty("--intro-text", `${INTRO.textMs}ms`);
    // A very slow load: the CSS failsafe is about to (or did) clear the
    // loader and unlock the page. Starting now would bring it back.
    if (performance.now() > INTRO.lateMs) {
      setIntroPhase("done");
      return;
    }
    const timers: number[] = [];
    let went = false;
    let waitingForTab = false;
    // The page is up and hydrated: a first notch on the bar.
    reportIntroProgress(0.12);

    const go = () => {
      if (went) return;
      // A tab opened in the background: hold until someone can see it.
      if (document.visibilityState !== "visible") {
        if (!waitingForTab) {
          waitingForTab = true;
          document.addEventListener("visibilitychange", onVisible);
        }
        return;
      }
      went = true;
      if (performance.now() > INTRO.lateMs) {
        setIntroPhase("done");
        return;
      }
      try {
        window.sessionStorage.setItem("hh-intro", "1");
      } catch {
        // Private mode: it will just play again next time.
      }
      setIntroPhase("wipe");
      // Only descend over a scene that has drawn. When the failsafe forced
      // the wipe, the poster (the resting view) shows instead, so the camera
      // lands at once and the poster hands off to a matching frame.
      let landed = INTRO.wipeLeadMs + INTRO.rippleMs + INTRO.tileMs;
      if (introSnapshot().sceneReady) {
        startDescent(performance.now() + INTRO.wipeLeadMs);
        landed = INTRO.wipeLeadMs + INTRO.descentMs;
      } else {
        skipDescent();
      }
      timers.push(window.setTimeout(() => setIntroPhase("text"), Math.max(0, landed - INTRO.textMs)));
      timers.push(window.setTimeout(() => setIntroPhase("done"), landed + 60));
    };

    const sync = () => {
      const snapshot = introSnapshot();
      barRef.current?.style.setProperty("--p", snapshot.progress.toFixed(3));
      if (!snapshot.ready || went) return;
      // Counted from navigation start: the honeycomb has been up since first paint.
      const wait = INTRO.minLoaderMs - performance.now();
      if (wait > 0) timers.push(window.setTimeout(go, wait));
      else go();
    };

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      waitingForTab = false;
      sync();
    }

    const unsubscribe = subscribeIntro(sync);
    sync();
    timers.push(window.setTimeout(forceIntroReady, Math.max(0, INTRO.failsafeMs - performance.now())));

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      for (const id of timers) window.clearTimeout(id);
      // Leaving the page mid-intro must not leave the next page hidden or
      // locked. Checked a tick later: Strict Mode unmounts and remounts at
      // once in development, and that must not end the intro.
      window.setTimeout(() => {
        if (document.querySelector("[data-intro-root]")) return;
        const phase = introPhase();
        if (phase === "loading" || phase === "wipe" || phase === "text") setIntroPhase("done");
      }, 0);
    };
  }, []);

  return (
    <div className={styles.root} data-intro-root="" aria-hidden="true" style={TIMING}>
      <svg className={styles.comb} viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <polygon id="hh-intro-hex" points={HEX_POINTS} />
        </defs>
        {TILES.map((tile, index) => (
          <use
            key={index}
            href="#hh-intro-hex"
            x={tile.x.toFixed(1)}
            y={tile.y.toFixed(1)}
            className={styles.tile}
            style={{ "--d": `${tile.delay}ms`, fill: tile.fill } as CSSProperties}
          />
        ))}
      </svg>
      <div className={styles.center}>
        <Image className={styles.logo} src="/Images/HackhiveLogo.png" alt="" width={88} height={88} priority />
        <div className={styles.track}>
          <div ref={barRef} className={styles.bar} />
        </div>
      </div>
    </div>
  );
}
