"use client";

import { Children, useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FINAL_WASH } from "@/components/path/chapters";
import { Curtain } from "@/components/path/Curtain";
import { blurPx, zoomScale } from "@/components/path/math";
import { SceneArt } from "@/components/path/SceneArt";
import type { PathChapter, PathLayer } from "@/components/path/types";
import styles from "@/components/path/path.module.css";

function PathLayerView({
  chapter,
  layer,
  prefix,
}: {
  chapter: PathChapter;
  layer: PathLayer;
  prefix: string;
}) {
  return (
    <div
      className={styles.layer}
      data-layer=""
      data-slot={layer.slot}
      data-depth={layer.depth}
      data-mobile={layer.mobile === false ? "off" : "on"}
      aria-hidden={layer.alt ? undefined : true}
      style={{ ["--blur" as string]: `${blurPx(layer.depth, false)}px` }}
    >
      {layer.src ? (
        // Drop-in art from any public path. next/image would need remote patterns Jiwoo has not set.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.art}
          src={layer.src}
          alt={layer.alt}
          loading={prefix.startsWith("world-trailhead") ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
      ) : (
        <SceneArt chapterId={chapter.id} slot={layer.slot} prefix={`${prefix}-${layer.id}`} />
      )}
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

export function PathScroll({
  chapters,
  children,
}: {
  chapters: PathChapter[];
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panels = Children.toArray(children);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);

    const setDots = (index: number) => {
      root.querySelectorAll<HTMLButtonElement>("[data-path-dot]").forEach((dot) => {
        dot.setAttribute("aria-current", dot.dataset.index === String(index) ? "true" : "false");
      });
    };

    const mm = gsap.matchMedia();
    mm.add(
      {
        reduce: "(prefers-reduced-motion: reduce)",
        mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      },
      (context) => {
        if (context.conditions?.reduce) {
          root.dataset.motion = "reduce";
          const chapterEls = [...root.querySelectorAll<HTMLElement>("[data-path-chapter]")];
          const observer = new IntersectionObserver(
            (entries) => {
              const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
              if (!visible) return;
              const index = chapterEls.indexOf(visible.target as HTMLElement);
              if (index >= 0) setDots(index);
            },
            { threshold: [0.45, 0.7] },
          );
          chapterEls.forEach((el) => observer.observe(el));
          root.dataset.pathReady = "true";
          return () => observer.disconnect();
        }
        const mobile = Boolean(context.conditions?.mobile);
        root.dataset.motion = mobile ? "mobile" : "full";
        const chapterEls = [...root.querySelectorAll<HTMLElement>("[data-path-chapter]")];

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
          const distance = isLast ? (mobile ? "+=70%" : "+=90%") : mobile ? "+=110%" : "+=160%";

          gsap.set(layers, { force3d: true, transformOrigin: "50% 50%", scale: 1 });

          const timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: distance,
              pin: true,
              pinSpacing: true,
              pinType: mobile ? "transform" : "fixed",
              scrub: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onToggle: (self) => {
                if (self.isActive) setDots(index);
              },
              onRefresh: (self) => {
                el.dataset.pinStart = String(Math.round(self.start));
                el.dataset.pinEnd = String(Math.round(self.end));
              },
            },
          });

          if (layers.length > 0) {
            timeline.to(
              layers,
              {
                scale: (_i, target) => zoomScale(Number((target as HTMLElement).dataset.depth ?? 0), mobile),
                duration: isLast ? 1 : 0.62,
              },
              0,
            );
          }

          if (wash) timeline.to(wash, { opacity: 0.5, duration: isLast ? 1 : 0.62 }, 0);

          if (!isLast && curtain && left && right && world) {
            if (content) timeline.to(content, { autoAlpha: 0, duration: 0.12 }, 0.5);
            timeline.fromTo(
              curtain,
              { scale: 0.16, opacity: 0 },
              { scale: 1, opacity: 1, duration: 0.2 },
              0.52,
            );
            timeline.to(world, { autoAlpha: 0, duration: 0.04 }, 0.72);
            if (preview) timeline.set(preview, { autoAlpha: 1 }, 0.73);
            timeline.to(left, { xPercent: -108, duration: 0.26 }, 0.76);
            timeline.to(right, { xPercent: 108, duration: 0.26 }, 0.76);
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
          root.dataset.pathReady = "true";
          const hash = window.location.hash;
          if (hash.length > 1) {
            document.getElementById(hash.slice(1))?.scrollIntoView();
          }
        };
        requestAnimationFrame(publish);

        return () => {
          root.dataset.pathReady = "false";
        };
      },
    );

    return () => {
      mm.revert();
    };
  }, []);

  const jump = (index: number) => {
    const root = rootRef.current;
    if (!root) return;
    const el = root.querySelectorAll<HTMLElement>("[data-path-chapter]")[index];
    if (!el) return;
    root.querySelectorAll<HTMLButtonElement>("[data-path-dot]").forEach((dot) => {
      dot.setAttribute("aria-current", dot.dataset.index === String(index) ? "true" : "false");
    });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = el.dataset.pinStart;
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
                  <div className={styles.light} style={{ background: next.light }} />
                </div>
              ) : null}
              <div className={styles.world} data-world="">
                <LayerStack chapter={chapter} kind="world" />
                <div className={styles.grain} aria-hidden="true" />
                <div className={styles.light} style={{ background: chapter.light }} />
                <div
                  className={`${styles.light} ${styles.wash}`}
                  data-light-wash=""
                  style={{ background: wash }}
                />
                <div
                  className={styles.content}
                  data-chapter-content=""
                  data-align={chapter.align ?? "center"}
                >
                  {panels[index] ?? null}
                </div>
              </div>
              {next ? <Curtain /> : null}
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
