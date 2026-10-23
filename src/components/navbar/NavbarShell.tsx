"use client";

import { useEffect, useRef, useState } from "react";

export default function NavbarShell({ children }: { children: React.ReactNode }) {
    const [hidden, setHidden] = useState(false);
    const lastY = useRef(0);

    useEffect(() => {
        const onScroll = () => {
        const y = window.scrollY;
        setHidden(y > lastY.current && y > 64);
        lastY.current = y;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("touchmove", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    
    const [mouseY, setMouseY] = useState(0);
    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            setMouseY(event.pageY);
            console.log("Mouse Page Y:", mouseY);
        };
        setHidden(mouseY < 50);
        
        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
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