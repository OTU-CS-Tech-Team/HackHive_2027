"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavLink = {
  href: string;
  label: string;
};

export default function MobileNavMenu({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative md:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-page-navigation"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="flex size-11 flex-col items-center justify-center gap-1.5 rounded-md text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        <span className={`h-0.5 w-6 rounded bg-current transition-transform ${open ? "translate-y-2 rotate-45" : ""}`} />
        <span className={`h-0.5 w-6 rounded bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
        <span className={`h-0.5 w-6 rounded bg-current transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`} />
      </button>

      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close navigation menu"
        onClick={() => setOpen(false)}
        className={`absolute left-[-1rem] top-[calc(100%+0.625rem)] z-40 h-[calc(100dvh-4rem)] w-screen bg-black/30 transition-opacity duration-300 sm:left-[-1.5rem] ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <nav
        id="mobile-page-navigation"
        aria-label="Page sections"
        aria-hidden={!open}
        inert={!open}
        className={`absolute left-[-1rem] top-[calc(100%+0.625rem)] z-50 flex h-[calc(100dvh-4rem)] w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto overscroll-contain border-r border-neutral-200 bg-white p-4 shadow-xl transition-transform duration-300 ease-in-out sm:left-[-1.5rem] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
            >
              {link.label}
            </Link>
          ))}
      </nav>
    </div>
  );
}
