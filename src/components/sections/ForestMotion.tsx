"use client";

import { useRef, type ComponentProps } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger, MotionPathPlugin, DrawSVGPlugin);

// Degrees of skew before falloff; the crown of a tall tree travels 15-20px.
const LEAN = 2;

// The sponsors <section>, wired up by data attributes so the markup stays on the server.
export function ForestMotion(props: ComponentProps<"section">) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const list = gsap.utils.toArray<HTMLElement>;

      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        // Each layer drifts by its own depth while it crosses the viewport.
        list("[data-depth]").forEach((el) => {
          const travel = Number(el.dataset.depth);
          gsap.fromTo(
            el,
            { y: -travel },
            {
              y: travel,
              ease: "none",
              scrollTrigger: {
                trigger: el,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );
        });

        // Wind in the branches, paused while a tree is off screen.
        list("[data-sway]").forEach((el, i) => {
          gsap.fromTo(
            el,
            { skewX: -0.5 },
            {
              skewX: 0.5,
              transformOrigin: "50% 100%",
              duration: 4 + (i % 3),
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
              scrollTrigger: {
                trigger: el,
                toggleActions: "play pause resume pause",
              },
            },
          );
        });

        list("[data-rise]").forEach((el) => {
          gsap.from(el, {
            y: 70,
            autoAlpha: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });

        // Trails sketch themselves across the sky as it scrolls past.
        gsap.from(list("[data-draw]"), {
          drawSVG: "0%",
          ease: "none",
          stagger: 0.2,
          scrollTrigger: {
            trigger: "[data-draw]",
            start: "top 90%",
            end: "bottom 30%",
            scrub: 1,
          },
        });

        list("[data-bee]").forEach((bee) => {
          const path = `#sponsor-trail-${bee.dataset.bee}`;
          gsap.set(bee, { visibility: "visible" });
          gsap
            .to(bee, {
              duration: Number(bee.dataset.dur),
              ease: "none",
              repeat: -1,
              motionPath: {
                path,
                align: path,
                alignOrigin: [0.5, 0.5],
                autoRotate: true,
              },
            })
            .progress(Number(bee.dataset.start));
        });
      });

      gsap
        .matchMedia()
        .add(
          "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
          () => {
            // Trees ease away from the cursor and settle back when it moves on.
            const trees = list("[data-lean]").map((el) => ({
              el,
              lean: gsap.quickTo(el, "skewX", {
                duration: 1.2,
                ease: "power2.out",
              }),
            }));

            const stir = (event: PointerEvent) => {
              const inPanel = (event.target as Element).closest("[data-rise]");
              const box = trees[0].el.offsetParent!.getBoundingClientRect();
              trees.forEach(({ el, lean }) => {
                const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = el;
                const dx = event.clientX - box.left - offsetLeft - offsetWidth / 2;
                const dy = event.clientY - box.top - offsetTop - offsetHeight * 0.4;
                const near = Math.hypot(dx / offsetWidth, dy / (offsetHeight * 0.6));
                const push = gsap.utils.clamp(-1, 1, dx / (offsetWidth * 0.25));
                lean(inPanel ? 0 : LEAN * push * Math.max(0, 1 - near));
              });
            };
            const settle = () => trees.forEach(({ lean }) => lean(0));

            const section = root.current!;
            section.addEventListener("pointermove", stir);
            section.addEventListener("pointerleave", settle);
            return () => {
              section.removeEventListener("pointermove", stir);
              section.removeEventListener("pointerleave", settle);
            };
          },
        );
    },
    { scope: root },
  );

  return <section ref={root} {...props} />;
}
