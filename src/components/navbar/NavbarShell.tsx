"use client";

import { useEffect, useRef, useState } from "react";

export default function NavbarShell({ children }: { children: React.ReactNode }) {
    const [hidden, setHidden] = useState(false);
    const pointerType = useRef<string>("mouse");

    useEffect(() => {
        let ticking = false;
        let lastY = window.scrollY;

        pointerType.current = window.matchMedia("(hover: none)").matches ? "touch" : "mouse";

        const onScroll = (event: Event) => {
            const target = event.target;

            if (ticking) return;
            ticking = true;

            requestAnimationFrame(() => {
                const y =
                    target instanceof HTMLElement &&
                    target !== document.documentElement &&
                    target !== document.body
                        ? Math.max(target.scrollTop, 0)
                        : Math.max(window.scrollY || document.documentElement.scrollTop, 0);
                const delta = y - lastY;

                if (y <= 64) {
                    setHidden(false);
                    lastY = y;
                } else if (Math.abs(delta) > 8) {
                    setHidden(delta > 0 || pointerType.current === "mouse");
                    lastY = y;
                }

                ticking = false;
            });
        };

        const onPointerMove = (event: PointerEvent) => {
            pointerType.current = event.pointerType;

            if (event.pointerType === "mouse") {
                if (event.clientY <= 50) {
                    setHidden(false);
                } else if (window.scrollY > 64) {
                    setHidden(true);
                }
            }
        };

        const onPointerDown = (event: PointerEvent) => {
            pointerType.current = event.pointerType;
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("pointerdown", onPointerDown, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
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