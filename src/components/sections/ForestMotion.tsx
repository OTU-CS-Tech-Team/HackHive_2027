"use client";

import { useRef, type ComponentProps } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { hexagon } from "./comb";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Degrees of skew before falloff; the crown of a tall tree travels 15-20px.
const LEAN = 2;

// One cell of the hive wall's comb: the 28×49 --comb tile drawn at 2×, with its
// middle cell centred on the wall. Outer edge, then the inside of the wax ring.
const CELL = 30;
const WAX = 25.4;
// Share of the opening done before the hive starts to dissolve.
const FADE = 0.75;
const widen = gsap.parseEase("power2.in");
// How much of the treeline's band stays below the heading once it settles.
const SETTLE = 0.8;

// The sponsors <section>, wired up by data attributes so the markup stays on the server.
export function ForestMotion(props: ComponentProps<"section">) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const list = gsap.utils.toArray<HTMLElement>;

      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        // The middle cell of the hive wall lights up as it reaches the centre of
        // the screen. Once the sky sticks, it opens and grows until it's wider
        // than the screen. Clips, not scale, to keep the rim's edge sharp.
        const [hive] = list("[data-hive]");
        const [wall] = list("[data-hive-wall]");
        const [rim] = list("[data-hive-rim]");
        const [hold] = list("[data-hold]");
        const opening = { glow: 0, open: 0 };
        const cut = () => {
          const { offsetWidth: w, offsetHeight: h } = wall;
          const { glow, open } = opening;
          const x = w / 2;
          const y = h / 2 - 0.5;
          // The flanks meet the screen edges at w/√3, long before the tips clear
          // the corners on a tall phone, and a flank parked at the edge reads as
          // a stripe. So grow toward the edges and dissolve the hive on the way.
          const inner = (w / Math.sqrt(3)) * widen(open);
          const outer = Math.max(CELL, inner + CELL - WAX + open * 30);
          const hole = inner > 0.5 ? hexagon(x, y, inner) : "";
          wall.style.clipPath = hole
            ? `path(evenodd, "M0 0H${w}V${h}H0Z${hole}")`
            : "";
          rim.style.clipPath = `path(evenodd, "${hexagon(x, y, outer)}${hexagon(x, y, Math.max(WAX, inner))}")`;
          // At 0 the comb's own ring shows through, so the cell matches its neighbours.
          rim.style.opacity = `${glow}`;
          hive.style.opacity = `${1 - gsap.utils.clamp(0, 1, (open - FADE) / (1 - FADE))}`;
        };

        cut();
        gsap.set("[data-hive]", { autoAlpha: 1 });
        gsap.to(opening, {
          glow: 1,
          ease: "none",
          onUpdate: cut,
          scrollTrigger: {
            trigger: "[data-hive-stage]",
            start: "top 35%",
            end: "top top",
            scrub: true,
          },
        });
        gsap.to(opening, {
          open: 1,
          ease: "none",
          onUpdate: cut,
          scrollTrigger: {
            trigger: "[data-hive-stage]",
            start: "top top",
            // Done just before the crowns of the woods rise over the sky.
            end: () => `top ${-hold.offsetHeight * 0.85}px`,
            scrub: true,
            onRefresh: cut,
          },
        });

        // The heading settles down the sky through the hold, so the hive opens
        // onto it already lowered, and it ends a little into the tree tips. The
        // sky's bottom padding is the treeline's band; SETTLE of it stays below.
        const [intro] = list("[data-drift]");
        const sky = intro.offsetParent as HTMLElement;
        gsap.to(intro, {
          y: () =>
            Math.max(
              0,
              sky.clientHeight -
                parseFloat(getComputedStyle(sky).paddingBottom) * SETTLE -
                intro.offsetTop -
                intro.offsetHeight,
            ),
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hive-stage]",
            start: "top top",
            end: () => `top ${-hold.offsetHeight}px`,
            scrub: true,
            invalidateOnRefresh: true,
          },
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
