"use client";
 
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
 
// Floating button (fixed bottom-right) that hides every element marked `data-panel`
// so the animated background can be seen on its own. Resets when the page/tab changes.
export function BackgroundToggle() {
  const [hidden, setHidden] = useState(false);
 
  useEffect(() => {
    // globals.css hides [data-panel] while <html> has this attribute
    document.documentElement.toggleAttribute("data-hide-panel", hidden);
    return () => document.documentElement.removeAttribute("data-hide-panel");
  }, [hidden]);
 
  return (
    <button
      type="button"
      onClick={() => setHidden((value) => !value)}
      aria-pressed={hidden}
      className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-lg backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
    >
      {hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
      {hidden ? "Show panels" : "Hide panels"}
    </button>
  );
}
 