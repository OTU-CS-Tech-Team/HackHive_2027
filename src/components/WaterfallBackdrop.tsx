"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WaterfallScene, type Region } from "@/lib/waterfall-scene";

// One valley, three slices. Pick the slice with the `region` prop:
//   schedule -> "top", application -> "middle", looking for group -> "bottom".
// (Don't export plain constants from this file: it's a client module, and a server
// component like page.tsx can't read non-component exports from one.)
export function WaterfallBackdrop({ region }: { region: Region }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  // The portal target (document.body) only exists in the browser.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const canvas = ref.current;
    if (!mounted || !canvas) return;
    // Same seed everywhere so all three slices line up as one picture.
    const scene = new WaterfallScene(canvas, 7, region);
    scene.start();
    return () => scene.stop();
  }, [mounted, region]);

  if (!mounted) return null;

  // zIndex -1 keeps it behind ALL page content (sidebar included). With z-index 0 it would paint
  // over any element that isn't positioned itself. Safe here because the portal puts it directly
  // under <body>, so no layout wrapper's background can sit between it and the page.
  // Rendered straight into <body> via a portal. Inside the site's layout wrappers a
  // `position: fixed` canvas can be sized or clipped by an ancestor (transform, filter,
  // overflow, a stacking context...). Out here it always covers the real viewport.
  return createPortal(
    <canvas
      ref={ref}
      data-waterfall-backdrop=""
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: -1, pointerEvents: "none" }}
    />,
    document.body,
  );
}