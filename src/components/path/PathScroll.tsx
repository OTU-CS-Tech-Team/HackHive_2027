"use client";

import { Children, cloneElement, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { smoothstep, TRAIL_MOTION } from "@/app/prototype/path/motion";
import { FINAL_WASH } from "@/components/path/chapters";
import { Curtain } from "@/components/path/Curtain";
import { zoomScale } from "@/components/path/math";
import type { PathChapter, PathLayer } from "@/components/path/types";
import styles from "@/components/path/path.module.css";

const HASH_CHAPTER: Record<string, string> = {
  faq: "stream",
  sponsors: "fence",
  schedule: "oak",
  about: "clearing",
  tracks: "fork",
  trailhead: "trailhead",
  apply: "hive",
};

function armArt(root: HTMLElement, chapterId: string, includeHeavy: boolean) {
  root.querySelectorAll<HTMLImageElement>(`img[data-art-for="${chapterId}"]`).forEach((img) => {
    if (!includeHeavy && img.closest("[data-layer]")?.getAttribute("data-mobile") === "off") return;
    const next = img.dataset.src;
    if (!next || img.getAttribute("src") === next) return;
    img.src = next;
  });
}

function PathLayerView({
  chapter,
  layer,
  prefix,
}: {
  chapter: PathChapter;
  layer: PathLayer;
  prefix: string;
}) {
  const eager = prefix === "world-trailhead" && layer.mobile !== false;
  return (
    <div
      className={styles.layer}
      data-layer=""
      data-slot={layer.slot}
      data-depth={layer.depth}
      data-mobile={layer.mobile === false ? "off" : "on"}
      aria-hidden={layer.alt ? undefined : true}
      data-speed={layer.speed ?? undefined}
      data-painted="true"
      data-sway={layer.id.endsWith("hills") ? "true" : undefined}
      style={{ zIndex: layer.order }}
    >
      {/* Drop-in art from public/path. next/image would need sizes Jiwoo has not set. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.art}
        src={eager ? layer.src : undefined}
        data-src={layer.src}
        data-art-for={chapter.id}
        alt={layer.alt}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}

function LayerStack({
  chapter,
  kind,
}: {
  chapter: PathChapter;
  kind: "world" | "preview";
}) {
  const prefix = `${kind}-${chapter.id}`;
  return (
    <>
      {chapter.layers.map((layer) => (
        <PathLayerView key={`${prefix}-${layer.id}`} chapter={chapter} layer={layer} prefix={prefix} />
      ))}
    </>
  );
}

function markRange(el: HTMLElement) {
  const trigger = ScrollTrigger.getAll().find((item) => item.trigger === el);
  if (!trigger) return;
  el.dataset.pinStart = String(Math.round(trigger.start));
  el.dataset.pinEnd = String(Math.round(trigger.end));
}

function paintSpacer(el: HTMLElement) {
  const spacer = el.parentElement;
  if (!spacer?.classList.contains("pin-spacer")) return;
  spacer.style.background = getComputedStyle(el).backgroundColor;
}

export function PathScroll({
  chapters,
  children,
}: {
  chapters: PathChapter[];
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wallsReady = useRef(false);
  const [showWalls, setShowWalls] = useState(false);
  const panels = Children.toArray(children);

  const mountWalls = () => {
    if (wallsReady.current) return;
    wallsReady.current = true;
    setShowWalls(true);
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);

    const setDots = (index: number) => {
      root.querySelectorAll<HTMLButtonElement>("[data-path-dot]").forEach((dot) => {
        dot.setAttribute("aria-current", dot.dataset.index === String(index) ? "true" : "false");
      });
    };

    const applyVh = () => {
      root.style.setProperty("--path-vh", `${window.innerHeight}px`);
    };
    applyVh();

    const mm = gsap.matchMedia();
    mm.add(
      {
        reduce: "(prefers-reduced-motion: reduce)",
        mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      },
      (context) => {
        const reduce = Boolean(context.conditions?.reduce);
        const mobile = Boolean(context.conditions?.mobile);
        const chapterEls = [...root.querySelectorAll<HTMLElement>("[data-path-chapter]")];

        const scrollToChapter = (chapterId: string, hash: string) => {
          const el = chapterEls.find((item) => item.dataset.pathChapter === chapterId);
          if (!el) return;
          const index = chapterEls.indexOf(el);
          if (index >= 0) setDots(index);
          armArt(root, chapterId, !mobile);
          const next = chapterEls[index + 1]?.dataset.pathChapter;
          if (next) armArt(root, next, !mobile);
          const url = `#${hash}`;
          if (window.location.hash !== url) history.pushState(null, "", url);
          if (reduce || !el.dataset.pinStart) {
            el.scrollIntoView({ block: "start" });
            return;
          }
          window.scrollTo({ top: Number(el.dataset.pinStart) + 1, behavior: "auto" });
        };

        const onClick = (event: MouseEvent) => {
          if (event.defaultPrevented || event.button !== 0) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          const link = target.closest("a");
          if (!link) return;
          const href = link.getAttribute("href");
          if (!href) return;
          let url: URL;
          try {
            url = new URL(href, window.location.href);
          } catch {
            return;
          }
          if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
          const hash = url.hash.replace("#", "");
          const chapterId = HASH_CHAPTER[hash];
          if (!chapterId) return;
          event.preventDefault();
          event.stopPropagation();
          scrollToChapter(chapterId, hash);
        };

        const onHash = () => {
          const hash = window.location.hash.replace("#", "");
          const chapterId = HASH_CHAPTER[hash];
          if (chapterId) scrollToChapter(chapterId, hash);
        };

        document.addEventListener("click", onClick, true);
        window.addEventListener("hashchange", onHash);

        if (reduce) {
          root.dataset.motion = "reduce";
          const observer = new IntersectionObserver(
            (entries) => {
              const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
              if (!visible) return;
              const index = chapterEls.indexOf(visible.target as HTMLElement);
              if (index >= 0) setDots(index);
              const id = (visible.target as HTMLElement).dataset.pathChapter;
              if (id) armArt(root, id, true);
            },
            { rootMargin: "50% 0px", threshold: [0.2, 0.45, 0.7] },
          );
          chapterEls.forEach((el) => observer.observe(el));
          root.dataset.pathReady = "true";
          const hash = window.location.hash.replace("#", "");
          const chapterId = HASH_CHAPTER[hash];
          if (chapterId) scrollToChapter(chapterId, hash);
          return () => {
            observer.disconnect();
            document.removeEventListener("click", onClick, true);
            window.removeEventListener("hashchange", onHash);
            root.dataset.pathReady = "false";
          };
        }

        root.dataset.motion = mobile ? "mobile" : "full";
        if (!mobile) armArt(root, "trailhead", true);

        chapterEls.forEach((el, index) => {
          const world = el.querySelector<HTMLElement>("[data-world]");
          const preview = el.querySelector<HTMLElement>("[data-preview]");
          const curtain = el.querySelector<HTMLElement>("[data-curtain]");
          const left = el.querySelector<HTMLElement>('[data-curtain-side="left"]');
          const right = el.querySelector<HTMLElement>('[data-curtain-side="right"]');
          const content = el.querySelector<HTMLElement>("[data-chapter-content]");
          const wash = el.querySelector<HTMLElement>("[data-light-wash]");
          const layers = [...el.querySelectorAll<HTMLElement>("[data-world] [data-layer]")].filter(
            (layer) => (mobile ? layer.dataset.mobile !== "off" : true),
          );
          const isLast = index === chapterEls.length - 1;
          const isTrailhead = el.dataset.pathChapter === "trailhead";
          const pinScreens = isLast
            ? mobile
              ? 1.7
              : 1.9
            : isTrailhead
              ? mobile
                ? 2.3
                : 2.8
              : mobile
                ? 2.1
                : 2.6;
          el.style.setProperty("--pin-screens", String(pinScreens));

          const shownIndex = (progress: number) =>
            !isLast && progress >= TRAIL_MOTION.closeEnd ? index + 1 : index;

          const timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: "bottom bottom",
              scrub: true,
              invalidateOnRefresh: true,
              onToggle: (self) => {
                if (self.isActive) setDots(shownIndex(self.progress));
              },
              onUpdate: (self) => {
                if (self.progress >= TRAIL_MOTION.mountAt) mountWalls();
                const id = el.dataset.pathChapter;
                if (id && (self.isActive || self.progress > 0)) armArt(root, id, !mobile);
                const nextId = chapterEls[index + 1]?.dataset.pathChapter;
                if (nextId && self.progress > 0.18) armArt(root, nextId, !mobile);
                if (self.isActive) setDots(shownIndex(self.progress));
              },
              onRefresh: (self) => {
                el.dataset.pinStart = String(Math.round(self.start));
                el.dataset.pinEnd = String(Math.round(self.end));
                paintSpacer(el);
                if (self.progress >= TRAIL_MOTION.mountAt) mountWalls();
              },
            },
          });

          layers.forEach((layer) => {
            const speed = Number(layer.dataset.speed);
            if (speed > 0) {
              gsap.set(layer, { force3D: true, transformOrigin: "50% 49.8%", scale: 1 });
              timeline.to(layer, { scale: 1 + speed, duration: TRAIL_MOTION.walkEnd, ease: smoothstep }, 0);
              return;
            }
            gsap.set(layer, { force3D: true, transformOrigin: "50% 50%", scale: 1 });
            timeline.to(
              layer,
              {
                scale: zoomScale(Number(layer.dataset.depth ?? 0), mobile),
                duration: isLast ? 1 : TRAIL_MOTION.walkEnd,
              },
              0,
            );
          });

          if (wash) timeline.to(wash, { opacity: 0.62, duration: isLast ? 1 : TRAIL_MOTION.walkEnd }, 0);

          if (!isLast && curtain && left && right && world) {
            const closeSpan = TRAIL_MOTION.closeEnd - TRAIL_MOTION.closeStart;
            const heroSpan = TRAIL_MOTION.heroEnd - TRAIL_MOTION.closeStart;
            if (content) {
              timeline.to(content, { autoAlpha: 0, duration: heroSpan, ease: smoothstep }, TRAIL_MOTION.closeStart);
            }
            gsap.set(curtain, { scale: 1, opacity: 1 });
            // A CSS percentage transform would be recorded as a pixel x and then stacked
            // on xPercent, leaving the closed wall a full viewport off-screen.
            left.style.transform = "";
            right.style.transform = "";
            gsap.set(left, { x: 0, xPercent: -TRAIL_MOTION.partPercent, force3D: true });
            gsap.set(right, { x: 0, xPercent: TRAIL_MOTION.partPercent, force3D: true });
            timeline.to(left, { xPercent: 0, duration: closeSpan, ease: smoothstep }, TRAIL_MOTION.closeStart);
            timeline.to(right, { xPercent: 0, duration: closeSpan, ease: smoothstep }, TRAIL_MOTION.closeStart);
            timeline.to(world, { autoAlpha: 0, duration: 0.02 }, TRAIL_MOTION.closeEnd);
            if (preview) {
              timeline.to(
                preview,
                { autoAlpha: 1, duration: TRAIL_MOTION.chapterSpan, ease: smoothstep },
                TRAIL_MOTION.closeEnd,
              );
            }
            timeline.to(
              left,
              { xPercent: -TRAIL_MOTION.partPercent, duration: TRAIL_MOTION.partSpan, ease: smoothstep },
              TRAIL_MOTION.closeEnd,
            );
            timeline.to(
              right,
              { xPercent: TRAIL_MOTION.partPercent, duration: TRAIL_MOTION.partSpan, ease: smoothstep },
              TRAIL_MOTION.closeEnd,
            );
          }
        });

        const bar = root.querySelector<HTMLElement>("[data-path-progress]");
        if (bar) {
          gsap.fromTo(
            bar,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: root,
                start: "top top",
                end: "bottom bottom",
                scrub: true,
              },
            },
          );
        }

        const publish = () => {
          ScrollTrigger.refresh();
          chapterEls.forEach(markRange);
          chapterEls.forEach(paintSpacer);
          root.dataset.pathReady = "true";
          const hash = window.location.hash.replace("#", "");
          const chapterId = HASH_CHAPTER[hash];
          if (chapterId) scrollToChapter(chapterId, hash);
        };
        requestAnimationFrame(publish);

        return () => {
          document.removeEventListener("click", onClick, true);
          window.removeEventListener("hashchange", onHash);
          root.dataset.pathReady = "false";
        };
      },
    );

    const onResize = () => {
      applyVh();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      mm.revert();
    };
  }, []);

  const jump = (index: number) => {
    const root = rootRef.current;
    if (!root) return;
    const el = root.querySelectorAll<HTMLElement>("[data-path-chapter]")[index];
    if (!el) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const id = el.dataset.pathChapter;
    if (id) armArt(root, id, !mobile);
    root.querySelectorAll<HTMLButtonElement>("[data-path-dot]").forEach((dot) => {
      dot.setAttribute("aria-current", dot.dataset.index === String(index) ? "true" : "false");
    });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = el.dataset.pinStart;
    const anchor = el.id;
    if (anchor) history.pushState(null, "", `#${anchor}`);
    if (reduce || !start) {
      el.scrollIntoView({ block: "start" });
      return;
    }
    window.scrollTo({ top: Number(start) + 1, behavior: "auto" });
  };

  return (
    <div ref={rootRef} className={styles.root} data-path-scroll="" data-motion="full">
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressBar} data-path-progress="" />
      </div>
      {chapters.map((chapter, index) => {
        const next = chapters[index + 1];
        const wash = next?.light ?? FINAL_WASH;
        const nextPanel = panels[index + 1];
        return (
          <section
            key={chapter.id}
            id={chapter.anchor}
            className={styles.chapter}
            data-path-chapter={chapter.id}
            data-chapter-index={index}
            aria-label={chapter.title}
            style={{ ["--chapter-light" as string]: chapter.light }}
          >
            <div className={styles.stage}>
              {next ? (
                <div className={styles.preview} data-preview="" aria-hidden="true" inert>
                  <LayerStack chapter={next} kind="preview" />
                  {index === 0 && nextPanel ? (
                    <div className={styles.content} data-align={next.align ?? "center"}>
                      {cloneElement(nextPanel as ReactElement)}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className={styles.world} data-world="">
                <LayerStack chapter={chapter} kind="world" />
                <div className={styles.veil} data-light-wash="" style={{ background: wash }} />
                <div
                  className={styles.content}
                  data-chapter-content=""
                  data-align={chapter.align ?? "center"}
                >
                  {panels[index] ?? null}
                </div>
              </div>
              {next ? <Curtain showArt={showWalls} /> : null}
            </div>
          </section>
        );
      })}
      <nav className={styles.dots} aria-label="Path chapters">
        {chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            type="button"
            className={styles.dot}
            data-path-dot=""
            data-index={index}
            aria-current={index === 0 ? "true" : "false"}
            aria-label={`${chapter.title}, chapter ${index + 1} of ${chapters.length}`}
            onClick={() => jump(index)}
          >
            <span className={styles.dotLabel} aria-hidden="true">
              {chapter.title}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
