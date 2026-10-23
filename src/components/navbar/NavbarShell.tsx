"use client";

import { useEffect, useRef, useState } from "react";

export default function NavbarShell({ children }: { children: React.ReactNode }) {
    const [hidden, setHidden] = useState(false);
    const pointerType = useRef<string>("mouse");

    useEffect(() => {
        let ticking = false;
        const lastYByTarget = new WeakMap<EventTarget, number>();
        lastYByTarget.set(document, getPageScrollY());

        pointerType.current = window.matchMedia("(hover: none), (pointer: coarse)").matches
            ? "touch"
            : "mouse";

        const getScrollTarget = (target: EventTarget | null) => {
            if (
                target instanceof HTMLElement &&
                target !== document.documentElement &&
                target !== document.body
            ) {
                return target;
            }

            return document;
        };
        const getScrollY = (target: EventTarget) =>
            target instanceof HTMLElement ? Math.max(target.scrollTop, 0) : getPageScrollY();

        const onScroll = (event: Event) => {
            const target = getScrollTarget(event.target);

            if (ticking) return;
            ticking = true;

            requestAnimationFrame(() => {
                const y = getScrollY(target);
                const delta = y - (lastYByTarget.get(target) ?? 0);
                lastYByTarget.set(target, y);

                if (y <= 64) {
                    setHidden(false);
                } else if (Math.abs(delta) > 8) {
                    setHidden(delta > 0 || pointerType.current === "mouse");
                }

                ticking = false;
            });
        };

        const onPointerMove = (event: PointerEvent) => {
            pointerType.current = event.pointerType;

            if (event.pointerType === "mouse") {
                if (event.clientY <= 50) {
                    setHidden(false);
                } else if (getPageScrollY() > 64) {
                    setHidden(true);
                }
            }
        };

        const onPointerDown = (event: PointerEvent) => {
            pointerType.current = event.pointerType;
        };

        document.addEventListener("scroll", onScroll, { capture: true, passive: true });
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("pointerdown", onPointerDown, { passive: true });

        return () => {
            document.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerdown", onPointerDown);
        };
    }, []);

    return (
        <header
            className={`fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 transition-transform duration-300 ease-in-out sm:px-6 ${
                hidden ? "-translate-y-full" : "translate-y-0"
            }`}
        >
            {children}
        </header>
    );
}

function getPageScrollY() {
    return Math.max(
        window.scrollY ||
            window.pageYOffset ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            document.scrollingElement?.scrollTop ||
            0,
        0,
    );
}