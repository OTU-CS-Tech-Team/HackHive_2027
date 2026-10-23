"use client";

import { useEffect, useRef, useState } from "react";

export default function NavbarShell({ children }: { children: React.ReactNode }) {
    const [hidden, setHidden] = useState(false);
    const lastY = useRef(0);

    useEffect(() => {
        lastY.current = window.scrollY;

        const onScroll = () => {
            const y = window.scrollY;

            if (y <= 64) {
                setHidden(false);
            } else if (y > lastY.current) {
                setHidden(true);
            }
            lastY.current = y;
        };

        const onPointerMove = (event: PointerEvent) => {
            if (event.pointerType === "mouse" && event.clientY <= 50) {
                setHidden(false);
            }
            if (event.pointerType === "mouse" && event.clientY > 50 && window.scrollY > 64) {
                setHidden(true);
            }
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("pointermove", onPointerMove, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("pointermove", onPointerMove);
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