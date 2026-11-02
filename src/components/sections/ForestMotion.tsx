"use client";

import { useRef, type ComponentProps } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { hexagon } from "./comb";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Degrees of skew before falloff; the crown of a tall tree travels 15-20px.
const LEAN = 2;

// The sponsors <section>, wired up by data attributes so the markup stays on the server.
export function ForestMotion(props: ComponentProps<"section">) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const list = gsap.utils.toArray<HTMLElement>;

      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        // The sky holds still while a hexagon grows in the hive wall until it's
        // wider than the screen. Clips, not scale, to keep the rim's edge sharp.
        const [wall] = list("[data-hive-wall]");
        const [rim] = list("[data-hive-rim]");
        const [hold] = list("[data-hold]");
        const opening = { progress: 0 };
        const cut = () => {
          const { offsetWidth: w, offsetHeight: h } = wall;
          const inner = 30 + opening.progress * Math.hypot(w, h) * 0.62;
          const outer = inner + 10 + opening.progress * 26;
          const hole = hexagon(w / 2, h / 2, inner);
          wall.style.clipPath = `path(evenodd, "M0 0H${w}V${h}H0Z${hole}")`;
          rim.style.clipPath = `path(evenodd, "${hexagon(w / 2, h / 2, outer)}${hole}")`;
        };

        cut();
        gsap.set("[data-hive]", { autoAlpha: 1 });
        gsap.to(opening, {
          progress: 1,
          ease: "power2.in",
          onUpdate: cut,
          scrollTrigger: {
            trigger: "[data-hive-stage]",
            start: "top 60%",
            // Done just before the crowns of the woods rise over the sky.
            end: () => `top ${-hold.offsetHeight * 0.85}px`,
            scrub: true,
            onRefresh: cut,
          },
        });

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
