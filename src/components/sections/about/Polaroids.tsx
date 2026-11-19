"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { fallbackSrc, srcSet, type AboutProject } from "@/lib/about";
import styles from "./about.module.css";

// #3 leans the most.
const TILTS = [-2.5, 1.75, 5.5];
const FLY_S = 0.32;
const THUMB_SIZES = "(min-width: 1024px) 20rem, (min-width: 640px) 40vw, 90vw";

type Phase = "closed" | "flying" | "open" | "closing";

function PlayMark() {
  return (
    <span className={styles.play} aria-hidden="true">
      <svg viewBox="0 0 12 12" width="12" height="12">
        <path d="M3 1.8v8.4L10.2 6z" fill="currentColor" />
      </svg>
    </span>
  );
}

// Simple Icons' Devpost mark and GitHub's mark, drawn in the caption's ink.
function DevpostIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.002 1.61 0 12.004 6.002 22.39h11.996L24 12.004 17.998 1.61zm1.593 4.084h3.947c3.605 0 6.276 1.695 6.276 6.31 0 4.436-3.21 6.302-6.456 6.302H7.595zm2.517 2.449v7.714h1.241c2.646 0 3.862-1.55 3.862-3.861.009-2.569-1.096-3.853-3.767-3.853z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

/**
 * Projects from HackHive 2026 as Polaroids. Each is a button; opening one flies that Polaroid to the
 * middle of the screen (FLIP: measure the slot and the final spot, then animate the difference
 * away), straightens it, dims the page, and once it lands swaps the photo for the YouTube demo.
 * A native <dialog> gives Esc, the focus trap and returning focus to the button.
 */
export function Polaroids({
  projects,
  sequenced = false,
}: {
  projects: readonly AboutProject[];
  /** Played in by scroll (ProjectsSequence): each slot is a sequence item that flies in on its turn. */
  sequenced?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("closed");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tween = useRef<gsap.core.Timeline | null>(null);
  const done = useRef(true); // set once a close has been tidied up, so it only happens once

  const project = active === null ? null : projects[active];

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Where the card has to start (or end) to sit exactly over its slot, relative to its centred spot.
  const slotOffset = useCallback((index: number) => {
    const button = buttons.current[index];
    const card = cardRef.current;
    if (!button || !card) return null;
    const from = button.getBoundingClientRect(); // rotated box, but rotation keeps the centre
    const to = card.getBoundingClientRect();
    return {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      scale: button.offsetWidth / card.offsetWidth, // unrotated widths
      // phones tilt the Polaroids less (see about.module.css)
      rotation: TILTS[index % TILTS.length] * (window.matchMedia("(max-width: 639px)").matches ? 0.4 : 1),
    };
  }, []);

  const finishClose = useCallback(() => {
    if (done.current) return;
    done.current = true;
    const dialog = dialogRef.current;
    const index = active;
    tween.current?.kill();
    document.documentElement.style.removeProperty("overflow");
    if (dialog?.open) dialog.close();
    if (index !== null) {
      const button = buttons.current[index];
      if (button) {
        button.style.visibility = "";
        button.focus({ preventScroll: true });
      }
    }
    setPhase("closed");
    setActive(null);
  }, [active]);

  const close = useCallback(() => {
    if (active === null || phase === "closing" || phase === "closed") return;
    const card = cardRef.current;
    const scrim = scrimRef.current;
    const to = slotOffset(active);
    setPhase("closing"); // drops the iframe, so the video stops before the card flies back
    if (!card || !scrim || !to || reducedMotion()) {
      finishClose();
      return;
    }
    tween.current?.kill();
    tween.current = gsap
      .timeline({ onComplete: finishClose })
      .to(card, { ...to, duration: FLY_S * 0.85, ease: "power3.inOut" }, 0)
      .to(scrim, { opacity: 0, duration: FLY_S * 0.85, ease: "power1.out" }, 0);
  }, [active, phase, slotOffset, finishClose]);

  // Open: show the dialog, then fly the card in from its slot (with reduced motion it just opens).
  useLayoutEffect(() => {
    if (active === null || (phase !== "flying" && phase !== "open")) return;
    const dialog = dialogRef.current;
    const card = cardRef.current;
    const scrim = scrimRef.current;
    if (!dialog || !card || !scrim || dialog.open) return;
    done.current = false;
    dialog.showModal();
    // React's autoFocus never reaches the DOM, so showModal would pick the iframe (where Esc is lost).
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    if (phase === "open") {
      gsap.set(scrim, { opacity: 1 });
      return;
    }
    const from = slotOffset(active);
    const button = buttons.current[active];
    if (button) button.style.visibility = "hidden"; // the Polaroid itself is what flies
    tween.current?.kill();
    tween.current = gsap
      .timeline({ onComplete: () => setPhase("open") })
      .fromTo(card, { ...from }, { x: 0, y: 0, scale: 1, rotation: 0, duration: FLY_S, ease: "power3.out" }, 0)
      .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: FLY_S, ease: "power1.out" }, 0);
  }, [active, phase, slotOffset]);

  useEffect(() => () => {
    tween.current?.kill();
    document.documentElement.style.removeProperty("overflow");
  }, []);

  function open(index: number) {
    if (phase !== "closed") return;
    setActive(index);
    setPhase(reducedMotion() ? "open" : "flying");
  }

  return (
    <>
      <ol className={styles.polaroids}>
        {projects.map((p, i) => (
          <li
            key={p.id}
            className={sequenced ? `${styles.slot} ${styles.seqItem}` : styles.slot}
            data-step={i}
            data-seq={sequenced ? String(i) : undefined}
            data-state={sequenced ? "hidden" : undefined}
          >
            <button
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              className={styles.polaroid}
              style={{ "--tilt": `${TILTS[i % TILTS.length]}deg` } as CSSProperties}
              aria-haspopup="dialog"
              onClick={() => open(i)}
            >
              <span className={styles.polaroidPhoto}>
                <span className={styles.asciiPhoto}>
                  <picture>
                    <source type="image/avif" srcSet={srcSet(p.image, "avif")} sizes={THUMB_SIZES} />
                    <source type="image/webp" srcSet={srcSet(p.image, "webp")} sizes={THUMB_SIZES} />
                    <img
                      src={fallbackSrc(p.image)}
                      alt={p.image.alt}
                      width={800}
                      height={450}
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </span>
                <PlayMark />
              </span>
              <span className={styles.caption}>
                <span className={styles.captionName}>{p.name}</span>
                <span className="sr-only">. Play the demo video.</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="about-project-title"
        onCancel={(event) => {
          // Esc: fly back instead of vanishing.
          event.preventDefault();
          close();
        }}
        // Closed some other way (a second Esc the browser won't let us intercept): tidy up.
        onClose={finishClose}
      >
        <div ref={scrimRef} className={styles.scrim} onClick={close} aria-hidden="true" />
        {project && active !== null ? (
          <div ref={cardRef} className={styles.dialogCard}>
            <div className={styles.dialogPhoto}>
              {phase === "open" ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(project.youtubeId)}?autoplay=1&rel=0&playsinline=1`}
                  title={`${project.name} demo video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <picture>
                  <source type="image/avif" srcSet={srcSet(project.image, "avif")} sizes="56rem" />
                  <source type="image/webp" srcSet={srcSet(project.image, "webp")} sizes="56rem" />
                  <img src={fallbackSrc(project.image)} alt="" width={800} height={450} />
                </picture>
              )}
            </div>
            <div className={styles.dialogCaption}>
              <h3 id="about-project-title" className={styles.captionName}>
                {project.name}
              </h3>
              <p className={styles.projectDescription}>{project.description}</p>
              <p className={styles.projectLinks}>
                <a href={project.devpost} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
                  <DevpostIcon />
                  Devpost
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {project.github ? (
                  <a href={project.github} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
                    <GithubIcon />
                    GitHub
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : null}
              </p>
              <button ref={closeRef} type="button" className={styles.close} onClick={close}>
                close <span aria-hidden="true">&times;</span>
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
